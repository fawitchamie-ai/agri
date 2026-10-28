import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SignJWT,generateKeyPair,exportJWK,createLocalJWKSet} from 'jose';
import {accessConfiguration,authorizeAccessRequest,runWithAccessIdentity,currentAccessIdentity,sanitizedRequest} from '../lib/cloudflare-access.ts';

const env={CF_ACCESS_TEAM_DOMAIN:'https://review.cloudflareaccess.com',CF_ACCESS_AUD:'a'.repeat(64)};
const config=accessConfiguration(env);
const {privateKey,publicKey}=await generateKeyPair('RS256',{extractable:true});
const jwk=await exportJWK(publicKey);jwk.kid='review';jwk.alg='RS256';
const resolver=createLocalJWKSet({keys:[jwk]});
async function sign(extra:Record<string,unknown>={}){const now=Math.floor(Date.now()/1000);return new SignJWT({sub:'review-user',email:'review@example.test',iss:config.issuer,aud:config.audience,exp:now+120,iat:now,...extra}).setProtectedHeader({alg:'RS256',kid:'review'}).sign(privateKey)}
const request=(url:string,jwt?:string,method='GET')=>new Request(url,{method,headers:jwt?{'cf-access-jwt-assertion':jwt}:{}});

test('Revue Access: Host localhost forgé ne contourne pas la protection distante',async()=>{
 const response=await authorizeAccessRequest(new Request('https://production.example.test/api/workspace',{headers:{Host:'localhost','X-Forwarded-Host':'localhost','X-Forwarded-Proto':'http'}}),{AUTH_DEMO_ONLY:'true'},resolver);
 assert(response instanceof Response);assert.equal(response.status,503);
});

test('Revue Access: JWT sans signature, HS256 et not-before futur refusés',async()=>{
 const none=Buffer.from(JSON.stringify({alg:'none'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:'admin',email:'admin@example.test',iss:config.issuer,aud:config.audience,exp:Math.floor(Date.now()/1000)+100})).toString('base64url')+'.';
 const now=Math.floor(Date.now()/1000);
 const hs=await new SignJWT({sub:'admin',email:'admin@example.test',iss:config.issuer,aud:config.audience,exp:now+100,iat:now}).setProtectedHeader({alg:'HS256'}).sign(new TextEncoder().encode('review-only-secret-with-enough-bytes'));
 for(const jwt of [none,hs,await sign({nbf:now+300}),await sign({iat:undefined})]){const r=await authorizeAccessRequest(request('https://production.example.test/api/workspace',jwt),env,resolver);assert(r instanceof Response);assert.equal(r.status,401)}
});

test('Revue Access: service sans identité ne lit ni science, ni export, ni chemin santé différent',async()=>{
 const jwt=await sign({sub:undefined,email:undefined});
 for(const path of ['/api/science','/api/export?kind=harvest','/api/health/','/api/health/extra']){const r=await authorizeAccessRequest(request('https://production.example.test'+path,jwt),env,resolver);assert(r instanceof Response);assert.equal(r.status,403)}
 const r=await authorizeAccessRequest(request('https://production.example.test/api/health',jwt),env,resolver);assert(!(r instanceof Response));assert.equal(r.identity,null);
});

test('Revue Access: nettoyage conserve JSON et origine CSRF sans identité injectée',async()=>{
 const original=new Request('https://production.example.test/api/workspace',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.example.test','oai-authenticated-user-email':'forged@example.test','x-agri-role':'admin'},body:JSON.stringify({kind:'harvest'})});
 const clean=sanitizedRequest(original);assert.equal(clean.headers.get('origin'),'https://other.example.test');assert.equal(clean.headers.get('content-type'),'application/json');assert.equal(clean.headers.get('oai-authenticated-user-email'),null);assert.equal(clean.headers.get('x-agri-role'),null);assert.deepEqual(await clean.json(),{kind:'harvest'});
});

test('Revue Access: exception asynchrone ne laisse aucune identité résiduelle',async()=>{
 const identity={userId:'cf:review',email:'review@example.test',displayName:'review',fullName:null};
 await assert.rejects(runWithAccessIdentity(identity,async()=>{await Promise.resolve();assert.equal(currentAccessIdentity()?.userId,'cf:review');throw new Error('review exception')}));
 assert.equal(currentAccessIdentity(),null);
});

test('Revue CI: job de vérification sans secrets, publication main et sans annulation migration',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
 const checks=workflow.split('\n  checks:')[1]?.split('\n  deploy:')[0];assert.ok(checks);assert.ok(!checks.includes('secrets.'));assert.match(workflow,/github\.event_name != 'pull_request' && github\.ref == 'refs\/heads\/main' && vars\.CLOUDFLARE_DEPLOY_ENABLED == 'true'/);assert.match(workflow,/cancel-in-progress: false/);assert.ok(!workflow.includes('pull_request_target'));assert.ok(!workflow.includes('upload-artifact'));
});
