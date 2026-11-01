import test from 'node:test';
import assert from 'node:assert/strict';
import {waterOverview} from '../lib/seasonal/overview.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {planWater} from '../lib/seasonal/engine.ts';
import type {WaterEvent} from '../lib/seasonal/types.ts';
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('overview separates recorded water from future proposals and reconciles every week',()=>{
 const c=exampleCampaign('2026-11-01');
 const event:WaterEvent={id:'actual',date:c.sowingDate,kind:'irrigation',amount:20,unit:'m3',point:'field',status:'measured',source:'Synthetic test',recordedAt:'2026-11-01T08:00:00Z'};
 const p=planWater(c,[event]),before=JSON.stringify(p),o=waterOverview(c,p);
 assert.equal(p.complete,true);close(o.recorded.fieldM3!,20);close(o.recorded.netMm,15);assert.equal(o.recorded.count,1);
 assert.ok(o.proposed.count>0);close(o.recorded.fieldM3!+o.proposed.fieldM3!,p.totals.fieldM3!);
 close(o.weeks.reduce((n,w)=>n+w.proposed.fieldM3!,0),o.proposed.fieldM3!);
 close(o.weeks.reduce((n,w)=>n+w.recorded.fieldM3!,0),20);
 assert.equal(o.weeks.reduce((n,w)=>n+w.proposed.count,0),o.proposed.count);
 assert.equal(o.coverage.scenario,125);assert.equal(o.coverage.forecast,0);assert.equal(o.coverage.missing,0);
 assert.equal(JSON.stringify(p),before,'presentation must not mutate the authoritative plan');
});
test('overview keeps unknown gross volumes distinct from zero and uses the calculation surface',()=>{
 const c=exampleCampaign('2026-11-01');c.system.applicationEfficiency=null;
 const p=planWater(c),o=waterOverview(c,p);assert.equal(p.complete,true);assert.ok(o.proposed.netMm>0);assert.equal(o.proposed.fieldM3,null);assert.equal(o.recorded.fieldM3,0);
 p.calculationArea={selection:'potentialLand',areaM2:400,geometry:null};assert.equal(waterOverview(c,p).areaM2,400);
 c.system.sourceBudgetM3=0;const dry=waterOverview(c,planWater(c));assert.equal(dry.proposed.count,0);assert.equal(dry.proposed.netMm,0);
});
test('without a plan, weather coverage includes only complete days inside the crop cycle',()=>{
 const c=exampleCampaign('2026-11-01');c.weather=[
 {date:'2026-10-31',rainMm:0,et0Mm:5,status:'observed',source:'Test',availableAt:'2026-10-31T00:00:00Z'},
 {date:'2026-11-01',rainMm:0,et0Mm:5,status:'forecast',source:'Test',availableAt:'2026-11-01T00:00:00Z'},
 {date:'2026-11-02',rainMm:null,et0Mm:5,status:'forecast',source:'Test',availableAt:'2026-11-01T00:00:00Z'},
 {date:'2026-11-03',rainMm:0,et0Mm:5,status:'scenario',source:'Test',availableAt:'2026-11-01T00:00:00Z'}];
 assert.deepEqual(waterOverview(c,null).coverage,{forecast:1,scenario:1,past:0,missing:123,total:125});
});
