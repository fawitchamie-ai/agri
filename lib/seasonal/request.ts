export type LandProgress={id:string;status:'pending'|'complete'|'paused';completed:number;total:number;processedM2:number;totalM2:number;errors:{sector:number;error:string}[];assessment:import('./land.ts').LandAssessment|null};
type Options={onLandProgress?:(p:LandProgress)=>void};
type Preparation={controller:AbortController;promise:Promise<LandProgress>;listeners:Set<(p:LandProgress)=>void>;users:number;progress:LandProgress};
const preparations=new Map<string,Preparation>(),paused=new Set<string>();
const cancelled=()=>new DOMException('Calcul remplacé ou annulé.','AbortError');
export class SeasonalServiceError extends Error {
 constructor(message:string,public status:number,public action:string,public code?:string){super(message);this.name='SeasonalServiceError';}
}
function wireBody(value:unknown){if(!value||typeof value!=='object'||Array.isArray(value))return value;const b=value as Record<string,unknown>,c=b.config;if(!c||typeof c!=='object'||Array.isArray(c))return value;const {landAssessment,...config}=c as Record<string,unknown>;void landAssessment;return {...b,config};}
/** Each HTTP exchange has a bounded deadline, including response-body reading. */
async function exchange(body:unknown,signal:AbortSignal|undefined,timeoutMs:number,fetcher:typeof fetch){
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,onAbort=()=>{};
 const cancellation=new Promise<never>((_,reject)=>{onAbort=()=>{controller.abort();reject(cancelled());};if(signal?.aborted)onAbort();else signal?.addEventListener('abort',onAbort,{once:true});timer=setTimeout(()=>{controller.abort();reject(new Error('Le service met trop de temps à répondre. Relancez le calcul. Vos saisies sont conservées.'));},timeoutMs);});
 try{return await Promise.race([cancellation,(async()=>{
  if(signal?.aborted)throw cancelled();let response:Response;
  try{response=await fetcher('/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify(wireBody(body))});}catch(e){if(controller.signal.aborted)throw e;throw new Error('Connexion au service interrompue. Relancez le calcul. Vos saisies sont conservées.');}
  const action=typeof (body as {action?:unknown})?.action==='string'?(body as {action:string}).action:'unknown';
  const raw=await response.text();let data:any;
  try{data=JSON.parse(raw);}catch{
   const limited=/(?:Worker exceeded (?:resource limits|CPU time limit)|cf-error-code[^>]*>\s*1102)/i.test(raw);
   throw new SeasonalServiceError(limited?'Limite de calcul Cloudflare atteinte (1102). Le serveur a interrompu le traitement. Vos saisies sont conservées ; une correction de la capacité serveur est nécessaire.':response.status===401||response.status===403||response.redirected?'Votre session a peut-être expiré. Rouvrez votre espace, puis relancez le calcul. Vos saisies sont conservées.':`Réponse du service illisible (HTTP ${response.status}). Vos saisies sont conservées.`,response.status,action,limited?'CLOUDFLARE_RESOURCE_LIMIT':undefined);
  }
  if(!response.ok)throw new SeasonalServiceError(data?.error||`Calcul indisponible (HTTP ${response.status}). Vos saisies sont conservées.`,response.status,action,data?.code);
  return {status:response.status,data};
 })()]);}finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
}
function delay(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(cancelled());},timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},ms);signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();});}
/** All callers waiting for the same owner-scoped job share one sector runner. */
async function prepareLand(job:LandProgress,signal:AbortSignal|undefined,timeoutMs:number,fetcher:typeof fetch,options:Options){
 if(signal?.aborted)throw cancelled();
 if(paused.has(job.id)){options.onLandProgress?.({...job,status:'paused'});throw new Error('Analyse du terrain en pause. Cliquez sur Reprendre l’analyse.');}
 let task=preparations.get(job.id);
 if(task?.controller.signal.aborted){preparations.delete(job.id);task=undefined;}
 if(!task){
  const controller=new AbortController();
  task={controller,listeners:new Set(),users:0,progress:job,promise:Promise.resolve(job)};
  const owned=task;preparations.set(job.id,owned);
  owned.promise=(async()=>{let current=job;
   while(current.status!=='complete'){
    if(controller.signal.aborted)throw cancelled();
    const next=(await exchange({action:'land-job-step',id:job.id},controller.signal,timeoutMs,fetcher)).data as LandProgress;
    if(!next||next.id!==job.id||!Number.isInteger(next.completed)||!Number.isInteger(next.total)||next.completed<0||next.completed>next.total)throw new Error('Progression du terrain invalide. Reprenez l’analyse.');
    owned.progress=next;for(const listener of owned.listeners)listener(next);
    if(next.errors?.length)throw new Error(next.errors[0].error+' Cliquez sur Reprendre l’analyse.');
    if(next.completed===current.completed&&next.status!=='complete')await delay(750,controller.signal);
    current=next;
   }
   if(!current.assessment)throw new Error('Analyse terminée sans résultat de terrain. Relancez-la.');
   return current;
  })().finally(()=>{if(preparations.get(job.id)===owned)preparations.delete(job.id);});
 }
 const shared=task;shared.users++;if(options.onLandProgress){shared.listeners.add(options.onLandProgress);options.onLandProgress(shared.progress);}
 return new Promise<LandProgress>((resolve,reject)=>{
  let done=false;
  const finish=(error:unknown,value?:LandProgress)=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);if(options.onLandProgress)shared.listeners.delete(options.onLandProgress);shared.users--;if(shared.users===0&&shared.progress.status!=='complete')shared.controller.abort();if(error)reject(error);else resolve(value!);};
  const abort=()=>finish(cancelled());signal?.addEventListener('abort',abort,{once:true});
  shared.promise.then(v=>finish(null,v),e=>finish(paused.has(job.id)?new Error('Analyse du terrain en pause. Cliquez sur Reprendre l’analyse.'):e));
  if(signal?.aborted)abort();
 });
}
export function pauseLandAnalysis(id:string){paused.add(id);const task=preparations.get(id);if(task){task.progress={...task.progress,status:'paused'};for(const listener of task.listeners)listener(task.progress);task.controller.abort();}}
export function resumeLandAnalysis(id:string){paused.delete(id);}
export async function seasonalRequest<T>(body:unknown,signal?:AbortSignal,timeoutMs=90_000,fetcher:typeof fetch=fetch,options:Options={}):Promise<T>{
 // 202 is normal preparation, never a calculation result or a revision conflict.
 for(let attempt=0;attempt<3;attempt++){
  const {status,data}=await exchange(body,signal,timeoutMs,fetcher);
  if(status!==202||data.code!=='LAND_ANALYSIS_PENDING')return data as T;
  const job=data.job as LandProgress;
  if(!job||typeof job.id!=='string'||!Array.isArray(job.errors))throw new Error('Traitement du terrain incomplet. Relancez l’analyse.');
  await prepareLand(job,signal,timeoutMs,fetcher,options);
 }
 throw new Error('Le terrain doit être réactualisé. Reprenez l’analyse ; vos saisies sont conservées.');
}
