import test from 'node:test';import assert from 'node:assert/strict';
import {fertilizerProposals,proposalDraft,cropNutritionHint} from '../lib/seasonal/fertilizer-proposals.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';import {applyCropProfile} from '../lib/seasonal/catalog.ts';
test('crop examples retain their original country, doses and timing, and never declare realized fertilizer',()=>{
 const c=applyCropProfile(exampleCampaign('2026-11-03'),'maize');c.country='TGO';
 const p=fertilizerProposals(c);assert.equal(p[0].dose[0],200);assert.deepEqual(p[0].npk,[15,15,15]);assert.equal(p[0].transferred,false);assert.match(p[0].source,/agriculture.gouv.tg/);
 const d=proposalDraft(c,p[0]);assert.equal(d.dose,200);assert.equal(d.date,'2026-11-13');assert.equal(d.expired,false);assert.equal(c.managementPlan,undefined);
 c.country='GHA';assert.equal(fertilizerProposals(c).find(p=>p.id.startsWith('icat-'))!.transferred,true);assert.equal(fertilizerProposals(c)[0].country,'GHA');
 const rice=applyCropProfile(c,'rice-upland');assert.equal(fertilizerProposals(rice)[0].dose[0],150);
 const cowpea={...c,cropProfile:{...c.cropProfile!,id:'cowpea'}};assert.ok(fertilizerProposals(cowpea).every(p=>!p.id.includes('maize')));assert.ok(cropNutritionHint(cowpea).length>20);
 c.asOfDate='2026-12-30';assert.equal(proposalDraft(c,p[0]).expired,true);
});
