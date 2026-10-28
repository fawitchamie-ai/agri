import { AsyncLocalStorage } from 'node:async_hooks';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from 'jose';

export type AccessIdentity = { userId:string; email:string; displayName:string; fullName:string|null };
export type AccessEnvironment = { CF_ACCESS_TEAM_DOMAIN?:string; CF_ACCESS_AUD?:string; AUTH_DEMO_ONLY?:string };
type AccessConfiguration = { issuer:string; audience:string };
const identityContext = new AsyncLocalStorage<AccessIdentity|null>();
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const localHosts = new Set(['localhost','127.0.0.1','[::1]','::1']);
const localPaths = new Set(['/','/api/health','/api/science','/api/demo','/api/workspace','/api/export','/api/import','/api/report','/api/session','/api/access']);

export function runWithAccessIdentity<T>(identity:AccessIdentity|null, callback:()=>T):T {
  return identityContext.run(identity, callback);
}
export function currentAccessIdentity():AccessIdentity|null { return identityContext.getStore()??null; }
export function accessConfiguration(env:AccessEnvironment):AccessConfiguration {
  const issuer=env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/\/$/,'');
  const audience=env.CF_ACCESS_AUD?.trim();
  if(!issuer||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(issuer)||!audience||audience.length>256)
    throw new Error('Cloudflare Access doit être configuré avec son domaine HTTPS et son audience.');
  return {issuer,audience};
}
function remoteKeys(issuer:string) {
  let keys=keySets.get(issuer);
  if(!keys){keys=createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'));keySets.set(issuer,keys);}
  return keys;
}
/** The optional key resolver belongs to unit tests, never to HTTP inputs or environment variables. */
export async function verifyAccessToken(token:string,config:AccessConfiguration,keyResolver?:JWTVerifyGetKey):Promise<JWTPayload> {
  if(!token||token.length>16_384)throw new Error('Jeton absent ou trop long.');
  const verified=await jwtVerify(token,keyResolver??remoteKeys(config.issuer),{
    issuer:config.issuer,audience:config.audience,algorithms:['RS256'],
    requiredClaims:['exp','iat','iss','aud'],clockTolerance:5,
  });
  const issuedAt=verified.payload.iat;
  if(typeof issuedAt!=='number'||!Number.isFinite(issuedAt)||issuedAt>Date.now()/1000+5)throw new Error('Date d’émission du jeton invalide.');
  return verified.payload;
}
export function identityFromClaims(payload:JWTPayload):AccessIdentity|null {
  if(typeof payload.sub!=='string'||!payload.sub.trim()||payload.sub.length>256||typeof payload.email!=='string')return null;
  const email=payload.email.trim().toLowerCase();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||payload.email_verified===false)return null;
  const fullName=typeof payload.name==='string'&&payload.name.trim()?payload.name.trim().slice(0,200):null;
  return {userId:'cf:'+payload.sub,email,displayName:fullName??email,fullName};
}
export function sanitizedRequest(request:Request):Request {
  const headers=new Headers(request.headers);
  for(const name of [...headers.keys()])if(name.startsWith('oai-authenticated-user-')||name.startsWith('x-agri-'))headers.delete(name);
  headers.delete('cf-access-jwt-assertion');
  return new Request(request,{headers});
}
function denied(message:string,status:number){return new Response(message,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export async function authorizeAccessRequest(request:Request,env:AccessEnvironment,keyResolver?:JWTVerifyGetKey):Promise<Response|{request:Request;identity:AccessIdentity|null}> {
  const url=new URL(request.url),clean=sanitizedRequest(request);
  if(env.AUTH_DEMO_ONLY==='true'&&localHosts.has(url.hostname)&&localPaths.has(url.pathname))
    return {request:clean,identity:null};
  let config:AccessConfiguration;
  try{config=accessConfiguration(env);}catch{return denied('Authentification Cloudflare Access non configurée.',503);}
  const token=request.headers.get('cf-access-jwt-assertion');
  if(!token)return denied('Connexion Cloudflare Access requise.',401);
  try{
    const payload=await verifyAccessToken(token,config,keyResolver),identity=identityFromClaims(payload);
    // Service tokens can prove deployment health but never become a human account.
    if(!identity&&!(request.method==='GET'&&url.pathname==='/api/health'))
      return denied('Une identité utilisateur Cloudflare Access est requise.',403);
    return {request:clean,identity};
  }catch{return denied('Connexion Cloudflare Access invalide ou expirée.',401);}
}
