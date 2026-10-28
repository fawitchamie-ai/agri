import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT,createLocalJWKSet} from 'jose';
import {accessConfiguration,authorizeAccessRequest,currentAccessIdentity,identityFromClaims,runWithAccessIdentity,sanitizedRequest,verifyAccessToken} from '../lib/cloudflare-access.ts';

const env={CF_ACCESS_TEAM_DOMAIN:'https://agri-test.cloudflareaccess.com',CF_ACCESS_AUD:'application-audience-test'};
const configuration=accessConfiguration(env);
const {privateKey,publicKey}=await generateKeyPair('RS256',{extractable:true});
const key=await exportJWK(publicKey);key.kid='test-key';key.alg='RS256';key.use='sig';
const resolver=createLocalJWKSet({keys:[key]});
async function token(overrides:Record<string,unknown>={}){
 const now=Math.floor(Date.now()/1000);
 return new SignJWT({sub:'person-01',email:'Fidele@Example.test',name:'Fidèle',iss:configuration.issuer,aud:configuration.audience,iat:now,exp:now+120,...overrides}).setProtectedHeader({alg:'RS256',kid:'test-key'}).sign(privateKey);
}
function request(path='/',signed?:string,extra:Record<string,string>={}){return new Request('https://agri.example.test'+path,{headers:{...(signed?{'Cf-Access-Jwt-Assertion':signed}:{}),...extra}});}

test('Access: jeton RS256 signé produit identité humaine cf:sub et email normalisé',async()=>{
 const payload=await verifyAccessToken(await token(),configuration,resolver);
 assert.deepEqual(identityFromClaims(payload),{userId:'cf:person-01',email:'fidele@example.test',displayName:'Fidèle',fullName:'Fidèle'});
 const auth=await authorizeAccessRequest(request('/api/workspace',await token()),env,resolver);
 assert(!(auth instanceof Response));assert.equal(auth.identity?.userId,'cf:person-01');
 assert.equal(auth.request.headers.get('cf-access-jwt-assertion'),null);
});

test('Access: signature altérée, audience, émetteur et expiration incorrects refusés',async()=>{
 const signed=await token();const parts=signed.split('.');const changed=parts[2][0]==='a'?'b':'a';parts[2]=changed+parts[2].slice(1);
 for(const invalid of [parts.join('.'),await token({aud:'autre-application'}),await token({iss:'https://attacker.cloudflareaccess.com'}),await token({exp:Math.floor(Date.now()/1000)-60}),await token({iat:Math.floor(Date.now()/1000)+3600}),await token({exp:undefined})]){
  const result=await authorizeAccessRequest(request('/api/workspace',invalid),env,resolver);
  assert(result instanceof Response);assert.equal(result.status,401);
 }
});

test('Access: les en-têtes identité visiteurs ne remplacent jamais un JWT',async()=>{
 const forged=request('/api/workspace',undefined,{'oai-authenticated-user-id':'admin','oai-authenticated-user-email':'admin@example.test','x-agri-user-id':'admin','x-agri-role':'admin'});
 const result=await authorizeAccessRequest(forged,env,resolver);assert(result instanceof Response);assert.equal(result.status,401);
 const clean=sanitizedRequest(forged);for(const name of ['oai-authenticated-user-id','oai-authenticated-user-email','x-agri-user-id','x-agri-role'])assert.equal(clean.headers.get(name),null);
 const auth=await authorizeAccessRequest(request('/',await token(),{'oai-authenticated-user-id':'admin','x-agri-role':'admin'}),env,resolver);
 assert(!(auth instanceof Response));assert.equal(auth.identity?.userId,'cf:person-01');assert.equal(auth.request.headers.get('x-agri-role'),null);
});

test('Access: configuration manquante refuse par défaut, domaine des clés HTTPS contrôlé',async()=>{
 const result=await authorizeAccessRequest(request(),{},resolver);assert(result instanceof Response);assert.equal(result.status,503);
 for(const issuer of ['http://agri-test.cloudflareaccess.com','https://attacker.test','https://agri-test.cloudflareaccess.com/extra','https://agri-test.cloudflareaccess.com@attacker.test'])
  assert.throws(()=>accessConfiguration({...env,CF_ACCESS_TEAM_DOMAIN:issuer}));
 assert.throws(()=>accessConfiguration({...env,CF_ACCESS_AUD:''}));
});

test('Access: démonstration anonyme strictement locale et identité toujours absente',async()=>{
 const local=await authorizeAccessRequest(new Request('http://localhost:5173/api/workspace',{headers:{'oai-authenticated-user-id':'admin','x-agri-user-id':'admin'}}),{AUTH_DEMO_ONLY:'true'},resolver);
 assert(!(local instanceof Response));assert.equal(local.identity,null);assert.equal(local.request.headers.get('oai-authenticated-user-id'),null);
 for(const [url,flag] of [['http://localhost:5173/api/workspace','false'],['https://agri.example.test/api/workspace','true'],['http://localhost:5173/private-unknown-path','true']]){
  const result=await authorizeAccessRequest(new Request(url),{AUTH_DEMO_ONLY:flag},resolver);assert(result instanceof Response);assert.equal(result.status,503);
 }
});

test('Access: service JWT limité au GET santé, jamais transformé en compte humain',async()=>{
 const signed=await token({sub:undefined,email:undefined,name:undefined,common_name:'CI service'});
 const health=await authorizeAccessRequest(request('/api/health',signed),env,resolver);assert(!(health instanceof Response));assert.equal(health.identity,null);
 const business=await authorizeAccessRequest(request('/api/workspace',signed),env,resolver);assert(business instanceof Response);assert.equal(business.status,403);
 const post=await authorizeAccessRequest(new Request('https://agri.example.test/api/health',{method:'POST',headers:{'cf-access-jwt-assertion':signed}}),env,resolver);assert(post instanceof Response);assert.equal(post.status,403);
 const noToken=await authorizeAccessRequest(request('/api/health'),env,resolver);assert(noToken instanceof Response);assert.equal(noToken.status,401);
});

test('Access: identité humaine sans sujet/email ou explicitement non vérifiée refusée',async()=>{
 for(const overrides of [{sub:''},{email:''},{email:'invalide'},{email_verified:false}]){
  const result=await authorizeAccessRequest(request('/api/workspace',await token(overrides)),env,resolver);assert(result instanceof Response);assert.equal(result.status,403);
 }
 await assert.rejects(verifyAccessToken('x'.repeat(16_385),configuration,resolver));
});

test('Access: contexte identité isolé entre requêtes concurrentes et nettoyé ensuite',async()=>{
 const a={userId:'cf:a',email:'a@example.test',displayName:'a',fullName:null},b={...a,userId:'cf:b'};
 const identities=await Promise.all([a,b].map(identity=>runWithAccessIdentity(identity,async()=>{await Promise.resolve();return currentAccessIdentity()?.userId;})));
 assert.deepEqual(identities,['cf:a','cf:b']);assert.equal(currentAccessIdentity(),null);
});
