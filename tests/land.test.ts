import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLandGeometry,landBlockReason,missingLandLayer,multiArea,type LandLayer} from '../lib/seasonal/land.ts';
import {polygonFromPoints,parcelMetrics,type ParcelPolygon} from '../lib/seasonal/parcel.ts';
import {worldCoverAssets,jrcAssets} from '../lib/seasonal/land-provider.ts';
const now=new Date().toISOString();
const rect=(x:number,y:number,w=.001,h=.001)=>polygonFromPoints([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
const layer=(shape:ParcelPolygon,v:number,id:LandLayer['id']='worldcover'):LandLayer=>({id,status:'available',provider:'Test only',product:'Synthetic class fixture',version:'test-1',referencePeriod:null,observedAt:null,acquiredAt:now,resolutionM:id==='worldcover'?10:30,crs:'EPSG:4326',cells:[{geometry:shape,value:v,id:'fixture'}],assets:[],reason:null,limitations:['Synthetic fixture, not field validation']});
test('Fractions surfaciques : lac, berge mixte et ruisseau ne dépendent pas du centre du contour',()=>{
 const g=rect(1,7),all=assessLandGeometry(g,[layer(g,80)],now);assert.equal(all.status,'excluded');assert.match(landBlockReason({parcelGeometry:g,landAssessment:all})!,/suspendu/);
 const half=rect(1,7,.0005),base=layer(g,40);base.cells.push({geometry:half,value:80,id:'water'});
 // Partition source pixels must not overlap. Use separate halves for this case.
 base.cells=[{geometry:half,value:80,id:'water'},{geometry:rect(1.0005,7,.0005),value:40,id:'land'}];
 const mixed=assessLandGeometry(g,[base],now);assert.ok(Math.abs(mixed.fractions.permanentWater.fraction-.5)<1e-7);assert.ok(Math.abs(Object.values(mixed.fractions).reduce((n,f)=>n+f.fraction,0)-1)<1e-7);assert.equal(mixed.status,'mixed');
 const river=assessLandGeometry(g,[layer(g,40),layer(rect(1.00008,7,.00008),12,'jrc')],now);assert.ok(river.fractions.permanentWater.fraction>.079);assert.match(landBlockReason({parcelGeometry:g,landAssessment:river})!,/mixte/);
});
test('Découpage : une surface exclue intérieure produit un trou sans perdre la terre autour',()=>{
 const g=rect(1,7),inner=rect(1.0003,7.0003,.0004,.0004);
 const a=assessLandGeometry(g,[layer(g,40),layer(inner,12,'jrc')],now);
 assert.equal(a.fractions.potentialLand.geometry.coordinates[0].length,2);
 assert.ok(Math.abs(multiArea(a.fractions.potentialLand.geometry.coordinates)+multiArea(a.fractions.permanentWater.geometry.coordinates)-a.areaM2)<.01);
});
test('Inconnu, zones humides et observations invalides : aucun état favorable inventé',()=>{
 const g=rect(1,7);const unavailable=assessLandGeometry(g,[missingLandLayer('worldcover','Panne',now)],now);
 assert.equal(unavailable.status,'unknown');assert.equal(unavailable.candidateAreaM2,0);assert.match(landBlockReason({parcelGeometry:g,landAssessment:unavailable})!,/inconnue/);
 const wet=assessLandGeometry(g,[layer(g,90)],now);assert.equal(wet.status,'conditional');assert.match(landBlockReason({parcelGeometry:g,landAssessment:wet})!,/riz/);
 const invalid=assessLandGeometry(g,[layer(g,129,'recent')],now);assert.equal(invalid.fractions.unknown.fraction,1);
 const dry=assessLandGeometry(g,[layer(g,80),layer(g,0,'recent')],now);assert.equal(dry.fractions.permanentWater.fraction,1);
 const seasonal=assessLandGeometry(g,[layer(g,80),layer(g,6,'jrc')],now);assert.equal(seasonal.fractions.seasonalWater.fraction,1);
 const contradiction=assessLandGeometry(g,[layer(g,80),layer(g,0,'jrc')],now);assert.equal(contradiction.fractions.unknown.fraction,1);assert.equal(contradiction.candidateAreaM2,0);
});
test('Six pays : eau permanente, eau saisonnière, zone humide, bâti et terre potentielle gardent leurs domaines',()=>{
 const places=[{country:'TGO',x:1.2,y:9.5},{country:'BEN',x:2.45,y:6.43},{country:'BFA',x:-1.5,y:12.3},{country:'GHA',x:0,y:7},{country:'CIV',x:-4,y:5.4},{country:'SEN',x:-15.7,y:16}];
 for(const p of places)for(const [value,cls] of [[80,'permanentWater'],[90,'wetland'],[50,'incompatible'],[40,'potentialLand']] as const){const g=rect(p.x,p.y),a=assessLandGeometry(g,[layer(g,value)],now);assert.ok(a.fractions[cls].fraction>.999999,p.country);}
 for(const p of places){const g=rect(p.x,p.y),a=assessLandGeometry(g,[layer(g,40),layer(g,4,'jrc')],now);assert.ok(a.fractions.seasonalWater.fraction>.999999);}
});
test('Sources : noms des tuiles respectent longitude négative, latitude et frontières',()=>{
 assert.match(worldCoverAssets(rect(-.0002,9.5,.0004))[0],/N09W003_Map/);
 assert.equal(worldCoverAssets(rect(-.0002,9.5,.0004)).length,2);
 assert.match(jrcAssets(rect(-15.7,16))[0],/seasonality_20W_20N_v1_5_2024/);
 assert.throws(()=>assessLandGeometry({type:'Polygon',coordinates:[[[0,0],[1,1],[0,1],[1,0],[0,0]]]},[]),/croisent/);
 const g=rect(1,7),a=assessLandGeometry(g,[layer(g,40)],now);assert.equal(a.areaM2,parcelMetrics(g).areaM2);assert.equal(a.legalStatus,'not_assessed');
});
