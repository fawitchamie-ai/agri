import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceEt0,loadNasaHistory,mergeNasa} from '../lib/seasonal/nasa.ts';
import {salinityScenario,SALINITY_PROFILES,parseSalinityInput} from '../lib/seasonal/salinity.ts';
import {dataReadiness} from '../lib/seasonal/data-readiness.ts';
import {planSeason,SEASONAL_KY} from '../lib/seasonal/yield.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {assessLandGeometry} from '../lib/seasonal/land.ts';
import {geometryIdentity,migrateInputs,invalidateParcel} from '../lib/seasonal/provenance.ts';
import {validateConfig} from '../lib/seasonal/validation.ts';
import type {SeasonalConfig} from '../lib/seasonal/types.ts';
const now=new Date().toISOString(),today=now.slice(0,10);
const example18={date:'2001-07-06',latitude:50.8,elevationM:100,tmin:12.3,tmax:21.5,tmean:16.9,dewpoint:237.3*Math.log(1.409/.6108)/(17.27-Math.log(1.409/.6108)),wind2m:2.078,solarMj:22.07,pressureKpa:100.1};
function fixture():SeasonalConfig{
 const c=applyCropProfile(exampleCampaign(today),'maize');c.waterCondition='drained';c.systemDomain='upland';c.areaM2=10000;c.weather=[];
 c.parcelGeometry={type:'Polygon',coordinates:[[[1,8],[1.002,8],[1.002,8.002],[1,8.002],[1,8]]]};c.landSelection='potentialLand';
 c.landAssessment=assessLandGeometry(c.parcelGeometry,[{id:'worldcover',status:'available',provider:'Synthetic',product:'Synthetic',version:'test',referencePeriod:null,observedAt:null,acquiredAt:now,resolutionM:10,crs:'EPSG:4326',cells:[{id:'land',geometry:c.parcelGeometry,value:40}],reason:null,assets:[],limitations:[]}]);
 c.yieldEstimation={version:'yield-input-1',method:'fao-seasonal',scopeGeometryId:geometryIdentity(c.parcelGeometry),homogeneityAssumption:'Synthetic uniform field',units:[{id:'field',sownAreaM2:4000,harvestedAreaM2:1000,areaSource:'Synthetic',reference:{kind:'scenario',kgHa:4000,denominator:'sown',source:'Hypothetical, not territorial mean',availableOn:today,context:'Synthetic test',cropId:'maize',independentYm:true}}]};return c;
}
const params=(c:SeasonalConfig)=>({ecDsM:2.7,depthM:2,source:'Synthetic seasonal root-zone ECe assumption',product:'grain',noOtherLimitation:true,rootzoneSeasonAverage:true,method:'saturated_paste_25C',availableOn:today,period:{from:c.sowingDate,to:new Date(Date.parse(c.sowingDate)+365*86400000).toISOString().slice(0,10)}});
function api(){
 const data={T2M:25,T2M_MIN:20,T2M_MAX:30,T2MDEW:18,RH2M:70,WS2M:2,PRECTOTCORR:3,ALLSKY_SFC_SW_DWN:20,PS:100};
 const units={T2M:'C',T2M_MIN:'C',T2M_MAX:'C',T2MDEW:'C',RH2M:'%',WS2M:'m/s',PRECTOTCORR:'mm/day',ALLSKY_SFC_SW_DWN:'MJ/m^2/day',PS:'kPa'};
 return {header:{time_standard:'UTC',fill_value:-999,api:{version:'synthetic'},sources:['Synthetic']},geometry:{coordinates:[1,9.5,100]},parameters:Object.fromEntries(Object.entries(units).map(([k,u])=>[k,{units:u}])),properties:{parameter:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,{'20250101':v,'20250102':v,'20250103':v}]))}};
}
test('daily FAO56 ET0 reproduces published example 18 and rejects invalid meteorology',()=>{
 assert.ok(Math.abs(referenceEt0(example18)!-3.88)<.05);for(const change of [{tmin:30},{solarMj:-1},{pressureKpa:0},{wind2m:NaN},{dewpoint:80},{elevationM:9000}])assert.equal(referenceEt0({...example18,...change}),null);
});
test('NASA contract enforces units, UTC, missing values, historical availability and full ET0 ingredients',async()=>{
 const raw=api();raw.properties.parameter.PRECTOTCORR['20250102']=-999;raw.properties.parameter.T2MDEW['20250103']=-999;
 const f=(async(url:URL|RequestInfo)=>{const u=new URL(String(url));assert.equal(u.searchParams.get('time-standard'),'UTC');assert.equal(u.searchParams.get('community'),'AG');return Response.json(raw);}) as typeof fetch;
 const result=await loadNasaHistory(9.5,1.2,'2025-01-01','2025-01-03',today,f,now);assert.equal(result.availableDays,3);assert.equal(result.weather[1].rainMm,null);assert.equal(result.weather[2].et0Mm,null);assert.ok(result.weather[0].et0Mm!>0);assert.equal(result.weather[0].status,'estimated');assert.equal(result.weather[0].provenance!.et0Mm.origin,'automatic');assert.equal(result.weather[0].provenance!.et0Mm.acquiredAt,now);
 raw.parameters.PS.units='Pa';await assert.rejects(()=>loadNasaHistory(9.5,1.2,'2025-01-01','2025-01-03',today,f,now),/Unité/);raw.parameters.PS.units='kPa';raw.header.time_standard='LST';await assert.rejects(()=>loadNasaHistory(9.5,1.2,'2025-01-01','2025-01-03',today,f,now),/temporel/);
 await assert.rejects(()=>loadNasaHistory(9.5,1.2,today,'2099-01-01',today,f,now),/historique/);await assert.rejects(()=>loadNasaHistory(9.5,1.2,'2025-01-01','2025-01-03','2025-01-04',f,now),/historique/);
});
test('NASA merge preserves measured/manual values, source metadata, cycle and advice-date scope',async()=>{
 let c=fixture();c.sowingDate='2025-01-01';c.weather=[{date:'2025-01-01',rainMm:7,et0Mm:null,status:'estimated',source:'Local manually edited',availableAt:now}];c=migrateInputs(c);c.inputs!.values['weather.2025-01-01.rainMm'].origin='manual';
 const rows=(await loadNasaHistory(9.5,1.2,'2025-01-01','2025-01-03',today,(async()=>Response.json(api())) as typeof fetch,now)).weather;
 const merged=validateConfig(mergeNasa(c,[...rows,{...rows[0],date:'2099-01-01'}]));assert.equal(merged.weather[0].rainMm,7);assert.ok(merged.weather[0].et0Mm!>0);assert.equal(merged.inputs!.values['weather.2025-01-01.et0Mm'].provider,'NASA POWER');assert.equal(merged.inputs!.values['weather.2025-01-02.radiationMj'].unit,'MJ/m²/j');assert.equal(merged.weather.length,3);
 c.weather[0].status='observed';assert.equal(mergeNasa(c,rows).weather[0].et0Mm,null);
});
test('isolated salinity uses documented ECe, one initial-sown denominator, no double water/harvest penalties',()=>{
 for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN'] as const){const c=fixture();c.country=country;const p=params(c),r=salinityScenario(c,p);assert.ok(Math.abs(r.yieldKgHaSown-3520)<1e-9);assert.equal(r.productionKg,1408);assert.equal(r.productionKgHaContour,1408);assert.equal(r.status,'conditional_unvalidated');
  c.salinity=parseSalinityInput(p);const dry=planSeason(c);assert.equal(dry.salinity!.status,'conditional_unvalidated');assert.equal(dry.yieldEstimation!.scenarios[0].totals,null);c.fallback={label:'Synthetic wet scenario',et0MmDay:4,rainMmDay:10};assert.deepEqual(planSeason(c).salinity,dry.salinity);
  const restored=validateConfig(JSON.parse(JSON.stringify(c)));assert.deepEqual(restored.salinity,c.salinity);assert.equal(invalidateParcel(c).salinity,undefined);
 }
 assert.equal(Object.keys(SALINITY_PROFILES).length,6);
});
test('salinity refuses wrong method, insufficient root/season scope, unavailable data, harvest denominator and absent independent reference',()=>{
 const c=fixture(),p=params(c);for(const change of [{ecDsM:20},{depthM:.01},{method:'EC1:5'},{rootzoneSeasonAverage:false},{noOtherLimitation:false},{product:'seed'},{availableOn:'2099-01-01'},{period:{from:today,to:today}}])assert.throws(()=>salinityScenario(c,{...p,...change}));
 c.yieldEstimation!.units[0].reference!.denominator='harvested';assert.throws(()=>salinityScenario(c,p),/semé/);c.yieldEstimation!.units[0].reference=null;assert.throws(()=>salinityScenario(c,p),/référence/);c.cropProfile!.id='millet';assert.throws(()=>salinityScenario(c,p),/non paramétrée/);
 const forged=fixture();forged.salinity=parseSalinityInput(params(forged));forged.yieldEstimation!.units[0].sownAreaM2=1e8;assert.throws(()=>planSeason(forged),/supérieure/);
});
test('source readiness lists real gaps and does not invent national Ym or arbitrary temperature/nutrient penalties',()=>{
 for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN'] as const){const c=fixture();c.country=country;const r=dataReadiness(c);assert.match(r.remaining.map(x=>x.required.join(' ')).join(' '),/Validation spatiale/);assert.match(r.sources.find(s=>s.name==='GAEZ v5')!.status,/not_used/);assert.equal(r.parameterizedHydricCrops.length,9);}
 assert.equal(SEASONAL_KY.onion,1.1);assert.equal(SEASONAL_KY['bell-pepper'],1.1);assert.equal(SEASONAL_KY.millet,undefined);
});

test('official FAOSTAT snapshot keeps national harvested denominator, raw units, flags, missing crops and acquisition dates',async()=>{
 const {historicalContext}=await import('../lib/seasonal/historical-context.ts');
 for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN'] as const){const h=historicalContext(country,'maize',today);assert.equal(h.status,'context_only');assert.equal(h.rows.length,5);assert.equal(h.denominator,'harvested');assert.equal(h.independentYm,false);assert.match(h.archiveSha256,/^[a-f0-9]{64}$/);for(const r of h.rows){assert.equal(r.yieldKgHaHarvested?.rawUnit,'kg/ha');assert.ok(r.yieldKgHaHarvested!.value!>0);}}
 const ci=historicalContext('CIV','maize',today).rows.find(r=>r.year===2024)!;assert.equal(ci.productionT!.value,1640661);assert.equal(ci.productionT!.flag,'A');assert.equal(ci.areaHa!.value,640000);assert.equal(ci.areaHa!.flag,'X');assert.equal(ci.areaHa!.note,'Unofficial figure');assert.equal(ci.yieldKgHaHarvested!.value,2563.5);assert.equal(ci.yieldKgHaHarvested!.flag,'E');
 assert.equal(historicalContext('CIV','maize','2025-01-01').status,'not_available_as_of');assert.equal(historicalContext('CIV','maize','2025-01-01').rows.length,0);assert.equal(historicalContext('TGO','unknown',today).status,'unavailable');assert.equal(historicalContext('TGO','onion',today).status,'unavailable');assert.equal(historicalContext('TGO','onion',today).rows.length,0);assert.ok(historicalContext('GHA','cucumber',today).rows[0].warnings.length);assert.match(historicalContext('TGO','rice-upland',today).product!.scope,/tous systèmes/);
 const c=fixture(),before=planSeason(c).yieldEstimation;dataReadiness(c);assert.deepEqual(planSeason(c).yieldEstimation,before);
});

test('large campaign snapshots compress below D1 row limit, preserve every value, and read legacy JSON',async()=>{
 const {encodeCampaignSnapshot,decodeCampaignValue}=await import('../lib/seasonal/storage.ts');
 const input={weather:Array.from({length:366},(_,day)=>({day,provenance:Array.from({length:8},()=>({source:'Synthetic long provenance '.repeat(30),value:12.5,unit:'mm'}))}))};
 assert.ok(JSON.stringify(input).length>2000000);const packed=encodeCampaignSnapshot(input,[],input);assert.ok(Object.values(packed).reduce((n,s)=>n+Buffer.byteLength(s),0)<1800000);assert.deepEqual(decodeCampaignValue(packed.config),input);assert.deepEqual(decodeCampaignValue(JSON.stringify({old:true})),{old:true});assert.throws(()=>decodeCampaignValue(JSON.stringify({encoding:'agri-deflate-json-1',data:'bad compressed payload'})));const {randomBytes}=await import('node:crypto');assert.throws(()=>encodeCampaignSnapshot({data:randomBytes(1800000).toString('base64')},[],{}),/trop volumineuse/);
});

test('production health identifies seasonal models, six real national references and the executing storage codec',async()=>{
 const {seasonalHealth}=await import('../lib/seasonal/health.ts');const h=seasonalHealth();assert.equal(h.kyCrops,9);assert.equal(h.nationalCountries,6);assert.equal(h.storage,'ok');assert.equal(h.version,'source-models-2026-10-31');assert.match(h.nationalArchiveSha256,/^[a-f0-9]{64}$/);
});
