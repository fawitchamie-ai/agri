import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('open evidence pipeline has immutable inputs, no test-label tuning and reproducible published metrics',()=>{
 const r=spawnSync('python3',['-m','unittest','discover','-s','tests/calibration','-p','test_fertilizer.py','-v'],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr+r.stdout);
});
