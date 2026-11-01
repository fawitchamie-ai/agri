import {env} from 'cloudflare:workers';
import {digest,HttpError} from '../server-db.ts';
import type {session} from '../server-auth.ts';
type Identity=Awaited<ReturnType<typeof session>>;
function configuration(){
 const e=env as unknown as {CROP_COMPUTE_URL?:string;CROP_COMPUTE_TOKEN?:string};
 if(!e.CROP_COMPUTE_URL||!e.CROP_COMPUTE_TOKEN)throw new HttpError(503,'Moteur journalier non raccordé : service de calcul et paramètres de domaine requis. Aucun rendement de substitution.');
 const url=new URL(e.CROP_COMPUTE_URL);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new HttpError(503,'Configuration du service de calcul invalide.');
 return {base:url.href.replace(/\/$/,''),token:e.CROP_COMPUTE_TOKEN};
}
export function computeAvailability(){const e=env as unknown as {CROP_COMPUTE_URL?:string;CROP_COMPUTE_TOKEN?:string};return {configured:!!e.CROP_COMPUTE_URL&&!!e.CROP_COMPUTE_TOKEN,health:'not_checked',forecastValidated:false};}
export async function computeRequest(action:'submit'|'status'|'retry',input:unknown,s:Identity){
 const cfg=configuration(),owner=await digest(JSON.stringify([s.coopId,s.userId]));
 let path='/jobs',method='POST',body:string|undefined;
 if(action==='submit'){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new HttpError(400,'Bundle scientifique JSON requis.');
  body=JSON.stringify(input);if(new TextEncoder().encode(body).length>2000000)throw new HttpError(413,'Bundle limité à 2 Mo.');
 }else{
  if(typeof input!=='string'||!/^[a-f0-9]{64}$/.test(input))throw new HttpError(400,'Identifiant du calcul invalide.');
  path+='/'+input+(action==='retry'?'/retry':'');method=action==='status'?'GET':'POST';
 }
 let r:Response;
 try{r=await fetch(cfg.base+path,{method,headers:{Authorization:'Bearer '+cfg.token,'X-Owner':owner,'Content-Type':'application/json'},body,redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new HttpError(503,'Service de calcul inaccessible ; reprenez avec le même bundle ou identifiant. Aucun résultat substitué.');}
 const raw=await r.text();if(raw.length>8000000)throw new HttpError(502,'Réponse de calcul trop volumineuse.');
 let data;try{data=JSON.parse(raw);}catch{throw new HttpError(502,'Réponse du service de calcul invalide.');}
 if(!r.ok)throw new HttpError([400,404,409,422,503].includes(r.status)?r.status:502,typeof data.error==='string'?data.error.slice(0,600):'Calcul refusé par le service.');
 return data;
}
