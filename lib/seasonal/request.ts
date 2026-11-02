/** Browser requests have a deadline including response-body reading, not just headers. */
export async function seasonalRequest<T>(body:unknown,signal?:AbortSignal,timeoutMs=90_000,fetcher:typeof fetch=fetch):Promise<T>{
 const controller=new AbortController();
 let timer:ReturnType<typeof setTimeout>|undefined;
 let onAbort:()=>void=()=>{};
 const cancelled=new Promise<never>((_,reject)=>{
  onAbort=()=>{controller.abort();reject(new DOMException('Calcul remplacé ou annulé.','AbortError'));};
  if(signal?.aborted)onAbort();else signal?.addEventListener('abort',onAbort,{once:true});
  timer=setTimeout(()=>{controller.abort();reject(new Error('Le service met trop de temps à répondre. Relancez le calcul. Vos saisies sont conservées.'));},timeoutMs);
 });
 try{
  return await Promise.race([cancelled,(async()=>{
   if(signal?.aborted)throw new DOMException('Calcul annulé.','AbortError');
   let response:Response;
   try{response=await fetcher('/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify(body)});}
   catch(e){if(controller.signal.aborted)throw e;throw new Error('Connexion au service interrompue. Relancez le calcul. Vos saisies sont conservées.');}
   let data:any;
   try{data=await response.json();}catch{throw new Error(response.status===401||response.status===403||response.redirected?'Votre session a peut-être expiré. Rouvrez votre espace, puis relancez le calcul. Vos saisies sont conservées.':'Réponse du service illisible. Relancez le calcul. Vos saisies sont conservées.');}
   if(!response.ok)throw new Error(data.error||`Calcul indisponible (HTTP ${response.status}). Vos saisies sont conservées.`);
   return data as T;
  })()]);
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
}
