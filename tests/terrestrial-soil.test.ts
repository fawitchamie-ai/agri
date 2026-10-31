import test from 'node:test';
import assert from 'node:assert/strict';
import {terrestrialSoilPoint,type LandAssessment} from '../lib/seasonal/land.ts';
import {loadEnvironment} from '../lib/seasonal/environment.ts';
const square=(x:number,y:number,size:number):[number,number][]=>[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
test('Soil sample avoids water, holes and smaller disconnected land pieces',()=>{
  const geometry={type:'MultiPolygon',coordinates:[[square(0,0,10),square(2,2,6)],[square(20,20,1)]]};
  const a={fractions:{potentialLand:{geometry}}} as LandAssessment;
  const point=terrestrialSoilPoint(a)!;
  assert.ok(point[0]>0&&point[0]<10&&point[1]>0&&point[1]<10);
  assert.ok(!(point[0]>2&&point[0]<8&&point[1]>2&&point[1]<8));
  assert.equal(terrestrialSoilPoint({fractions:{potentialLand:{geometry:{coordinates:[]}}}} as unknown as LandAssessment),null);
});
test('Soil uses mapped terrestrial point while weather retains parcel location; absent land skips soil',async()=>{
  const requests:URL[]=[];
  const fetcher:typeof fetch=async input=>{requests.push(new URL(String(input)));return new Response('missing',{status:503});};
  await loadEnvironment(9.5,1.2,'TGO','2026-10-31',2,fetcher,'2026-10-31T00:00:00Z',undefined,false,[1.21,9.51]);
  const soil=requests.find(u=>u.hostname==='maps.isric.org')!,weather=requests.find(u=>u.hostname==='api.open-meteo.com')!;
  assert.ok(Number(soil.searchParams.get('BBOX')!.split(',')[0])>1.209);
  assert.equal(weather.searchParams.get('longitude'),'1.2');
  requests.length=0;
  const e=await loadEnvironment(9.5,1.2,'TGO','2026-10-31',2,fetcher,'2026-10-31T00:00:00Z',undefined,false,null);
  assert.ok(requests.every(u=>u.hostname!=='maps.isric.org'));assert.equal(e.soil.ph,null);
  assert.match(e.warnings.join(' '),/aucune partie terrestre/);
});
