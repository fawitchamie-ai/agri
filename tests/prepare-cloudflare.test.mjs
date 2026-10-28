import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDatabase} from '../scripts/prepare-cloudflare.mjs';
const env={CLOUDFLARE_API_TOKEN:'test-only-not-real',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32)};
const db={name:'agriprevision-db',uuid:'12345678-1234-4321-8765-123456789abc'};
const ok=result=>Response.json({success:true,result});
test('Préparation D1 : aucun appel sans secrets valides',async()=>{
 await assert.rejects(prepareDatabase({env:{},fetchImpl:()=>assert.fail('appel interdit')}),/Configurer/);
});
test('Préparation D1 : une base existante est conservée sans écriture',async()=>{
 const calls=[];const result=await prepareDatabase({env,fetchImpl:async(url,init)=>{calls.push(init.method);assert.equal(new URL(url).hostname,'api.cloudflare.com');assert.equal(init.redirect,'error');return ok([db]);}});
 assert.deepEqual(result,{databaseId:db.uuid,status:'existing'});assert.deepEqual(calls,['GET']);
});
test('Préparation D1 : recherche paginée complète avant création unique',async()=>{
 const calls=[];const result=await prepareDatabase({env,fetchImpl:async(url,init)=>{calls.push(init.method);if(init.method==='POST'){assert.deepEqual(JSON.parse(init.body),{name:db.name,primary_location_hint:'weur'});return ok(db);}return ok(new URL(url).searchParams.get('page')==='1'?Array.from({length:100},(_,i)=>({name:'autre-'+i})):[]);}});
 assert.equal(result.status,'created');assert.deepEqual(calls,['GET','GET','POST']);
});
test('Préparation D1 : refus API sans création ni fuite du jeton',async()=>{
 let n=0;await assert.rejects(prepareDatabase({env,fetchImpl:async()=>{n++;return new Response(env.CLOUDFLARE_API_TOKEN,{status:403});}}),e=>e.message.includes('403')&&!e.message.includes(env.CLOUDFLARE_API_TOKEN));assert.equal(n,1);
});
test('Préparation D1 : réponse ambiguë ou invalide ne déclenche aucune écriture',async()=>{
 for(const result of [[db,db],{},[{...db,uuid:'invalide'}]])await assert.rejects(prepareDatabase({env,fetchImpl:async(_,init)=>{assert.equal(init.method,'GET');return ok(result);}}));
});
