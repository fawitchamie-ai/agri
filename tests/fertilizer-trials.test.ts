import test from 'node:test';import assert from 'node:assert/strict';
import {fertilizerEvidence,marginalScenario} from '../lib/seasonal/fertilizer-evidence.ts';
import {parseFieldTrials,createTrialLayout,summarizeTrial,protectFieldTrials,type FieldTrial} from '../lib/seasonal/field-trials.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {geometryIdentity} from '../lib/seasonal/provenance.ts';import {validateConfig} from '../lib/seasonal/validation.ts';
import {testParcel} from './support/land-fixtures.mjs';
import {fixture} from './support/field-trial-fixture.ts';
test('country evidence never becomes a parcel forecast or a reference without fertilizer',()=>{
 for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN'] as const){const d=fertilizerEvidence(country,'maize','2026-11-02');assert.equal(d.productionEnabled,false);assert.equal(d.forecastValidated,false);assert.equal(d.nationalReference?.denominator,'harvested');assert.equal(d.nationalReference?.independentYm,false);if(country!=='TGO')assert.equal(d.observations.length,0);}
 assert.equal(fertilizerEvidence('TGO','maize','2026-10-01').observations.length,0);
 assert.throws(()=>fertilizerEvidence('XYZ' as any,'maize','2026-11-02'));
});
test('randomized layouts, moisture corrections, missing data, correction history and contours remain explicit',()=>{
 const c=fixture();assert.deepEqual(createTrialLayout(2,false,42),c.fieldTrials![0].plots);
 assert.deepEqual(summarizeTrial(c.fieldTrials![0]).contrasts,[]);
 for(const p of c.fieldTrials![0].plots){p.areaM2=10;p.harvest={date:c.asOfDate,kg:p.arm==='control'?2:3,moisturePercent:20,source:'Synthetic fixture only'};}
 const parsed=validateConfig(c);assert.equal(parsed.fieldTrials?.length,1);
 assert.ok(summarizeTrial(parsed.fieldTrials![0]).contrasts.every(r=>Math.abs(r.deltaDryKgHa-800)<1e-9));
 assert.equal(summarizeTrial(parsed.fieldTrials![0]).autoTraining,false);
 const next=structuredClone(parsed);next.fieldTrials![0].plots[0].harvest!.kg+=1;
 assert.throws(()=>protectFieldTrials(parsed,next),/Correction explicite/);
 next.fieldTrials![0].correction={id:'correction-1',reason:'Weighed bag corrected from field notebook'};assert.doesNotThrow(()=>protectFieldTrials(parsed,next));
 const deleted={...next,fieldTrials:[]};assert.throws(()=>protectFieldTrials(parsed,deleted),/conservé/);
 next.fieldTrials![0].plots[0].arm=next.fieldTrials![0].plots[0].arm==='control'?'alternative':'control';assert.throws(()=>parseFieldTrials(next.fieldTrials,next),/tirage/);
 next.fieldTrials![0].plots[0].arm=parsed.fieldTrials![0].plots[0].arm;
 next.fieldTrials![0].seed=42;next.fieldTrials![0].plots[0].areaM2=null;assert.throws(()=>parseFieldTrials(next.fieldTrials,next),/Surface mesurée/);
 next.fieldTrials![0].plots[0].areaM2=10;next.fieldTrials![0].geometryId='another';assert.throws(()=>parseFieldTrials(next.fieldTrials,next),/contour/);
});
test('marginal economics uses treated area once, includes all incremental costs, and exposes break-even sensitivity',()=>{
 const p={areaM2:5000,deltaKgHa:1000,cropPricePerKg:200,productCostPerHa:50000,transportCost:5000,applicationCost:10000,currency:'XOF',priceDate:'2026-11-02',priceSource:'Software fixture'};
 const r=marginalScenario(p);assert.equal(r.extraKg,500);assert.equal(r.cost,40000);assert.equal(r.marginalBenefit,60000);assert.equal(r.breakEvenDeltaKgHa,400);assert.equal(r.sensitivityPer100KgHa,10000);assert.equal(r.recommendation,null);
 assert.ok(marginalScenario({...p,deltaKgHa:-100}).marginalBenefit<0);
 assert.throws(()=>marginalScenario({...p,cropPricePerKg:0}));assert.throws(()=>marginalScenario({...p,areaM2:NaN}));assert.throws(()=>marginalScenario({...p,priceSource:''}));
});
