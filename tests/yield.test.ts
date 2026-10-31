import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateProduction,planSeason,yieldCsv,type YieldInput} from '../lib/seasonal/yield.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {assessLandGeometry,multiArea,type LandLayer} from '../lib/seasonal/land.ts';
import {validateParcel,parcelMetrics,type ParcelPolygon} from '../lib/seasonal/parcel.ts';
import {geometryIdentity} from '../lib/seasonal/provenance.ts';
import type {SeasonalConfig,WaterEvent} from '../lib/seasonal/types.ts';
const now=new Date().toISOString(),today=now.slice(0,10);
const box=(x=1,y=8,w=.001,h=.001):ParcelPolygon=>({type:'Polygon',coordinates:[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]]});
function fixture(shape:ParcelPolygon=box(),mixed=false):SeasonalConfig{
 const c=applyCropProfile(exampleCampaign(today),'maize');c.parcelGeometry=shape;c.areaM2=parcelMetrics(shape).areaM2;c.waterCondition='drained';
 const layer:LandLayer={id:'worldcover',status:'available',provider:'Synthetic',product:'Test',version:'test',referencePeriod:null,observedAt:null,acquiredAt:now,resolutionM:10,crs:'EPSG:4326',cells:mixed?[{id:'land',geometry:box(1,8,.0004),value:40},{id:'water',geometry:box(1.0004,8,.0006),value:80}]:[{id:'land',geometry:shape,value:40}],reason:null,assets:[],limitations:[]};
 c.landAssessment=assessLandGeometry(shape,[layer],now);if(mixed)c.landSelection='potentialLand';
 c.yieldEstimation={version:'yield-input-1',method:'declared-scenario',scopeGeometryId:geometryIdentity(shape),homogeneityAssumption:'Synthetic uniform unit',units:[{id:'field',sownAreaM2:c.landAssessment.candidateAreaM2,harvestedAreaM2:null,areaSource:'Synthetic known area',reference:{kind:'scenario',kgHa:4000,denominator:'sown',source:'Hypothetical 4 t/ha',availableOn:today,context:'Synthetic, not validated',cropId:'maize',independentYm:false}}]};
 return c;
}
const result=(c:SeasonalConfig,events:WaterEvent[]=[])=>planSeason(c,events).yieldEstimation!;
test('reference 1 ha / 0.4 ha : 4 t / 1.6 t; denominators and conversions',()=>{
 const all=aggregateProduction([{sownAreaM2:10000,productionKg:4000}],10000),mixed=aggregateProduction([{sownAreaM2:4000,productionKg:1600}],10000);
 assert.equal(all.productionKg/1000,4);assert.equal(mixed.productionKg/1000,1.6);assert.equal(mixed.yieldKgHaSown,4000);assert.equal(mixed.productionKgHaContour,1600);
 const a=result(fixture()),b=result(fixture(box(),true));
 assert.ok(Math.abs(b.surface.sownM2!/a.surface.sownM2!-.4)<1e-7);
 for(const e of [a,b])assert.equal(e.scenarios[0].totals?.yieldKgHaSown,4000);
 assert.ok(Math.abs(b.scenarios[0].totals!.productionKg/a.scenarios[0].totals!.productionKg-.4)<1e-7);
 assert.match(yieldCsv(b),/production_t/);
});
test('holes preserved and disjoint components retained; overlap/outside/partial partition refused',()=>{
 const hole=box(1.0002,8.0002,.0002,.0002).coordinates[0],shape=box();shape.coordinates.push(hole);
 validateParcel(shape);const c=fixture(shape),e=result(c);
 assert.ok(Math.abs(e.surface.drawnM2!-(parcelMetrics(box()).areaM2-parcelMetrics({type:'Polygon',coordinates:[hole]}).areaM2))<1e-6);
 assert.equal(c.landAssessment!.fractions.potentialLand.geometry.coordinates[0].length,2);
 const d=fixture(),u=d.yieldEstimation!.units[0];d.yieldEstimation!.units=[{...u,id:'west',geometry:{type:'MultiPolygon',coordinates:[box(1,8,.0005).coordinates]},sownAreaM2:1000},{...u,id:'east',geometry:{type:'MultiPolygon',coordinates:[box(1.0005,8,.0005).coordinates]},sownAreaM2:1000,reference:{...u.reference!,kgHa:2000}}];
 const r=result(d);assert.equal(r.scenarios[0].totals!.productionKg,600);assert.equal(r.scenarios[0].totals!.yieldKgHaSown,3000);
 d.yieldEstimation!.units[1].geometry=d.yieldEstimation!.units[0].geometry;assert.throws(()=>result(d),/chevauchent/);
 d.yieldEstimation!.units=[d.yieldEstimation!.units[0]];assert.match(result(d).missing.join(' '),/incomplète/);
 d.yieldEstimation!.units[0].geometry={type:'MultiPolygon',coordinates:[box(2,9).coordinates]};assert.throws(()=>result(d),/dépasse/);
 const split=fixture();split.yieldEstimation!.units[0].sownAreaM2=1000;split.yieldEstimation!.units[0].geometry={type:'MultiPolygon',coordinates:[box(1,8,.0003).coordinates,box(1.0007,8,.0003).coordinates]};assert.match(result(split).missing.join(' '),/incomplète/);
 const outside=box();outside.coordinates.push(box(2,9,.0001,.0001).coordinates[0]);assert.throws(()=>validateParcel(outside),/hors/);
});
test('missing reference, sown area, water-only, unknown and unparameterised crops never invent yields',()=>{
 for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN'] as const){const c=fixture();c.country=country;assert.equal(result(c).status,'conditional');}
 const c=fixture();c.yieldEstimation!.units[0].reference=null;assert.equal(result(c).scenarios[0].totals,null);
 c.yieldEstimation!.units[0].sownAreaM2=null;assert.match(result(c).missing.join(' '),/manquante/);
 for(const value of [80,null]){const d=fixture();d.landAssessment=assessLandGeometry(d.parcelGeometry!,[{...d.landAssessment!.sources[0],cells:[{id:'water',value,geometry:d.parcelGeometry!}]}]);assert.equal(result(d).status,'unavailable');}
 const d=fixture();d.yieldEstimation!.method='fao-seasonal';d.cropProfile!.id='millet';d.crop='Mil perlé';assert.match(result(d).missing.join(' '),/sans modèle/);
});
test('harvested denominator documented; destruction is never charged twice',()=>{
 const c=fixture(),u=c.yieldEstimation!.units[0];u.sownAreaM2=1000;u.harvestedAreaM2=500;
 const initial=result(c);assert.equal(initial.scenarios[0].totals!.productionKg,400);
 u.reference!.denominator='harvested';assert.equal(result(c).scenarios[0].totals!.productionKg,200);assert.equal(result(c).scenarios[0].totals!.yieldKgHaSown,2000);
 u.harvestedAreaM2=null;assert.match(result(c).scenarios[0].missing.join(' '),/récoltée/);
 u.harvestedAreaM2=1100;assert.throws(()=>result(c),/dépasser/);
});
test('FAO full cycle, independent Ym, no pH multiplier; planned irrigation is never recorded',()=>{
 const c=fixture(),u=c.yieldEstimation!.units[0];u.sownAreaM2=1000;c.yieldEstimation!.method='fao-seasonal';u.reference!.independentYm=true;
 c.fallback={label:'Synthetic moderate rainfall',et0MmDay:4,rainMmDay:2};c.system.sourceBudgetM3=1e5;
 const e=result(c),rain=e.scenarios[0],actual=e.scenarios[1],proposed=e.scenarios[2];
 assert.ok(rain.totals);assert.deepEqual(rain.totals,actual.totals);assert.ok(proposed.totals!.productionKg>actual.totals!.productionKg);
 const event:WaterEvent={id:'planned',date:today,kind:'irrigation',amount:25,unit:'mm',point:'net',status:'planned',source:'Synthetic planned',recordedAt:now};
 assert.deepEqual(result(c,[event]).scenarios[1].totals,actual.totals);
 event.status='declared';assert.ok(result(c,[event]).scenarios[1].totals!.productionKg>actual.totals!.productionKg);assert.deepEqual(result(c,[event]).scenarios[0].totals,rain.totals);
 c.soilAnalyses=[{source:'Synthetic pH',date:today,availableOn:today,topCm:0,bottomCm:20,status:'declared',measurements:[{parameter:'pH',value:4.5,unit:'pH',method:'water'}]}];assert.deepEqual(result(c).scenarios[1].totals,actual.totals);
 u.reference!.independentYm=false;assert.match(result(c).scenarios[0].missing.join(' '),/indépendant/);
 u.reference!.independentYm=true;c.fallback=null;c.weather=[];assert.equal(result(c).scenarios[0].totals,null);
 c.fallback={label:'Synthetic extreme drought',et0MmDay:10,rainMmDay:0};assert.equal(result(c).scenarios[0].totals,null);
 c.waterCondition='submerged';assert.equal(result(c).scenarios[2].totals,null);
});
test('forged areas, future references and changed geometry rejected; water volumes use sown area',()=>{
 const c=fixture();c.yieldEstimation!.units[0].sownAreaM2=1e8;assert.throws(()=>result(c),/supérieure/);
 c.yieldEstimation!.units[0].sownAreaM2=1000;
 const p=planSeason(c);assert.equal(p.calculationArea!.areaM2,1000);
 c.yieldEstimation!.units[0].reference!.availableOn='2099-01-01';assert.throws(()=>result(c),/disponibilité/);
 c.yieldEstimation!.units[0].reference!.availableOn=today;c.yieldEstimation!.scopeGeometryId='forged';assert.equal(result(c).status,'unavailable');
});
test('spatial heterogeneity uses separate water balances and explicit event scope',()=>{
 const c=fixture(),base=c.yieldEstimation!.units[0];c.yieldEstimation!.method='fao-seasonal';
 c.fallback={label:'Synthetic rainfall',et0MmDay:4,rainMmDay:2};
 const west=box(1,8,.0005),east=box(1.0005,8,.0005);
 c.yieldEstimation!.units=[{...base,id:'west',geometry:{type:'MultiPolygon',coordinates:[west.coordinates]},sownAreaM2:1000,reference:{...base.reference!,independentYm:true}}, {...base,id:'east',geometry:{type:'MultiPolygon',coordinates:[east.coordinates]},sownAreaM2:1000,reference:{...base.reference!,independentYm:true},conditions:{soil:{...c.soil,layers:c.soil.layers.map(l=>({...l,initialTheta:l.thetaFC}))},weather:[],waterCondition:'drained'}}];
 const e=result(c);assert.ok(e.scenarios[0].totals);assert.notEqual(e.scenarios[0].units[0].productionKg,e.scenarios[0].units[1].productionKg);assert.equal(e.scenarios[2].totals,null);
 const event:WaterEvent={id:'irrigation',date:today,kind:'irrigation',amount:20,unit:'mm',point:'net',status:'declared',source:'Synthetic',recordedAt:now};
 assert.match(result(c,[event]).scenarios[1].missing.join(' '),/affecter/);
 event.unitId='west';assert.ok(result(c,[event]).scenarios[1].totals);
});
test('each advertised FAO crop accepts only its own independent reference with a complete parametrised cycle',()=>{
 for(const cropId of ['maize','sorghum','soybean','groundnut','tomato','cabbage','watermelon']){
  const c=applyCropProfile(fixture(),cropId,[20,35,40,30]);c.yieldEstimation!.method='fao-seasonal';c.yieldEstimation!.units[0].reference={...c.yieldEstimation!.units[0].reference!,cropId,independentYm:true};
  c.fallback={label:'Synthetic wet scenario',et0MmDay:4,rainMmDay:5};
  const e=result(c);assert.ok(e.scenarios[0].totals,JSON.stringify(e));
 }
});
