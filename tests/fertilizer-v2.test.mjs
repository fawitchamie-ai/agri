import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('v2 source integrity, explicit pairing, blocked labels and published diagnostics are reproducible',()=>{
 const r=spawnSync('python3',['-m','unittest','discover','-s','tests/calibration','-p','test_fertilizer_v2.py','-v'],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr+r.stdout);
});
