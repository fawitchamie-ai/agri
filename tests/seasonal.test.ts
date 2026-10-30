import test from 'node:test';
import assert from 'node:assert/strict';
import { planWater, waterVolumes, upsertEvent, waterPlanCsv } from '../lib/seasonal/engine.ts';
import { exampleCampaign } from '../lib/seasonal/example.ts';
import { validateConfig, addDays } from '../lib/seasonal/validation.ts';
import { nutrientBalance } from '../lib/seasonal/agronomy.ts';
import { loadForecast } from '../lib/seasonal/weather.ts';
import { COUNTRIES, type WaterEvent } from '../lib/seasonal/types.ts';

const close = (a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const config = () => exampleCampaign('2026-10-01');
const event = (overrides: Partial<WaterEvent> = {}):WaterEvent=>({id:'rain-1',kind:'rain',date:'2026-10-01',amount:10,unit:'mm',point:'field',status:'measured',source:'Synthetic test fixture',recordedAt:'2026-10-01T08:00:00Z',...overrides});
const oneDay = () => {const c=config();c.soil.layers=[{thicknessM:1,thetaFC:.3,thetaWP:.1,initialTheta:.25}];c.stages=[{name:'Stade de test',days:1,kcStart:1,kcEnd:1,rootStartM:1,rootEndM:1,depletionFraction:.5}];c.asOfDate='2026-10-02';return c;};

test('Irrigation : conversions net/champ/source et débit au même point',()=>{
  const c=config();c.system.applicationEfficiency=.75;c.system.transportEfficiency=.8;
  const v=waterVolumes(12,c);close(v.fieldMm!,16);close(v.fieldLitres!,16000);close(v.fieldM3!,16);close(v.sourceM3!,20);close(v.durationHours!,5);
  c.areaM2=null;assert.equal(waterVolumes(12,c).fieldM3,null);assert.equal(waterVolumes(12,c).netMm,12);
});
test('Irrigation : bilan manuel indépendant pluie + consommation sans arrosage passé inventé',()=>{
  const c=oneDay();c.weather=[{date:c.sowingDate,rainMm:10,et0Mm:5,status:'observed',source:'Fixture',availableAt:'2026-10-01T08:00:00Z'}];c.fallback=null;
  const p=planWater(c);assert.equal(p.complete,true);close(p.days[0].stockStartMm,150);close(p.days[0].stockEndMm,155);close(p.days[0].balanceResidualMm,0);assert.equal(p.days[0].intervention,null);
});
test('Irrigation : forte pluie répartie en rétention, ruissellement et drainage',()=>{
  const c=oneDay();c.soil.layers[0].initialTheta=.29;c.fallback={label:'Fixture heavy rain',rainMmDay:100,et0MmDay:0};c.soil.infiltrationMmDay=30;
  const d=planWater(c).days[0];close(d.rainRetainedMm,10);close(d.runoffMm,70);close(d.drainageMm,20);close(d.stockEndMm,200);close(d.balanceResidualMm,0);
});
test('Irrigation : croissance des racines expose une réserve initiale sans eau créée',()=>{
  const c=config();c.fallback={label:'Fixture no demand',rainMmDay:0,et0MmDay:0};c.soil.layers=[{thicknessM:1,thetaFC:.3,thetaWP:.1,initialTheta:.2}];c.stages=[{name:'Root expansion',days:2,kcStart:0,kcEnd:0,rootStartM:.2,rootEndM:.4,depletionFraction:.5}];c.asOfDate='2026-10-10';
  const p=planWater(c);close(p.days[0].stockEndMm,20);close(p.days[1].rootGainMm,20);close(p.days[1].stockEndMm,40);
});
test('Irrigation : tous les bilans journaliers et hebdomadaires se ferment, six pays',()=>{
  for(const country of Object.keys(COUNTRIES)){
    const c=config();c.country=country as keyof typeof COUNTRIES;const p=planWater(c);
    assert.equal(p.complete,true);assert.equal(p.days.length,125);
    for(const d of p.days){close(d.balanceResidualMm,0);assert.ok(d.stockEndMm>=-1e-8&&d.stockEndMm<=d.tawMm+1e-8);}
    for(const w of p.weeks)close(w.stockEndMm,w.stockStartMm+w.rootGainMm+w.assimilationMm+w.rainMm-w.runoffMm+w.netMm-w.drainageMm-w.actualEtMm);
  }
});
test('Irrigation : pluie réelle prioritaire, prévisions concurrentes non additionnées',()=>{
  const c=oneDay();c.weather=[{date:c.sowingDate,rainMm:40,et0Mm:5,status:'forecast',source:'Fixture forecast',availableAt:'2026-10-01T00:00:00Z'}];
  close(planWater(c,[event()]).days[0].rainMm,10);
  assert.throws(()=>planWater(c,[event(),event({id:'another-source'})]),/Une pluie/);
});
test('Irrigation : prévu et annulé ne deviennent pas des apports réels',()=>{
  const c=oneDay(), baseline=planWater(c).totals;
  for(const status of ['planned','cancelled'] as const)assert.deepEqual(planWater(c,[event({status,kind:'irrigation',amount:20,point:'net'})]).totals,baseline);
});
test('Irrigation : conversion d’un apport réel et surdose expliquée par drainage',()=>{
  const c=oneDay();c.system.applicationEfficiency=.75;
  const p=planWater(c,[event({kind:'irrigation',point:'field',amount:100,unit:'mm'})]);
  close(p.days[0].irrigationNetMm,75);close(p.days[0].drainageMm,25);close(p.days[0].intervention!.fieldM3!,100);close(p.days[0].balanceResidualMm,0);
});
test('Irrigation : manque de données bloque la prolongation, null différent de zéro',()=>{
  const c=config();c.fallback=null;
  const blocked=planWater(c);assert.equal(blocked.complete,false);assert.equal(blocked.totals.sourceM3,null);assert.equal(blocked.days.length,0);
  c.weather=[{date:c.sowingDate,rainMm:0,et0Mm:0,status:'observed',source:'Fixture',availableAt:'2026-10-01T00:00:00Z'}];
  const p=planWater(c);assert.equal(p.days.length,1);assert.ok(p.missing[0].includes('2026-10-02'));assert.equal(p.totals.remainingSourceM3,null);
});
test('Irrigation : humidité initiale indispensable, systèmes hors domaine bloqués',()=>{
  const c=config();c.soil.layers[0].initialTheta=null;assert.equal(planWater(c).days.length,0);
  const r=config();r.systemDomain='flooded_rice';assert.equal(planWater(r).status,'blocked');
});
test('Irrigation : efficacité inconnue préserve les mm, ne fabrique pas de volumes',()=>{
  const c=config();c.system.applicationEfficiency=null;const p=planWater(c);assert.equal(p.complete,true);assert.ok(p.totals.netMm>0);assert.equal(p.totals.fieldM3,null);assert.equal(p.totals.sourceM3,null);
});
test('Irrigation : quota zéro, tours d’eau et interruption laissent un déficit visible',()=>{
  const c=config();c.system.sourceBudgetM3=0;let p=planWater(c);close(p.totals.sourceM3!,0);assert.ok(p.totals.unmetEtMm>0);assert.equal(p.nextWindows.length,0);
  c.system.sourceBudgetM3=900;c.system.allowedWeekdays=[];p=planWater(c);assert.equal(p.nextWindows.length,0);
  c.system.allowedWeekdays=[0,1,2,3,4,5,6];c.system.hoursPerDay=.1;p=planWater(c);assert.ok(p.days.every(d=>d.intervention?.type!=='proposed'||(d.intervention.durationHours??0)<=.1+1e-9));
});
test('Irrigation : correction d’humidité est un ajustement d’état, pas une pluie',()=>{
  const c=oneDay();const d=planWater(c,[event({kind:'soil',unit:'fraction',amount:.2})]).days[0];close(d.rainMm,0);close(d.assimilationMm,-50);close(d.stockEndMm,95);close(d.balanceResidualMm,0);
});
test('Irrigation : rejeu après correction tardive et remplacement par identifiant stable',()=>{
  const c=config();c.asOfDate='2026-10-05';
  const a=event({kind:'irrigation',point:'net',amount:10});
  const first=upsertEvent([],a), retry=upsertEvent(first,a);assert.equal(retry.length,1);assert.deepEqual(planWater(c,retry),planWater(c,first));
  const corrected=upsertEvent(retry,{...a,amount:20,recordedAt:'2026-10-05T00:00:00Z'});assert.equal(corrected.length,1);assert.notDeepEqual(planWater(c,corrected).totals,planWater(c,first).totals);
});
test('Irrigation : contrôles physiques, temporels et types stricts',()=>{
  for(const value of [0,1.1,-1,'0.75',true,NaN]){const c=config();(c.system as any).applicationEfficiency=value;assert.throws(()=>validateConfig(c));}
  assert.throws(()=>planWater({...config(),sowingDate:'2026-02-30'}));
  const c=config();c.soil.layers[0].thetaFC=.1;assert.throws(()=>planWater(c));
  assert.throws(()=>planWater(config(),[event({date:'2026-10-02'})]),/futur/);
  const w=config();w.weather=[{date:w.sowingDate,rainMm:0,et0Mm:5,status:'forecast',source:'Future run',availableAt:'2026-10-05T00:00:00Z'}];assert.throws(()=>planWater(w),/indisponible/);
});
test('Irrigation : calendrier continu sur deux années et export complet',()=>{
  const c=exampleCampaign('2026-12-01');const p=planWater(c);assert.equal(p.horizonEnd,addDays(c.sowingDate,124));assert.ok(p.horizonEnd.startsWith('2027'));
  const csv=waterPlanCsv(p);assert.equal(csv.split('\r\n').length,126);assert.ok(csv.includes('m3_source'));
});
test('Irrigation : aucun apport si zéro eau explicite, même avec efficacités manquantes',()=>{
  const c=config();c.system.applicationEfficiency=null;c.system.sourceBudgetM3=0;const p=planWater(c);close(p.totals.netMm,0);assert.ok(p.totals.unmetEtMm>0);
});
test('Fertilisation : bilan multinutriments sans double compte du produit NPK',()=>{
  const b=nutrientBalance(1000,[100,40,40],[{name:'NPK 15-15-15',kgHa:200,compositionPercent:[15,15,15],pricePerKg:500},{name:'Urée',kgHa:100,compositionPercent:[46,0,0],pricePerKg:null}],[10,0,0]);
  assert.deepEqual(b.suppliedKgHa,[86,30,30]);assert.deepEqual(b.remainingKgHa,[14,10,10]);close(b.quantities[0].kg,20);close(b.quantities[0].cost!,10000);
  assert.throws(()=>nutrientBalance(1000,[100,40,40],[{name:'Invalid',kgHa:1,compositionPercent:[80,50,0],pricePerKg:null}]));
});
test('Météo : transport simulé, unités et null préservés, jamais qualifié comme observation',async()=>{
  let called='';const fetcher=async(input:any)=>{called=String(input);return Response.json({daily_units:{precipitation_sum:'mm',et0_fao_evapotranspiration:'mm'},daily:{time:['2026-10-01'],precipitation_sum:[null],et0_fao_evapotranspiration:[5]}});};
  const r=await loadForecast(6.1,1.2,'Africa/Lome',fetcher as typeof fetch,'2026-10-01T00:00:00Z');assert.ok(called.startsWith('https://api.open-meteo.com/'));assert.equal(r.weather[0].rainMm,null);assert.equal(r.weather[0].status,'forecast');assert.equal(r.weather[0].availableAt,'2026-10-01T00:00:00Z');
});

test('Excès d’eau : engorgement ou submersion bloque tout calendrier sans inventer de mortalité',()=>{
 for(const waterCondition of ['waterlogged','submerged'] as const){
  const c={...config(),waterCondition};const p=planWater(c);
  assert.equal(p.status,'blocked');assert.equal(p.complete,false);assert.equal(p.days.length,0);assert.deepEqual(p.nextWindows,[]);
  assert.equal(p.totals.fieldM3,null);assert.equal(p.totals.sourceM3,null);
  assert.ok(p.missing.some(m=>m.includes('suspendu')));
  assert.equal(validateConfig(c).waterCondition,waterCondition);
 }
 assert.equal(planWater({...config(),waterCondition:'drained'}).complete,true);
 assert.throws(()=>validateConfig({...config(),waterCondition:'safe'}));
});
test('Excès calculé : aucune déduction de drainage réel ni de rendement',()=>{
 const c=oneDay();c.fallback={label:'Pluie forte de test',rainMmDay:150,et0MmDay:0};
 c.soil.infiltrationMmDay=200;const p=planWater(c);assert.ok(p.days[0].drainageMm>0);assert.ok(p.assumptions.some(a=>a.includes('ne prouve pas')));
 assert.ok(p.assumptions.some(a=>a.includes('mortalité')));
});
