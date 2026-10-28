/** Final independent regression checks; real handlers/migrations, local D1 adapter. */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {localFetch,closeHarness,harnessScope} from './support/local-route-harness.mjs';
import {parseCSV} from '../lib/server-import.ts';
let cookie='';const results=[];const base='http://agri.test';
async function request(path,method='GET',data,expected=200){const res=await localFetch(new URL(path,base),{method,headers:{...(cookie?{cookie}:{}),...(data?{'Content-Type':'application/json',Origin:base}:{})},...(data?{body:JSON.stringify(data)}:{})});const set=res.headers.getSetCookie?.()[0];if(set)cookie=set.split(';')[0];const raw=await res.text();assert.equal(res.status,expected,`${method} ${path}: ${raw.slice(0,300)}`);try{return JSON.parse(raw)}catch{return raw}}
async function check(name,fn){const t=performance.now();await fn();results.push({name,status:'PASS',ms:+(performance.now()-t).toFixed(2)})}
try{
 await request('/api/demo','POST',{role:'responsable',coopId:'demo-a'});
 const workspace=await request('/api/workspace'),memberA=workspace.records.find(r=>r.kind==='member');
 const memberB=(await request('/api/workspace','POST',{kind:'member',data:{name:'Autre producteur fictif',locality:'Localité test'}},201)).record;
 const harvestData={memberId:memberA.id,producer:'Afi',crop:'Maize',year:2026,territory:'Togo',area:1,quantity:1500,unit:'kg',date:'2026-10-01',method:'measure',status:'soumis'};
 const harvest=(await request('/api/workspace','POST',{kind:'harvest',data:harvestData},201)).record;
 const collectionData={memberId:memberA.id,harvestId:harvest.id,crop:'Maize',year:2026,territory:'Togo',estimated:2,declared:1.5,committed:1.5,collected:1,point:'Magasin test',date:'2026-11-01',slotHHmm:'08:00',status:'prevu'};
 const collection=(await request('/api/workspace','POST',{kind:'collection',data:collectionData},201)).record;
 await check('Correction récolte: changement de producteur refusé, provenance préservée',async()=>{await request('/api/workspace','POST',{id:harvest.id,kind:'harvest',data:{...harvestData,memberId:memberB.id}},409);const r=(await request('/api/workspace')).records.find(r=>r.id===harvest.id);assert.equal(r.data.memberId,memberA.id);assert.equal(r.ownerId,memberA.ownerId)});
 await check('Correction collecte: changement de producteur refusé',async()=>{await request('/api/workspace','POST',{id:collection.id,kind:'collection',data:{...collectionData,memberId:memberB.id,harvestId:''}},409);const r=(await request('/api/workspace')).records.find(r=>r.id===collection.id);assert.equal(r.data.memberId,memberA.id);assert.equal(r.ownerId,memberA.ownerId)});
 await check('Récolte liée: culture, campagne et territoire ne rendent pas la liaison incompatible',async()=>{for(const patch of [{crop:'Rice'},{year:2025},{territory:'Kloto'}])await request('/api/workspace','POST',{id:harvest.id,kind:'harvest',data:{...harvestData,...patch}},409);const r=(await request('/api/workspace')).records.find(r=>r.id===harvest.id);assert.equal(r.data.crop,'Maize');assert.equal(r.data.year,2026);assert.equal(r.data.territory,'Togo')});
 await check('Producteur: les corrections refusées ne révèlent pas un autre membre',async()=>{await request('/api/demo','POST',{role:'producteur',coopId:'demo-a'});const r=await request('/api/workspace');assert.ok(r.records.some(r=>r.id===harvest.id&&r.data.memberId===memberA.id));assert.ok(!r.records.some(r=>r.id===memberB.id))});
 await check('CSV observations: diagnostic X/E et statut principal conservés',async()=>{const csv=await request('/api/export?kind=observation&crop=Maize&year=2024&territory=Togo&level=national');const [headers,...rows]=parseCSV(csv.replace(/^\uFEFF/,''));for(const key of ['observationStatus','primaryEvaluation','geographyStatus','comparabilityStatus'])assert.ok(headers.includes(key),`Colonne de qualité absente: ${key}`);assert.equal(rows.length,1);const r=Object.fromEntries(headers.map((h,i)=>[h,rows[0][i]]));assert.match(r.observationStatus,/X: Value/);assert.equal(r.primaryEvaluation,'false');assert.equal(r.comparabilityStatus,'COMPARABLE_NATIONAL_FAOSTAT_DEFINITION')});
 writeFileSync(new URL('final-regression-results.json',import.meta.url),JSON.stringify({scope:harnessScope,results},null,2)+'\n');console.log(JSON.stringify(results,null,2));
}finally{closeHarness()}
