import {landFixture} from './support/land-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {polygonFromPoints,parcelMetrics,containsPoint,validateParcel,type Position} from '../lib/seasonal/parcel.ts';
import {validateConfig} from '../lib/seasonal/validation.ts';
import {planWater} from '../lib/seasonal/engine.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {searchPlaces} from '../lib/seasonal/places.ts';
const pts:Position[]=[[1.2,6.2],[1.201,6.2],[1.201,6.201],[1.2,6.201]];
test('Parcelle : aire sphérique indépendante, orientation, périmètre et point intérieur',()=>{
 const shape=polygonFromPoints(pts),m=parcelMetrics(shape),r=6371008.8,rad=Math.PI/180;
 const expected=r*r*.001*rad*(Math.sin(6.201*rad)-Math.sin(6.2*rad));
 assert.ok(Math.abs(m.areaM2-expected)<.001);assert.ok(m.perimeterM>440&&m.perimeterM<445);
 assert.ok(containsPoint(shape.coordinates[0],m.point));
 assert.ok(Math.abs(parcelMetrics(polygonFromPoints([...pts].reverse())).areaM2-m.areaM2)<.001);
 assert.ok(Math.abs(m.point[0]-1.2005)<1e-9);assert.ok(Math.abs(m.point[1]-6.2005)<1e-9);
});
test('Parcelle : centre de référence d’un polygone concave conservé dans le contour',()=>{
 const shape=polygonFromPoints([[0,0],[.003,0],[.003,.003],[.002,.003],[.002,.001],[.001,.001],[.001,.003],[0,.003]]);
 const m=parcelMetrics(shape);assert.equal(m.pointIsCentroid,false);assert.ok(containsPoint(shape.coordinates[0],m.point));
});
test('Parcelle : intersections, alignements, doublons, surfaces et types invalides refusés',()=>{
 for(const points of [[],pts.slice(0,2),[pts[0],pts[2],pts[1],pts[3]],[pts[0],pts[1],pts[0],pts[3]],[[0,0],[1,1],[2,2]],[[NaN,1],[1,1],[1,2]],[[181,1],[181,2],[180,2]]])assert.throws(()=>polygonFromPoints(points as Position[]));
 assert.throws(()=>validateParcel({type:'MultiPolygon',coordinates:[]}));
 assert.throws(()=>validateParcel({type:'Polygon',coordinates:[pts]}),/fermé/);
 assert.throws(()=>validateParcel({type:'Polygon',coordinates:[[...pts,pts[0]],[...pts,pts[0]]]}));
 assert.throws(()=>polygonFromPoints([[1,1],[1.000001,1],[1,1.000001]]),/surface/);
});
test('Parcelle : surface et coordonnées recalculées, puis utilisées pour les volumes',()=>{
 const c=exampleCampaign('2026-10-01');c.parcelGeometry=polygonFromPoints(pts);c.areaM2=1;c.latitude=70;c.longitude=50;c.system.sourceBudgetM3=null;c.system.sourceFlowM3h=null;c.system.hoursPerDay=null;
 c.landAssessment=landFixture(c.parcelGeometry);
 const canonical=validateConfig(c),m=parcelMetrics(c.parcelGeometry);assert.equal(canonical.areaM2,m.areaM2);assert.deepEqual([canonical.longitude,canonical.latitude],m.point);
 const actual=planWater(c);const reference=planWater({...c,parcelGeometry:undefined,areaM2:1000});
 assert.ok(Math.abs((actual.totals.fieldM3 as number)/(reference.totals.fieldM3 as number)-m.areaM2/1000)<1e-9);
 const restored=JSON.parse(JSON.stringify(canonical));assert.deepEqual(planWater(restored),actual);
});
test('Recherche de lieu : transport borné, requête explicite et coordonnées invalides écartées',async()=>{
 let url='';const mock=async(input:any)=>{url=String(input);return Response.json({results:[{name:'Tsévié',country:'Togo',admin1:'Maritime',latitude:6.43,longitude:1.21},{name:'Invalid',latitude:200,longitude:0}]});};
 const places=await searchPlaces('Lieu test xyz',mock as typeof fetch);const u=new URL(url);assert.equal(u.origin,'https://geocoding-api.open-meteo.com');assert.equal(u.searchParams.get('name'),'Lieu test xyz');assert.equal(u.searchParams.get('count'),'6');assert.equal(places.length,1);assert.equal(places[0].longitude,1.21);
 await assert.rejects(()=>searchPlaces('ab',mock as typeof fetch));
});
test('Carte Afrique : référentiel local et six pays de simulation présents',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/maps/africa-countries.geojson',import.meta.url),'utf8'));
 assert.ok(data.features.length>=50);for(const id of ['TGO','BEN','GHA','CIV','BFA','SEN'])assert.ok(data.features.some((f:any)=>f.properties.iso3===id));
});

test('Recherche locale : Tsévié est trouvée sans dépendre d’un fournisseur en ligne',async()=>{
 const rows=await searchPlaces('tsevie',(async()=>{throw new Error('Aucun appel réseau attendu');}) as typeof fetch);
 assert.equal(rows[0].name,'Tsévié');assert.equal(rows[0].latitude,6.42611);
});
