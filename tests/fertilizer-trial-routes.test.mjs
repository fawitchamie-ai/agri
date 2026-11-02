import test from 'node:test';import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness,restartDatabase} from './support/local-route-harness.mjs';
import {fixture} from './support/field-trial-fixture.ts';
const base='https://agri.test';
async function req(body,status=200,path='/api/seasonal'){const r=await localFetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)}:{});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d).slice(0,600));return d;}
test('authenticated experimental evidence and trial revision persistence survive reopen and deny another account',async()=>{try{
 setIdentity(null);await req({action:'fertilizer-evidence',country:'TGO',cropId:'maize',asOfDate:'2026-11-02'},401);
 setIdentity({userId:'trial-owner',email:'trial-owner@example.test',displayName:'Trial owner'});
 const d=await req({action:'fertilizer-evidence',country:'TGO',cropId:'maize',asOfDate:'2026-11-02'});assert.equal(d.observations.length,2);assert.equal(d.productionEnabled,false);
 const rice=await req({action:'fertilizer-evidence',country:'BEN',cropId:'rice-upland',asOfDate:'2026-11-02'});
 assert.ok(rice.extension.observations.length>0);assert.ok(rice.extension.observations.every(r=>r.country==='BEN'&&r.cropId==='rice-upland'&&r.contrast==='P_environment'));
 assert.equal(rice.extension.productionEnabled,false);assert.equal(rice.extension.research[0].interval95Available,false);
 const past=await req({action:'fertilizer-evidence',country:'BEN',cropId:'rice-upland',asOfDate:'2026-11-01'});assert.equal(past.extension,null);
 const c=fixture();const a=await req({action:'save',id:'field-trial-campaign',expectedRevision:0,config:c},201);assert.deepEqual(a.campaign.config.fieldTrials,c.fieldTrials);
 for(const p of c.fieldTrials[0].plots){p.areaM2=10;p.harvest={date:c.asOfDate,kg:p.arm==='control'?2:3,moisturePercent:20,source:'Synthetic route fixture'};}
 await req({action:'save',id:'field-trial-campaign',expectedRevision:1,config:c});restartDatabase();
 const opened=await req(undefined,200,'/api/seasonal?id=field-trial-campaign');assert.equal(opened.campaign.config.fieldTrials[0].plots[0].harvest.moisturePercent,20);
 const old=await req(undefined,200,'/api/seasonal?id=field-trial-campaign&revision=1');assert.equal(old.config.fieldTrials[0].plots[0].harvest,null);
 await req({action:'save',id:'field-trial-campaign',expectedRevision:1,config:c},409);
 await req({action:'save',id:'field-trial-campaign',expectedRevision:2,config:{...c,fieldTrials:[]}},400);
 setIdentity({userId:'trial-outsider',email:'trial-outsider@example.test',displayName:'Other'});await req(undefined,404,'/api/seasonal?id=field-trial-campaign');
}finally{closeHarness();}});
