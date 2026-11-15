// Optional real public-data probe. It never accesses private campaigns or harvests.
// node --use-env-proxy --experimental-transform-types scripts/verify-field-monitoring-live.mjs /absolute/private/work
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readZoneSeason} from '../lib/seasonal/field-zones-provider.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
import {FIELD_ZONES_VERSION,fieldMonitoringScope,analyzeFieldZones,zonesGeoJson} from '../lib/seasonal/field-zones.ts';
const root=fileURLToPath(new URL('../',import.meta.url)),work=process.argv[2]&&resolve(process.argv[2]);
const rel=work?relative(root,work):'';
if(!work||!(rel==='..'||rel.startsWith('../')))throw new Error('Choose a private work directory outside the repository.');
await mkdir(work,{recursive:true});
const c=applyCropProfile(exampleCampaign(),'maize');c.asOfDate=new Date().toISOString().slice(0,10);c.sowingDate=c.asOfDate;c.weather=[];
c.name='Public satellite technical control — crop history unknown';
c.parcelGeometry={type:'Polygon',coordinates:[[[1.2,9.4],[1.202,9.4],[1.202,9.402],[1.2,9.402],[1.2,9.4]]]};
const metrics=parcelMetrics(c.parcelGeometry);c.areaM2=metrics.areaM2;c.latitude=metrics.point[1];c.longitude=metrics.point[0];
c.fieldMonitoring={version:FIELD_ZONES_VERSION,scope:fieldMonitoringScope(c),cultivatedContour:false,comparableManagement:false,seasons:[]};
for(const year of [2021,2022,2023,2024,2025]){
 const record=await readZoneSeason(c.parcelGeometry,{id:'live-'+year,startDate:year+'-10-01',endDate:year+'-10-31',cropId:'unknown',comparable:false});
 c.fieldMonitoring.seasons.push(record);await writeFile(resolve(work,`satellite-${year}.json`),JSON.stringify(record));
 console.log(JSON.stringify({year,scenes:record.scenes.length,source:record.source,cellsWithTwoDates:record.cells.filter(v=>v[2]>=2).length}));
}
const a=analyzeFieldZones(c);
await writeFile(resolve(work,'zones.geojson'),JSON.stringify(zonesGeoJson(a)));
await writeFile(resolve(work,'campaign.json'),JSON.stringify({config:c,events:[]}));
console.log(JSON.stringify({actualPublicSatelliteData:true,measuredCropYield:false,status:a.status,commonFraction:a.coverage,stableFraction:a.stableFraction,heldLastSeasonAgreement:a.backtestAgreement,projection:a.projection,reasons:a.reasons,excluded:a.excluded}));
