/** Explicit, read-only live checks; not part of the deterministic test suite. */
import {writeFile} from 'node:fs/promises';
import {loadLandAssessment} from '../lib/seasonal/land-provider.ts';
import {polygonFromPoints} from '../lib/seasonal/parcel.ts';
if(!process.argv.includes('--live')){console.log('Use node --experimental-transform-types scripts/check-land-sources.mjs --live [output.json]. Calls public raster providers; this is not field validation.');process.exit(0);}
const cases=[
 {country:'TGO',name:'Secteur du lac Togo',lon:1.43,lat:6.24},
 {country:'BEN',name:'Centre nominal du lac Nokoué',lon:2.45,lat:6.433333},
 {country:'BFA',name:'Secteur de la retenue de Bagré',lon:-.55,lat:11.55},
 {country:'GHA',name:'Secteur du lac Volta',lon:0,lat:7},
 {country:'CIV',name:'Secteur de la retenue de Kossou',lon:-5.48,lat:7.17},
 {country:'SEN',name:'Secteur du lac de Guiers',lon:-15.85,lat:16.25},
];
const output={generatedAt:new Date().toISOString(),scope:'Provider integration checks on small public geographic sectors. Names locate a sector; no independent ground truth, cadastral status or crop suitability claimed.',fieldValidation:false,results:[]};
for(let i=0;i<cases.length;i+=2){
 await Promise.all(cases.slice(i,i+2).map(async c=>{
  const d=.0002,geometry=polygonFromPoints([[c.lon-d,c.lat-d],[c.lon+d,c.lat-d],[c.lon+d,c.lat+d],[c.lon-d,c.lat+d]]);
  try{const a=await loadLandAssessment(geometry);output.results.push({...c,geometry,assessment:a});console.log(c.country,c.name,a.status,Object.entries(a.fractions).filter(([,f])=>f.fraction>1e-6).map(([k,f])=>`${k}=${(100*f.fraction).toFixed(2)}%`).join(', '));}
  catch(e){output.results.push({...c,geometry,error:String(e)});console.log(c.country,String(e));}
 }));
}
const destination=process.argv[process.argv.indexOf('--live')+1]??'docs/verification-terrain-2026-10-31.json';
await writeFile(destination,JSON.stringify(output,null,2)+'\n');console.log('Saved',destination);
