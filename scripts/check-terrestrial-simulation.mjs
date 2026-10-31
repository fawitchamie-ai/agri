import {loadLandAssessment} from '../lib/seasonal/land-provider.ts';
import {loadEnvironment} from '../lib/seasonal/environment.ts';
import {polygonFromPoints} from '../lib/seasonal/parcel.ts';
import {terrestrialSoilPoint} from '../lib/seasonal/land.ts';
import {automaticCampaign,mergeEnvironment} from '../lib/seasonal/automatic.ts';
import {emptyCampaign} from '../lib/seasonal/example.ts';
import {declareScenario} from '../lib/seasonal/provenance.ts';
import {planWater} from '../lib/seasonal/engine.ts';
import {writeFile} from 'node:fs/promises';
if(!process.argv.includes('--live')){console.log('Usage: node --use-env-proxy --experimental-transform-types scripts/check-terrestrial-simulation.mjs --live [output.json]');process.exit(0);}
const destination=process.argv[process.argv.indexOf('--live')+1]??'/tmp/agri-terrestrial-verification.json';
const cases=[['TGO',1.2,9.5],['BEN',2.4,9.3],['BFA',-1.6,12.3],['GHA',-1.1,8],['CIV',-5.5,7.5],['SEN',-14.5,14.4]];
const selectedCountry=process.argv.includes('--country')?process.argv[process.argv.indexOf('--country')+1]:null;
if(selectedCountry&&!cases.some(c=>c[0]===selectedCountry))throw new Error('Unknown country');
const results=[];
for(const [country,lon,lat] of cases.filter(c=>!selectedCountry||c[0]===selectedCountry)){
 const d=process.argv.includes('--half-size')?Number(process.argv[process.argv.indexOf('--half-size')+1]):.0004;
 if(!Number.isFinite(d)||d<=0||d>.1)throw new Error('Invalid half-size');
 const geometry=polygonFromPoints([[lon-d,lat-d],[lon+d,lat-d],[lon+d,lat+d],[lon-d,lat+d]]),now=new Date().toISOString(),start=now.slice(0,10);
 const a=await loadLandAssessment(geometry),point=terrestrialSoilPoint(a);
 const e=await loadEnvironment(lat,lon,country,start,125,fetch,now,geometry,true,point);e.landAssessment=a;
 let c=automaticCampaign({...emptyCampaign(start),country,parcelGeometry:geometry,latitude:lat,longitude:lon});c=declareScenario(mergeEnvironment(c,e));
 const wholePlan=planWater(c,[],{requireGeometry:true});
 if(a.candidateAreaM2>0)c={...c,landSelection:'potentialLand'}; // Explicit test scenario selection, like the UI button.
 const plan=planWater(c,[],{requireGeometry:true});
 const result={country,point,drawnAreaM2:a.areaM2,selection:c.landSelection??'whole',calculationAreaM2:plan.calculationArea?.areaM2,wholeContourStatus:wholePlan.status,land:a.status,fractions:Object.fromEntries(Object.entries(a.fractions).map(([k,v])=>[k,v.fraction])),sources:a.sources.map(s=>({id:s.id,status:s.status,reason:s.reason,limitations:s.limitations})),soil:{ph:e.soil.ph,organicC:e.soil.organicC,totalN:e.soil.totalN,cec:e.soil.cec,sand:e.soil.sand,clay:e.soil.clay,hydraulicLayers:e.soil.hydraulicLayers},weatherDays:e.weather.length,plan:{status:plan.status,complete:plan.complete,days:plan.days.length,missing:plan.missing,fieldM3:plan.totals.fieldM3},warnings:e.warnings};results.push(result);console.log(country,JSON.stringify({land:result.land,ph:result.soil.ph,horizons:result.soil.hydraulicLayers?.length??0,weatherDays:result.weatherDays,plan:result.plan}));await writeFile(destination,JSON.stringify({generatedAt:new Date().toISOString(),scope:'Six real public-source integration samples, one per country. Conditional water scenarios after explicit acceptance of assumptions; not all parcels, ground truth, yield forecasts or production-session checks.',results},null,2));
}

if(results.some(r=>!r.plan.complete||r.soil.ph===null||!r.soil.hydraulicLayers))process.exitCode=1;
