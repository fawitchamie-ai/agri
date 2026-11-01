import test from 'node:test';import assert from 'node:assert/strict';
import {calibrationEvidence} from '../lib/seasonal/calibration-evidence.ts';import {exampleCampaign} from '../lib/seasonal/example.ts';import {planSeason} from '../lib/seasonal/yield.ts';import {dataReadiness} from '../lib/seasonal/data-readiness.ts';
import type {Country} from '../lib/seasonal/types.ts';
test('country × crop evidence differentiates acquired plot seasons, fitted functions and uncalibrated status',()=>{
 for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN'] as Country[]){const e=calibrationEvidence(country,'maize');assert.equal(e.calibrated,false);assert.equal(e.usedForPrediction,false);assert.equal(e.coverage.length,6);assert.equal(e.availability.length,1);assert.equal(e.pilot.plotSeasons,576);assert.equal(e.pilot.variety,'H507');assert.ok(e.soilContext);}
 assert.equal(calibrationEvidence('CIV','maize').availability[0].experimentalPlotSeasons,2400);
 for(const [country,n] of [['TGO',15],['BFA',69],['GHA',125]] as [Country,number][]){const e=calibrationEvidence(country,'maize').availability[0];assert.equal(e.externalFittedFunctions,n);assert.equal(e.experimentalPlotSeasons,0);}
 assert.equal(calibrationEvidence('SEN','tomato').availability[0].experimentalPlotSeasons,189);assert.equal(calibrationEvidence('SEN','maize').availability[0].experimentalPlotSeasons,0);
 assert.throws(()=>calibrationEvidence('NGA' as Country));assert.throws(()=>calibrationEvidence('TGO','invented-crop'));
});
test('the audit is informational and does not alter or promote a simulated result to an observation',()=>{
 const c=exampleCampaign('2026-11-01'),copy=JSON.stringify(c),before=planSeason(c);const audit=dataReadiness(c);assert.equal(JSON.stringify(c),copy);assert.deepEqual(planSeason(c),before);assert.equal(audit.experimentalEvidence.usedForPrediction,false);assert.equal(audit.experimentalEvidence.privateCampaignDataUsed,false);assert.equal(audit.remaining.find(r=>r.feature==='Engrais et réponse en rendement')!.state,'response_model_missing');
});
