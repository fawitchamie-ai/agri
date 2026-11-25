import test from 'node:test';
import assert from 'node:assert/strict';
import {addDays} from '../lib/seasonal/validation.ts';
import {TOGO_MAIZE_VARIETIES,varietyMaturityWindow} from '../lib/seasonal/variety-options.ts';
test('Togo maize source has a sowing-to-50%-maturity range for each listed variety',()=>{
 assert.equal(TOGO_MAIZE_VARIETIES.length,8);
 const tzee=TOGO_MAIZE_VARIETIES.find(v=>v.id==='tzee');assert.ok(tzee);assert.deepEqual([tzee.daysMin,tzee.daysMax],[80,85]);
});
test('maturity windows follow the sowing date, including leap years',()=>{
 const window=varietyMaturityWindow('2024-02-20',80,85);
 assert.deepEqual(window,{from:addDays('2024-02-20',80),to:addDays('2024-02-20',85)});
 assert.equal(window.from,'2024-05-10');
});
test('invalid date and cycle ranges are rejected rather than guessed',()=>{
 assert.throws(()=>varietyMaturityWindow('2024-02-30',80,85),/Date de semis invalide/);
 assert.throws(()=>varietyMaturityWindow('2024-02-20',0,85),/Plage de cycle invalide/);
 assert.throws(()=>varietyMaturityWindow('2024-02-20',90,85),/Plage de cycle invalide/);
});
