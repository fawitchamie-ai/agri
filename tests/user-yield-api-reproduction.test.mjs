// Synthetic parcel with the size, country, crop and date reported by the user.
// Neither its coordinates nor soil/weather data represent their real field.
import test from 'node:test';
import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
import {emptyCampaign} from '../lib/seasonal/example.ts';
import {automaticCampaign} from '../lib/seasonal/automatic.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';

test('API does not invent a harvest from a contour and missing campaign evidence',async()=>{
 const origin='https://agri.test';
 const shape=d=>({type:'Polygon',coordinates:[[[1,8],[1+d,8],[1+d,8+d],[1,8+d],[1,8]]]});
 let lo=0,hi=.01;for(let i=0;i<35;i++){const m=(lo+hi)/2;if(parcelMetrics(shape(m)).areaM2>39820)hi=m;else lo=m;}
 const c=automaticCampaign(emptyCampaign('2026-11-12'),'maize','2026-11-12');
 c.country='TGO';c.name='Mon champ';c.parcelGeometry=shape((lo+hi)/2);c.areaM2=parcelMetrics(c.parcelGeometry).areaM2;
 setIdentity({userId:'synthetic-reproduction',email:'synthetic@example.test',displayName:'Synthetic test'});
 try{
  const response=await localFetch(origin+'/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({action:'simulate',config:c})});
  const payload=await response.json();assert.equal(response.status,200,JSON.stringify(payload).slice(0,500));
  assert.equal(payload.plan.status,'blocked');assert.match(payload.plan.missing.join(' '),/hypothétiques.*acceptés explicitement/i);
  assert.ok(!payload.plan.yieldEstimation||payload.plan.yieldEstimation.scenarios.every(s=>s.totals===null));
  assert.ok(!payload.plan.growth||payload.plan.growth.status==='unavailable');
 }finally{closeHarness();}
});
