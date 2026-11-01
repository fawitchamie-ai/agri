"""Small authenticated compute service with durable, resumable SQLite jobs.

Use behind an HTTPS reverse proxy, with a persistent volume. One isolated process
per calculation; no shell, pickle or untrusted executable configuration.
"""
import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from runner import validate


class Jobs:
    def __init__(self,path,timeout=90):
        self.path=path;self.timeout=timeout
        self.runtime=hashlib.sha256(Path(__file__).with_name('runner.py').read_bytes()+Path(__file__).with_name('requirements.lock.txt').read_bytes()).hexdigest()
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY,owner TEXT NOT NULL,input TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,created REAL NOT NULL,updated REAL NOT NULL,lease TEXT,result TEXT,error TEXT)')

    def connect(self):
        db=sqlite3.connect(self.path,timeout=10);db.row_factory=sqlite3.Row
        return db

    def submit(self,owner,bundle):
        try:validate(bundle)
        except KeyError as exc:raise ValueError('Required scientific input missing: '+str(exc)) from exc
        text=json.dumps(bundle,sort_keys=True,separators=(',',':'),allow_nan=False)
        job=hashlib.sha256((self.runtime+'\n'+owner+'\n'+text).encode()).hexdigest()
        with self.connect() as db:
            db.execute("INSERT OR IGNORE INTO jobs(id,owner,input,status,created,updated) VALUES(?,?,?,'pending',?,?)",(job,owner,text,time.time(),time.time()))
        return self.get(owner,job)

    def get(self,owner,job):
        with self.connect() as db:
            r=db.execute('SELECT id,status,attempts,created,updated,result,error FROM jobs WHERE id=? AND owner=?',(job,owner)).fetchone()
        if r is None:raise KeyError('Job not found')
        d=dict(r);d['result']=json.loads(d['result']) if d['result'] else None
        return d

    def retry(self,owner,job):
        r=self.get(owner,job)
        if r['status']!='failed' or r['attempts']>=3:
            raise ValueError('Only failed jobs with fewer than 3 attempts can be retried')
        with self.connect() as db:
            db.execute("UPDATE jobs SET status='pending',result=NULL,error=NULL,updated=? WHERE id=? AND owner=? AND status='failed' AND attempts<3",(time.time(),job,owner))
        return self.get(owner,job)

    def step(self):
        now=time.time();lease=os.urandom(16).hex()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            # Expired process lease after service interruption: observable, explicit retry.
            db.execute("UPDATE jobs SET status='failed',result=NULL,error='Interrupted worker lease; retry this job',lease=NULL,updated=? WHERE status='running' AND updated<?",(now,now-self.timeout-30))
            r=db.execute("SELECT * FROM jobs WHERE status='pending' ORDER BY created LIMIT 1").fetchone()
            if r is None:return False
            db.execute("UPDATE jobs SET status='running',attempts=attempts+1,lease=?,updated=? WHERE id=?",(lease,now,r['id']))
        result=None;error=None
        try:
            if hashlib.sha256((self.runtime+'\n'+r['owner']+'\n'+r['input']).encode()).hexdigest()!=r['id']:raise ValueError('Runtime version changed since submission; submit a new job without reusing states')
            p=subprocess.run([sys.executable,str(Path(__file__).with_name('runner.py'))],input=r['input'],text=True,capture_output=True,timeout=self.timeout,check=False)
            if p.returncode:
                error='Engine failed: '+p.stderr.strip().splitlines()[-1][:1000] if p.stderr.strip() else 'Engine failed without result'
            else:
                # PCSE may print one initialization notice before the JSON on first import.
                output=p.stdout.strip().splitlines()[-1]
                d=json.loads(output)
                if d.get('engine')!='Wofost81_NWLP_MLWB_SNOMIN' or d.get('result') is None:raise ValueError('No engine result')
                result=json.dumps(d,allow_nan=False)
                if len(result)>8000000:raise ValueError('Engine result exceeds 8 MB')
        except subprocess.TimeoutExpired:error='Engine timeout; explicit retry available'
        except Exception as exc:error='Engine result rejected: '+str(exc)[:600];result=None
        with self.connect() as db:
            db.execute('UPDATE jobs SET status=?,result=?,error=?,lease=NULL,updated=? WHERE id=? AND lease=?',('failed' if error else 'complete',result if not error else None,error,time.time(),r['id'],lease))
        return True


def serve(path,token,host='127.0.0.1',port=8091):
    if len(token)<32:raise ValueError('CROP_COMPUTE_TOKEN must contain at least 32 characters')
    jobs=Jobs(path);stop=threading.Event()
    def worker():
        while not stop.is_set():
            try:busy=jobs.step()
            except Exception:busy=False
            if not busy:stop.wait(.2)
    threading.Thread(target=worker,daemon=True).start()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def answer(self,status,value):
            data=json.dumps(value,allow_nan=False).encode();self.send_response(status)
            self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        def dispatch(self):
            if not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+token):return self.answer(401,{'error':'Unauthorized'})
            owner=self.headers.get('X-Owner','')
            if not re.fullmatch('[a-f0-9]{64}',owner):return self.answer(400,{'error':'Owner scope required'})
            try:
                if self.command=='GET' and self.path=='/health':
                    from importlib.metadata import version
                    return self.answer(200,{'engine':'Wofost81_NWLP_MLWB_SNOMIN','pcseVersion':version('pcse'),'validated':False})
                if self.command=='POST' and self.path=='/jobs':
                    size=int(self.headers.get('Content-Length','0'))
                    if not 0<size<=2000000:return self.answer(413,{'error':'JSON body limited to 2 MB'})
                    if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.answer(415,{'error':'JSON required'})
                    data=json.loads(self.rfile.read(size),parse_constant=lambda x:(_ for _ in ()).throw(ValueError('Non-finite JSON')))
                    return self.answer(202,jobs.submit(owner,data))
                m=re.fullmatch('/jobs/([a-f0-9]{64})(/retry)?',self.path)
                if m and self.command=='GET' and not m[2]:return self.answer(200,jobs.get(owner,m[1]))
                if m and self.command=='POST' and m[2]:return self.answer(202,jobs.retry(owner,m[1]))
                return self.answer(404,{'error':'Not found'})
            except KeyError:return self.answer(404,{'error':'Job or required input not found'})
            except (ValueError,TypeError,IndexError,AttributeError) as exc:return self.answer(422,{'error':str(exc)[:600]})
        do_POST=dispatch
        do_GET=dispatch
    server=ThreadingHTTPServer((host,port),Handler)
    try:server.serve_forever()
    finally:stop.set();server.server_close()


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--database',required=True);p.add_argument('--host',default='127.0.0.1');p.add_argument('--port',type=int,default=8091);a=p.parse_args()
    serve(a.database,os.environ.get('CROP_COMPUTE_TOKEN',''),a.host,a.port)
