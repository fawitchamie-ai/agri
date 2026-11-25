import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {satelliteExampleCampaign,type SatelliteExample} from '../lib/seasonal/satellite-examples.ts';
import {fieldImageArchive,fieldImageChoices,fieldImageSummary,compareFieldImages,fieldCropStage} from '../lib/seasonal/field-analysis.ts';
import {zoneGrid,analyzeFieldZones} from '../lib/seasonal/field-zones.ts';
const payload=JSON.parse(readFileSync(new URL('../public/examples/satellite-maps.json',import.meta.url),'utf8')) as {examples:SatelliteExample[]};
test('three public examples replay acquired Sentinel-2 values without inventing crop or harvest data',()=>{
 assert.equal(payload.examples.length,3);
 for(const e of payload.examples){const c=satelliteExampleCampaign(e,'2026-11-16'),grid=zoneGrid(c.parcelGeometry),archive=fieldImageArchive(c);
  assert.equal(archive.length,e.dates.length);assert.equal(c.crop,'Culture non confirmée');assert.equal(c.stages.length,0);assert.equal(c.weather.length,0);assert.equal(c.fallback,null);
  assert.equal(analyzeFieldZones(c).projection,'unavailable');const usable=archive.filter(r=>fieldImageSummary(grid,r).coverage>=.6);assert.equal(usable.length,2,e.id);
  assert.ok(usable.every(r=>r.source.includes('Copernicus Sentinel-2')&&r.scenes[0].itemId.startsWith('S2')));assert.notEqual(compareFieldImages(grid,usable[0],usable[1]).delta,null);
 }
 const c=satelliteExampleCampaign(payload.examples[0],'2026-11-16'),grid=zoneGrid(c.parcelGeometry),archive=fieldImageArchive(c);
 assert.equal(fieldImageSummary(grid,archive[0]).mean,null,'Cloudy date has no NDVI');
 assert.ok(Math.abs(fieldImageSummary(grid,archive[1]).mean!-.5347916748222277)<1e-12);
 assert.ok(Math.abs(fieldImageSummary(grid,archive[2]).mean!-.506434431883432)<1e-12);
 assert.deepEqual(fieldImageChoices(c).map(v=>v.date),['2024-10-19','2024-10-29']);
 const variation=compareFieldImages(grid,archive[1],archive[2],{archive,stageAt:date=>fieldCropStage(c,date)});
 assert.equal(variation.leftDate,'2024-10-19');assert.equal(variation.rightDate,'2024-10-29');
 assert.ok(variation.delta!<0);assert.ok(variation.coverage>.99);assert.equal(variation.gridM,20);
 assert.equal(variation.comparableStage,false);assert.ok(variation.zones.every(z=>z.repeatedOn===null));
 assert.equal(compareFieldImages(grid,archive[0],archive[1]).delta,null);
});
