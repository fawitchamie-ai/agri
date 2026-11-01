import test from 'node:test';import assert from 'node:assert/strict';import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
const url='https://agri.test/api/seasonal';
async function post(body,status=200){const r=await localFetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://agri.test'},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d).slice(0,300));return d;}
test('authenticated evidence API works without a drawn plot or complete cycle and never serves raw experimental data',async()=>{try{
 setIdentity(null);await post({action:'calibration-evidence',country:'CIV',cropId:'maize'},401);
 setIdentity({userId:'evidence-reader',email:'evidence@example.test',displayName:'Evidence Reader'});
 for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN']){const d=await post({action:'calibration-evidence',country,cropId:'maize',plan:{calibrated:true}});assert.equal(d.calibrated,false);assert.equal(d.usedForPrediction,false);assert.equal(d.coverage.length,6);assert.equal(d.rawRows,undefined);assert.equal(d.harvests,undefined);}
 await post({action:'calibration-evidence',country:'XYZ'},400);await post({action:'calibration-evidence',country:'TGO',cropId:'unknown'},400);
}finally{closeHarness();}});
