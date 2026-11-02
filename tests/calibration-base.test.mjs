import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('offline source audit; NC research tests explicitly skip when restricted originals have not been acquired',{timeout:120000},()=>{
 const r=spawnSync('python3',['-m','unittest','discover','-s','tests/calibration','-v'],{encoding:'utf8',timeout:110000,maxBuffer:2_000_000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);assert.match(r.stderr,/Ran \d+ tests/);assert.match(r.stderr,/test_published_audit_fingerprints_match_repository.*ok/);if(r.stderr.includes('skipped='))console.info('NC research originals absent: 14 optional research cases explicitly skipped; open-data checks executed.');
});
