import test from 'node:test';
import assert from 'node:assert/strict';
import {convertApplication,nutrientBalance,parseComposition,snominApplication,productCatalog,type ProductComposition,type NutrientApplication} from '../lib/seasonal/products.ts';
import {concentrationInventory,cropEngineManifest} from '../lib/seasonal/crop-engine.ts';
import {aggregateProduction} from '../lib/seasonal/yield.ts';
function profile(overrides:Partial<ProductComposition>={}):ProductComposition{return {version:'product-composition-1',id:'test',kind:'mineral',name:'Synthetic test only',manufacturer:null,source:'Synthetic test, not advice',lot:null,analysisDate:null,evidence:'declared',scenario:null,convention:'N-P2O5-K2O',basis:'fresh',percent:[15,15,15],nForms:{urea:null,ammonium:null,nitrate:null,organic:null},moisturePercent:null,densityKgL:null,organic:null,uncertainty:'Synthetic fixture, no field calibration',...overrides};}
function app(p=profile()):NutrientApplication{return {id:'a',date:'2026-11-01',dose:100,unit:'kg/ha',status:'planned',mode:'Synthetic test',composition:p};}
test('15–15–15 label is oxide mass, never elemental P/K or available nutrient',()=>{
 const r=convertApplication(app());assert.deepEqual(r.oxideKgHa,{N:15,P2O5:15,K2O:15});assert.deepEqual(r.elementalKgHa,{N:15,P:6.546,K:12.4515});assert.equal(r.availableDuringCycleKgHa,null);assert.equal(r.nFormsKgHa.nitrate,null);
 const e=convertApplication(app(profile({convention:'N-P-K'})));assert.equal(e.elementalKgHa.P,15);assert.ok(Math.abs(e.oxideKgHa.P2O5!-15/.4364)<1e-10);
});
test('organic fresh/dry mass, liquids and uncertainty are explicit, with no universal availability',()=>{
 const p=profile({kind:'organic',basis:'dry',percent:[3,1,2],moisturePercent:50,organic:{carbonPercent:29,cnRatio:14.5,maturity:null,storage:null},nForms:{urea:0,ammonium:1,nitrate:0,organic:2}}),a={...app(p),dose:1000};
 let r=convertApplication(a);assert.equal(r.dryKgHa,500);assert.equal(r.elementalKgHa.N,15);assert.equal(r.nFormsKgHa.ammonium,5);assert.equal(r.nFormsKgHa.organic,10);assert.equal(r.mineralization.status,'not_modelled');
 r=convertApplication({...a,composition:{...p,moisturePercent:null}});assert.equal(r.elementalKgHa.N,null);assert.match(r.missing.join(),/Humidité/);
 r=convertApplication({...app(),unit:'L/ha'});assert.equal(r.freshKgHa,null);assert.equal(r.elementalKgHa.N,null);
 r=convertApplication({...app(profile({densityKgL:1.2})),unit:'L/ha'});assert.equal(r.elementalKgHa.N,18);
 assert.equal(productCatalog().entries.find(p=>p.id==='compost')?.examplePercent,null);
});
test('mixtures retain components, distinguish planned/realised and do not double-count N fractions',()=>{
 const a=app(profile({percent:[10,null,0],nForms:{urea:0,ammonium:4,nitrate:6,organic:0}}));a.status='declared';
 const b={...app(),id:'b'};const r=nutrientBalance([a,b]);assert.equal(r.rows.length,2);assert.equal(r.totals.N,25);assert.equal(r.realized.N,10);assert.equal(r.planned.N,15);assert.equal(r.totals.P,null);assert.equal(r.availableDuringCycleKgHa,null);
 assert.throws(()=>nutrientBalance([a,a]),/deux fois/);
 assert.throws(()=>parseComposition(profile({nForms:{urea:10,ammonium:10,nitrate:0,organic:0}})),/somme/);
 assert.throws(()=>parseComposition(profile({evidence:'reference_scenario'})),/scénario/);
 for(const bad of [NaN,Infinity,-1])assert.throws(()=>convertApplication({...a,dose:bad}));
 assert.throws(()=>convertApplication(app(profile({kind:'pesticide'}))),/pesticides/);
});
test('SNOMIN adapter preserves N/organic C mass and refuses unrepresented forms or incompatible organic profiles',()=>{
 const a={...app(profile({kind:'organic',basis:'dry',percent:[3,1,2],moisturePercent:50,organic:{carbonPercent:29,cnRatio:14.5,maturity:'Declared',storage:'Declared'},nForms:{urea:0,ammonium:1,nitrate:0,organic:2}})),dose:1000};
 const p={depthCm:25,topLayerCm:25,profileDepthCm:120,initialAgeYears:1,organicMatterPercentFresh:25,organicCnRatio:14.5,source:'Synthetic SNOMIN scenario only'};
 const r=snominApplication(a,p);assert.equal(r.amountKgHa,1000);assert.equal(r.nh4KgHa,5);assert.equal(r.organicNKgHa,10);assert.equal(r.carbonKgHa,145);assert.equal(r.organicMatterKgHa,250);
 assert.throws(()=>snominApplication(app(),p),/connues/);
 assert.throws(()=>snominApplication(app(profile({percent:[10,0,0],nForms:{urea:10,ammonium:0,nitrate:0,organic:0}})),p),/urée/);
 assert.throws(()=>snominApplication(a,{...p,depthCm:10}),/profondeur/);
 assert.throws(()=>snominApplication(a,{...p,organicCnRatio:20}),/incompatible/);
 assert.throws(()=>snominApplication({...a,composition:{...a.composition,organic:{...a.composition.organic!,carbonPercent:30}}},p),/incompatible/);
});
test('inventory is not plant supply; planted yield denominator is preserved at 40% planted area',()=>{
 const r=concentrationInventory({mgKg:10,thicknessM:.2,bulkDensityKgM3:1300,fineEarthFraction:.9,source:'Synthetic whole-soil density and fine-earth mass fraction',densityBasis:'whole-soil',fractionBasis:'fine-earth-mass'});assert.ok(Math.abs(r.inventoryKgHa-23.4)<1e-10);assert.equal(r.supplyToCropKgHa,null);
 assert.throws(()=>concentrationInventory({mgKg:10,thicknessM:undefined} as any));
 const full=aggregateProduction([{sownAreaM2:10000,productionKg:4000}],10000),part=aggregateProduction([{sownAreaM2:4000,productionKg:1600}],10000);assert.equal(full.productionKg,4000);assert.equal(part.productionKg,1600);assert.equal(part.yieldKgHaSown,4000);assert.equal(part.productionKgHaContour,1600);
 assert.deepEqual(cropEngineManifest().selected.validatedCountries,[]);assert.equal(cropEngineManifest().seasonalNpk.status,'not_enabled');
});
