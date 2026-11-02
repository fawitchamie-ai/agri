import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldBrief,addFieldNote,fieldNotes} from '../lib/seasonal/field-intelligence.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {validateConfig,addDays} from '../lib/seasonal/validation.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {COUNTRIES,type SeasonalConfig} from '../lib/seasonal/types.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
function config():SeasonalConfig{
 const c=exampleCampaign('2026-11-02');
 c.parcelGeometry={type:'Polygon',coordinates:[[[.96,8.01],[.961,8.01],[.961,8.011],[.96,8.011],[.96,8.01]]]};
 const m=parcelMetrics(c.parcelGeometry);return {...c,areaM2:m.areaM2,longitude:m.point[0],latitude:m.point[1]};
}
test('calendar stage is indicative and handles boundaries and pre-sowing dates',()=>{
 const c=config();assert.equal(fieldBrief(c,null,[]).stage,'Implantation');
 c.asOfDate=addDays(c.sowingDate,20);assert.equal(fieldBrief(c,null,[]).stage,'Croissance');
 c.asOfDate=addDays(c.sowingDate,125);assert.equal(fieldBrief(c,null,[]).stage,'Fin du cycle de référence');
 c.asOfDate=addDays(c.sowingDate,-1);assert.equal(fieldBrief(c,null,[]).stage,'Semis à venir');
});
test('weather never replaces missing data with zero or treats personal scenarios as forecasts',()=>{
 const c=config();let b=fieldBrief(c,null,[]);assert.equal(b.covered,0);assert.equal(b.rain,null);
 c.weather=Array.from({length:7},(_,i)=>({date:addDays(c.asOfDate,i),rainMm:0,et0Mm:3,status:'forecast',source:'Synthetic forecast',availableAt:c.asOfDate+'T00:00:00Z'}));
 b=fieldBrief(c,null,[]);assert.equal(b.covered,7);assert.equal(b.rain,0);
 c.weather[3].status='scenario';b=fieldBrief(c,null,[]);assert.equal(b.covered,6);assert.equal(b.rain,null);assert.equal(b.weather[3].day!.status,'scenario');
 c.weather[3].status='forecast';c.weather[3].availableAt='2026-11-03T00:00:00Z';b=fieldBrief(c,null,[]);assert.equal(b.weather[3].day,null);assert.equal(b.rain,null);
 c.weather[4].status='observed';assert.equal(fieldBrief(c,null,[]).weather[4].day,null);
});
test('flooding has first priority and suppresses irrigation suggestions',()=>{
 const c=config(),p=planSeason(c);c.waterCondition='submerged';
 const b=fieldBrief(c,p,[]);assert.equal(b.actions[0].id,'flood');assert.equal(b.usable,false);assert.equal(b.result,null);assert.equal(b.actions.some(a=>a.id==='irrigate'),false);
});
test('all six countries retain field notes through server validation, without inventing a diagnosis',()=>{
 for(const country of Object.keys(COUNTRIES) as (keyof typeof COUNTRIES)[]){
  const c={...config(),country};const note={parameter:'Ravageurs',date:c.asOfDate,note:'Traces sur feuilles, à faire vérifier.',observer:'Conseiller test'};
  const next=addFieldNote(c,note),parsed=validateConfig(next);
  assert.equal(fieldNotes(parsed).length,1);assert.equal(fieldNotes(parsed)[0].source,note.observer);assert.equal(fieldNotes(parsed)[0].value,note.note);assert.equal(c.agronomic,undefined);
 }
});
test('notes reject invalid dates, future dates, missing authors, wrong contours and bounded storage overflow',()=>{
 const c=config(),n={parameter:'Levée',date:c.asOfDate,note:'Levée irrégulière au nord.',observer:'Test'};
 for(const bad of [{date:'2026-02-30'},{date:'2026-11-03'},{observer:' '},{note:' '},{parameter:'Diagnostic certain'}])assert.throws(()=>addFieldNote(c,{...n,...bad}));
 const next=addFieldNote(c,n);next.agronomic!.geometryId='old';assert.equal(fieldNotes(next).length,0);assert.throws(()=>addFieldNote(next,n));
 const full=addFieldNote(c,n);full.agronomic!.observations=Array(100).fill(full.agronomic!.observations[0]);assert.throws(()=>addFieldNote(full,n));
});
test('stale plans hide all old totals and stage calendar never becomes a measurement',()=>{
 const c=config(),p=planSeason(c);const b=fieldBrief(c,p,[],true);
 assert.equal(b.result,null);assert.equal(b.estimate,undefined);assert.equal(b.usable,false);assert.equal(b.actions.some(a=>a.id==='irrigate'),false);assert.equal(b.stage,'Implantation');
});
