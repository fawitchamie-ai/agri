// Route-level integration adapter. Uses the actual handlers and migration SQL;
// substitutes only the Cloudflare D1 transport and absent ChatGPT identity.
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync,mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=new URL('../../',import.meta.url);
const temporary=mkdtempSync(join(tmpdir(),'agri-route-tests-'));
const dbPath=join(temporary,'test.sqlite');
let sqlite=new DatabaseSync(dbPath);
const migrations=readdirSync(new URL('drizzle/',root)).filter(x=>x.endsWith('.sql')).sort();
for(const migration of migrations)sqlite.exec(readFileSync(new URL('drizzle/'+migration,root),'utf8'));
const result=(statement,args,method)=>{const s=sqlite.prepare(statement);if(method==='all')return {results:s.all(...args)};if(method==='first')return s.get(...args)||null;const r=s.run(...args);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};};
function prepare(sql){let args=[];const object={bind(...values){args=values;return object;},async first(){return result(sql,args,'first');},async all(){return result(sql,args,'all');},async run(){return result(sql,args,'run');},_execute(){return result(sql,args,'run');}};return object;}
globalThis.__agriTestEnv={DB:{prepare,async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(x=>x._execute());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
registerHooks({resolve(specifier,context,nextResolve){if(specifier==='cloudflare:workers')return {url:'agri-test:cloudflare',shortCircuit:true};if(specifier==='@/app/chatgpt-auth')return {url:'agri-test:identity',shortCircuit:true};if(specifier.startsWith('@/'))specifier=new URL(specifier.slice(2),root).href;try{return nextResolve(specifier,context);}catch(e){if(context.parentURL&&(specifier.startsWith('.')||specifier.startsWith('file:'))){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return nextResolve(url.href,context);}throw e;}},load(url,context,nextLoad){if(url==='agri-test:cloudflare')return {format:'module',source:'export const env=globalThis.__agriTestEnv;',shortCircuit:true};if(url==='agri-test:identity')return {format:'module',source:'export async function getChatGPTUser(){return globalThis.__agriTestIdentity??null;}',shortCircuit:true};if(url.endsWith('.json'))return {format:'module',source:'export default '+readFileSync(new URL(url),'utf8'),shortCircuit:true};return nextLoad(url,context);}});
const handlers={};for(const name of ['workspace','science','demo','import','export','access','report'])handlers['/api/'+name]=await import(new URL('app/api/'+name+'/route.ts',root));
export async function localFetch(url,options={}){const u=new URL(url),method=options.method||'GET';const handler=handlers[u.pathname]?.[method];if(!handler)return new Response('Not found',{status:404});return handler(new Request(u,options));}
export function setIdentity(identity){globalThis.__agriTestIdentity=identity;}
export function restartDatabase(){sqlite.close();sqlite=new DatabaseSync(dbPath);}
export function closeHarness(){sqlite.close();rmSync(temporary,{recursive:true,force:true});}
export const harnessScope={migrations,transport:'Node SQLite file with D1 adapter; actual API handlers; controlled ChatGPT identity stub'};
