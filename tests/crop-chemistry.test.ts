import test from 'node:test';
import assert from 'node:assert/strict';
import { CROPS, applyCropProfile, depletionAtDemand } from '../lib/seasonal/catalog.ts';
import { AGRONOMY_SOURCES } from '../lib/seasonal/sources.ts';
import { chemistryGuidance, type SoilAnalysis } from '../lib/seasonal/chemistry.ts';
import { NUTRITION_REFERENCES, nutritionEligibility, referenceQuantities } from '../lib/seasonal/nutrition.ts';
import { exampleCampaign } from '../lib/seasonal/example.ts';
import { validateConfig } from '../lib/seasonal/validation.ts';
import { planWater } from '../lib/seasonal/engine.ts';
import { seasonalCapabilities } from '../lib/seasonal/capabilities.ts';
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const maize=()=>({...applyCropProfile(exampleCampaign('2026-10-01'),'maize'),territory:'Kozah'});
const context='Référence historique Kozah, exemple de calcul uniquement, sol non diagnostiqué.';
const analysis=():SoilAnalysis=>({date:'2026-09-01',availableOn:'2026-09-04',source:'Laboratoire fictif — test',topCm:0,bottomCm:20,status:'measured',measurements:[{parameter:'availableP',value:12,unit:'mg/kg',method:'Olsen-Dabin'}]});

test('Capacités : archives et fiches ne valident pas automatiquement les conseils ni les parcelles',()=>{
  for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN'] as const){
    const c=seasonalCapabilities(country,'maize');
    assert.equal(c.seasonalYieldForecast.status,'blocked');
    assert.equal(c.personalizedFertilization.status,'blocked');
    assert.equal(c.prospectiveValidation.status,'not_started');
    assert.equal(c.chemicalCropProtection.status,'blocked');
  }
  assert.equal(seasonalCapabilities('CIV','maize').historicalData.observations,null);
  assert.equal(seasonalCapabilities('SEN','maize').historicalData.lastYear,2015);
  assert.equal(seasonalCapabilities('TGO','maize').historicalData.territories,34);
  assert.equal(seasonalCapabilities('BEN','maize').nutritionReferences.count,0);
  assert.equal(seasonalCapabilities('TGO','rice-flooded').waterSimulation.status,'blocked');
});

test('Catalogue : toutes les valeurs chiffrées renvoient à une source identifiée',()=>{
  assert.equal(new Set(CROPS.map(c=>c.id)).size,CROPS.length);
  assert.equal(new Set(AGRONOMY_SOURCES.map(c=>c.id)).size,AGRONOMY_SOURCES.length);
  const ids=new Set(AGRONOMY_SOURCES.map(s=>s.id));
  for(const p of CROPS){
    if(p.ecology)assert.ok(ids.has(p.ecology.sourceId));
    for(const id of p.water?.sourceIds??[])assert.ok(ids.has(id));
    if(p.water){assert.equal(p.water.kc.length,3);assert.equal(p.water.stageExampleDays.length,4);}
    if(p.eceThresholdDsM)assert.ok(p.water?.sourceIds.includes('fao56-root'));
  }
  for(const r of NUTRITION_REFERENCES)assert.ok(ids.has(r.sourceId));
  for(const s of AGRONOMY_SOURCES)assert.match(s.sha256,/^[a-f0-9]{64}$/);
});
test('Cultures : changement de fiche renouvelle les paramètres, inconnus non remplacés par le maïs',()=>{
  const c=maize(),o=applyCropProfile(c,'onion');
  assert.notDeepEqual(o.stages,c.stages);assert.equal(o.stages[0].depletionFraction,.3);
  assert.equal(o.stages[0].kcStart,.7);
  for(const id of ['rice-upland','yam','okra','hot-pepper','fonio','bambara']){
    const next=applyCropProfile(c,id);assert.deepEqual(next.stages,[]);assert.throws(()=>planWater(next));
  }
  for(const id of ['sorghum','cowpea','sesame'])assert.throws(()=>applyCropProfile(c,id),/Durées/);
  const flooded=applyCropProfile(c,'rice-flooded');
  flooded.stages=c.stages;flooded.systemDomain='upland';
  assert.equal(planWater(flooded).status,'blocked');
});
test('Cultures : tous les exemples hydriques se ferment, sans validation locale implicite',()=>{
  for(const p of CROPS.filter(p=>p.water?.automaticExample)){
    const result=planWater(applyCropProfile(exampleCampaign('2026-10-01'),p.id));
    assert.ok(result.complete,p.id);assert.equal(result.levelOfEvidence,'simulation_non_validee');
    for(const d of result.days)close(d.balanceResidualMm,0);
  }
  close(depletionAtDemand(.55,5),.55);close(depletionAtDemand(.55,10),.35);
  assert.equal(depletionAtDemand(.9,0),.8);
});
test('Analyses : méthodes et unités conservées, dates futures et mélanges rejetés',()=>{
  const c=maize();c.soilAnalyses=[analysis()];
  assert.deepEqual(validateConfig(c).soilAnalyses,c.soilAnalyses);
  for(const mutation of [
    (a:SoilAnalysis)=>{a.date='2026-10-02'},
    (a:SoilAnalysis)=>{a.availableOn='2026-10-02'},
    (a:SoilAnalysis)=>{a.availableOn='2026-08-31'},
    (a:SoilAnalysis)=>{delete (a as Partial<SoilAnalysis>).availableOn},
    (a:SoilAnalysis)=>{a.bottomCm=0},
    (a:SoilAnalysis)=>{a.measurements[0].unit='kg/ha'},
    (a:SoilAnalysis)=>{a.measurements[0].method='water'},
    (a:SoilAnalysis)=>{a.measurements.push({...a.measurements[0]})},
    (a:SoilAnalysis)=>{a.measurements[0].value=NaN},
  ]){const a=analysis();mutation(a);assert.throws(()=>validateConfig({...c,soilAnalyses:[a]}));}
  const a=analysis();a.measurements[0].method='other:Extraction laboratoire documentée';
  assert.equal(validateConfig({...c,soilAnalyses:[a]}).soilAnalyses![0].measurements[0].method,a.measurements[0].method);
});
test('Chimie : ECe et EC diluée distinctes, salinité propre à la culture et aucune dose inventée',()=>{
  const a=analysis();a.measurements=[{parameter:'EC',value:2,unit:'dS/m',method:'1:5'}];
  const diluted=chemistryGuidance('maize',[a]);assert.ok(diluted.some(x=>x.includes('non comparable')));assert.ok(!diluted.some(x=>x.includes('dépasse')));
  a.measurements[0].method='saturated_paste';
  assert.ok(chemistryGuidance('maize',[a]).some(x=>x.includes('dépasse')));
  assert.ok(!chemistryGuidance('sorghum',[a]).some(x=>x.includes('dépasse')));
  assert.ok(chemistryGuidance('soybean',[]).some(x=>x.includes('Nodulation')));
});
test('Nutrition : périmètres pays/culture/territoire/variété stricts',()=>{
  const c=maize(),r=NUTRITION_REFERENCES.find(r=>r.id==='tgo-kozah-maize')!;
  assert.deepEqual(nutritionEligibility(r,c),[]);
  for(const override of [{country:'BEN' as const},{territory:'Oti'},{crop:'Soja'},{systemDomain:'flooded_rice' as const}])assert.throws(()=>referenceQuantities(r.id,{...c,...override},context));
  const civ={...c,country:'CIV' as const,variety:'Inconnue'};
  assert.throws(()=>referenceQuantities('civ-fmb-maize',civ,context),/Variété/);
  civ.variety='FMB';assert.equal(referenceQuantities('civ-fmb-maize',civ,context).status,'reference_conditionnelle');
});
test('Nutrition : sacs de 50 kg, hectare, acre et N–P₂O₅–K₂O vérifiés indépendamment',()=>{
  const c=maize(),r=referenceQuantities('tgo-kozah-maize',c,context,[50,25]);
  assert.deepEqual(r.products.map(p=>p.parcelKg),[[25,25],[10,10]]);
  assert.deepEqual(r.nutrientKgHa,[[83.5,83.5],[37.5,37.5],[37.5,37.5]]);
  assert.deepEqual(r.products[0].remainingParcelKg,[20,20]);
  const gh=referenceQuantities('gha-maize-23-10-5',{...c,country:'GHA'},context);
  close(gh.products[0].parcelKg![0],100/4046.8564224*1000);
  assert.equal(r.personalizedToSoil,false);
});
test('Nutrition : inconnu reste inconnu, excédent conservé et valeurs invalides rejetées',()=>{
  const c=maize(),r=referenceQuantities('tgo-kozah-maize',c,context);
  assert.equal(r.products[0].remainingKgHa,null);
  assert.equal(referenceQuantities('tgo-kozah-maize',{...c,areaM2:null},context).products[0].parcelKg,null);
  assert.equal(referenceQuantities('tgo-kozah-maize',c,context,[300,0]).products[0].excessKgHa,50);
  for(const value of [-1,NaN,Infinity,'0'])assert.throws(()=>referenceQuantities(r.reference.id,c,context,[value as number]));
  assert.throws(()=>referenceQuantities(r.reference.id,c,'court'));
  const soy=applyCropProfile({...c,country:'CIV'},'soybean');
  assert.deepEqual(referenceQuantities('civ-soybean-tsp',soy,context).nutrientKgHa,[null,null,null]);
});
test('Nutrition : analyse chimique conservée mais aucune réponse sol/rendement simulée arbitrairement',()=>{
  const c=maize();c.nutritionReference={id:'tgo-kozah-maize',contextNote:context,alreadyKgHa:[0,0]};
  const before=planWater(c);c.soilAnalyses=[analysis()];const after=planWater(c);
  assert.deepEqual(after.nutrition,before.nutrition);assert.deepEqual(after.totals,before.totals);
  assert.ok(after.assumptions.some(x=>x.includes('aucune fonction locale')));
  const restored=JSON.parse(JSON.stringify(c));assert.deepEqual(planWater(restored),after);
});
