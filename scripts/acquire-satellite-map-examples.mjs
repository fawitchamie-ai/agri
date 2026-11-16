// Explicit live probe. Only synthetic public test contours, no private campaign data.
// node --use-env-proxy --experimental-transform-types scripts/acquire-satellite-map-examples.mjs
import {mkdir,writeFile} from 'node:fs/promises';
import {readZoneSeason} from '../lib/seasonal/field-zones-provider.ts';
import {zoneGrid} from '../lib/seasonal/field-zones.ts';
import {fieldImageSummary} from '../lib/seasonal/field-analysis.ts';
import {readSatelliteVisual} from '../lib/seasonal/satellite-visual.ts';
const square=(lon,lat)=>({type:'Polygon',coordinates:[[[lon,lat],[lon+.002,lat],[lon+.002,lat+.002],[lon,lat+.002],[lon,lat]]]});
const examples=[
 {id:'togo-2024',name:'Togo 2024',country:'TGO',geometry:square(1.2,9.4),dates:['2024-10-14','2024-10-19','2024-10-29']},
 {id:'togo-2025',name:'Togo 2025',country:'TGO',geometry:square(1.2,9.4),dates:['2025-10-21','2025-10-31']},
 {id:'benin-2024',name:'Bénin 2024',country:'BEN',geometry:square(2.3,9.3),dates:['2024-10-19','2024-10-29']},
];
const evidence=[];
for(const example of examples){
 example.observations=[];const grid=zoneGrid(example.geometry);
 for(const day of example.dates){
  const r=await readZoneSeason(example.geometry,{id:'observation-'+day,startDate:day,endDate:day,cropId:'unknown',comparable:false});
  example.observations.push(r);const s=fieldImageSummary(grid,r);
  const row={example:example.id,date:day,itemId:r.scenes[0]?.itemId,cells:s.cells,coverage:s.coverage,mean:s.mean,min:s.minimum,max:s.maximum,clearFraction:r.scenes[0]?.clearFraction,issues:r.issues};evidence.push(row);console.log(JSON.stringify(row));
 }
 if(!example.observations.some(r=>fieldImageSummary(grid,r).coverage>=.6))throw new Error(example.id+' has no useful observation.');
}
const bounds=[1.199,9.399,1.203,9.403],visual=[];
for(const layer of ['rgb','classification']){
 const r=await readSatelliteVisual(bounds,'2024-10-19',layer);
 visual.push({layer,date:r.date,itemId:r.itemId,pixels:r.pixels.length,colours:new Set(r.pixels.map(p=>p.color)).size,resolutionM:r.resolutionM});
 console.log(JSON.stringify(visual.at(-1)));
}
const payload={version:'satellite-map-examples-1',retrievedOn:new Date().toISOString().slice(0,10),notice:'Contours techniques publics. Images Sentinel-2 réelles. Culture, semis, conduite et récolte non confirmés. Aucune validation de rendement.',examples};
await mkdir('public/examples',{recursive:true});await mkdir('docs/qa',{recursive:true});
await writeFile('public/examples/satellite-maps.json',JSON.stringify(payload));
await writeFile('docs/qa/satellite-map-examples-2026-11-16.json',JSON.stringify({actualPublicRasterData:true,measuredCropYield:false,cropHistoryKnown:false,acquiredOn:payload.retrievedOn,evidence,visual},null,2)+'\n');
