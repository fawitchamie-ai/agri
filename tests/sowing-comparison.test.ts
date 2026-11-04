import test from 'node:test';
import assert from 'node:assert/strict';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {assessLandGeometry} from '../lib/seasonal/land.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
import {addDays} from '../lib/seasonal/validation.ts';
import {emptyManagement} from '../lib/seasonal/management.ts';
import {comparisonWeatherRequests,comparisonWeather,compareSowingDates,sowingComparisonBlock} from '../lib/seasonal/sowing-comparison.ts';
import type {WeatherDay,WaterEvent} from '../lib/seasonal/types.ts';
const today=new Date().toISOString().slice(0,10);
const weather=(start:string,days:number):WeatherDay[]=>Array.from({length:days},(_,i)=>({date:addDays(start,i),rainMm:3,et0Mm:4,status:'scenario',source:'Synthetic calendar, not a forecast',availableAt:today+'T00:00:00Z'}));
function fixture(){const c=applyCropProfile(exampleCampaign(today),'maize');c.waterCondition='drained';c.fallback=null;c.system.sourceBudgetM3=1e6;
 c.parcelGeometry={type:'Polygon',coordinates:[[[1,8],[1.001,8],[1.001,8.001],[1,8.001],[1,8]]]};c.areaM2=parcelMetrics(c.parcelGeometry).areaM2;
 c.landAssessment=assessLandGeometry(c.parcelGeometry,[{id:'worldcover',status:'available',provider:'Synthetic',product:'Test',version:'test',referencePeriod:null,observedAt:null,acquiredAt:new Date().toISOString(),resolutionM:10,crs:'EPSG:4326',cells:[{id:'land',geometry:c.parcelGeometry,value:40}],reason:null,assets:[],limitations:[]}]);
 c.weather=weather(today,c.stages.reduce((n,s)=>n+s.days,0));return c;
}
test('delaying sowing requests the missing tail for the full three cycles',()=>{
 const c=fixture(),duration=c.weather.length;
 assert.deepEqual(comparisonWeatherRequests(c),[{start:addDays(today,duration),days:14}]);
 const before=JSON.stringify(c),rows=compareSowingDates(c,[],weather(addDays(today,duration),14),today);
 assert.equal(JSON.stringify(c),before);assert.deepEqual(rows.map(r=>r.complete),[true,true,true]);
 assert.equal(rows[2].end,addDays(today,duration+13));assert.ok(rows.every(r=>r.sourceM3!==null));
});
test('incomplete cycles never show partial totals as comparable full-cycle requirements',()=>{
 const c=fixture(),rows=compareSowingDates(c,[],[],today);
 assert.equal(rows[0].complete,true);assert.ok(rows[0].demandMm!>0);
 for(const r of rows.slice(1)){assert.equal(r.complete,false);assert.equal(r.demandMm,null);assert.equal(r.sourceM3,null);assert.ok(r.missing.length);}
});
test('weather additions preserve measured values including zero rainfall',()=>{
 const old=weather(today,1);old[0].status='observed';old[0].rainMm=0;
 const fresh=weather(today,2);fresh[0].rainMm=99;
 const merged=comparisonWeather(old,fresh);assert.deepEqual(merged[0],old[0]);assert.deepEqual(merged[1],fresh[1]);
 old[0].et0Mm=null;const filled=comparisonWeather(old,fresh);assert.equal(filled[0].rainMm,0);assert.equal(filled[0].et0Mm,4);assert.equal(old[0].et0Mm,null);
});
test('manual irrigation follows the crop offset; the source campaign and calendar stay unchanged',()=>{
 const c=fixture();c.managementPlan=emptyManagement(c);c.managementPlan.irrigation={mode:'manual',applications:[{date:today,fieldM3Ha:100}]};
 const before=JSON.stringify(c),rows=compareSowingDates(c,[],weather(today,c.weather.length+14),today);
 assert.ok(rows.every(r=>r.complete));assert.equal(JSON.stringify(c),before);
});
test('recorded events, declared products, past sowing and actual planted areas cannot move into future scenarios',()=>{
 const c=fixture(),event={status:'measured'} as WaterEvent;
 assert.match(sowingComparisonBlock(c,[event],today)!,/observations/);
 assert.throws(()=>compareSowingDates(c,[event],[],today),/observations/);
 assert.match(sowingComparisonBlock({...c,sowingDate:addDays(today,-1)},[],today)!,/passée/);
 c.managementPlan=emptyManagement(c);c.managementPlan.products=[{id:'a',date:today,kind:'fertilizer',product:'Recorded',dose:20,unit:'kg/ha',status:'declared',source:'Synthetic test',npkPercent:[15,15,15]}];
 assert.match(sowingComparisonBlock(c,[],today)!,/observations/);
});
test('an explicit fallback needs no fetch; a 366-day cycle splits requests within provider limits',()=>{
 const c=fixture();c.fallback={label:'Explicit synthetic scenario',rainMmDay:3,et0MmDay:4};c.weather=[];
 assert.deepEqual(comparisonWeatherRequests(c),[]);assert.ok(compareSowingDates(c,[],[],today).every(r=>r.complete));
 c.fallback=null;c.stages=[{...c.stages[0],days:366}];assert.deepEqual(comparisonWeatherRequests(c),[{start:today,days:366},{start:addDays(today,366),days:14}]);
});
