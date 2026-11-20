import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCampaignFile,CAMPAIGN_FILE_MAX_BYTES} from '../lib/seasonal/campaign-file.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {enrichedCampaignFixture} from './support/enriched-campaign-fixture.ts';

test('an enriched export over the former import limit round-trips evidence and dated images and recomputes its plan',()=>{
 const c=enrichedCampaignFixture(),original=JSON.stringify(c),plan=planSeason(c);
 const exported=JSON.stringify({config:c,events:[],plan},null,2);
 assert.ok(Buffer.byteLength(exported)>2_000_000);
 assert.ok(Buffer.byteLength(exported)<CAMPAIGN_FILE_MAX_BYTES);
 const imported=parseCampaignFile(exported),replayed=planSeason(imported.config,imported.events);
 assert.equal(JSON.stringify(c),original);
 assert.deepEqual(imported.config.inputs,c.inputs);
 assert.equal(imported.config.fieldMonitoring?.datedObservations?.length,3);
 assert.deepEqual(replayed,plan);
 assert.equal('plan' in imported,false,'An imported output cannot bypass recalculation');
});
test('campaign files accept an observation-only campaign and ignore an old or forged output',()=>{
 const c=enrichedCampaignFixture();c.stages=[];c.weather=[];c.growth=undefined;c.managementPlan=undefined;
 const imported=parseCampaignFile(JSON.stringify({config:c,plan:{growth:{yieldKgHa:999999}}}));
 assert.equal(imported.config.stages.length,0);
 assert.equal(imported.config.fieldMonitoring?.datedObservations?.length,3);
 assert.deepEqual(imported.events,[]);
 assert.equal('plan' in imported,false);
});
test('campaign files still reject malformed evidence, future actuals and oversized input',()=>{
 assert.throws(()=>parseCampaignFile('not json'),/JSON illisible/);
 assert.throws(()=>parseCampaignFile('{}'),/paramètres/);
 const c=enrichedCampaignFixture();c.inputs!.values['weather.'+c.weather[0].date+'.rainMm'].acquiredAt='invalid date';
 assert.throws(()=>parseCampaignFile(JSON.stringify({config:c})),/Date de provenance/);
 const future=enrichedCampaignFixture();future.weather[0].status='observed';
 assert.throws(()=>parseCampaignFile(JSON.stringify({config:future})),/observation météo.*future/);
 assert.throws(()=>parseCampaignFile(' '.repeat(CAMPAIGN_FILE_MAX_BYTES+1)),/32 Mo/);
});
