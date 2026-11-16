import {sentinelAssetUrl} from './sentinel-assets.ts';

const MAX_BYTES=4_000_000;
const json=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
/** Called only after the existing campaign-session check. Never forwards user headers. */
export async function sentinelRasterProxy(request:Request,fetcher:typeof fetch=fetch){
 const query=new URL(request.url),origin=request.headers.get('origin');
 if(origin&&origin!==query.origin)return json('Origine du relais satellite refusée.',403);
 let asset:string;try{asset=sentinelAssetUrl(query.searchParams.get('asset'));}catch{return json('Asset satellite non autorisé.',400);}
 if(!/\/(B0[1-9]|B1[0-2]|B8A|SCL|TCI)\.tif$/i.test(new URL(asset).pathname))return json('Bande satellite non autorisée.',400);
 const head=query.searchParams.get('head')==='1',range=request.headers.get('range'),match=range?.match(/^bytes=(\d+)-(\d+)$/);
 if(!head&&(!match||!Number.isSafeInteger(Number(match[1]))||!Number.isSafeInteger(Number(match[2]))||Number(match[2])<Number(match[1])||Number(match[2])-Number(match[1])+1>MAX_BYTES))return json('Lecture satellite limitée à une plage de 4 Mo.',400);
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(30000)]);
 // Both addresses identify the exact same public S3 object. Input validation
 // above fixes the bucket, region, prefix and band before building the alias.
 const url=new URL(asset),[bucket,regional]=url.hostname.split('.s3.');
 const addresses=[asset,`https://s3.${regional}/${bucket}${url.pathname}`];
 let lastError:unknown;
 for(const [attempt,address] of addresses.entries())try{
  const attemptSignal=attempt===0?AbortSignal.any([signal,AbortSignal.timeout(12000)]):signal;
  // Keep ranges byte-exact and bypass intermediary full-object cache fills.
  const r=await fetcher(address,{method:head?'HEAD':'GET',headers:head?{'accept-encoding':'identity'}:{range:range!,'accept-encoding':'identity'},cache:'no-store',credentials:'omit',redirect:'manual',signal:attemptSignal});
  if(r.status!==(head?200:206)){
   void r.body?.cancel().catch(()=>{});
   if(r.status>=500)throw new Error('Le fournisseur de pixels satellite répond HTTP '+r.status+'.');
   return json('Le fournisseur de pixels satellite répond HTTP '+r.status+'.',502);
  }
  if(head){const size=Number(r.headers.get('content-length'));if(!Number.isSafeInteger(size)||size<1)return json('Taille du raster source inaccessible.',502);return Response.json({size},{headers:{'Cache-Control':'private, max-age=3600'}});}
  const cr=r.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/),length=Number(r.headers.get('content-length')??0);
  if(!cr||!cr.slice(1).every(v=>Number.isSafeInteger(Number(v)))||Number(cr[1])!==Number(match![1])||Number(cr[2])!==Math.min(Number(match![2]),Number(cr[3])-1)||Number(cr[3])<=Number(cr[2])||Number(cr[2])<Number(cr[1])||Number(cr[2])-Number(cr[1])+1>MAX_BYTES||length>MAX_BYTES){await r.body?.cancel();return json('Plage satellite source invalide.',502);}
  const reader=r.body?.getReader();if(!reader)return json('Pixels satellite absents de la réponse.',502);
  const chunks:Uint8Array[]=[],expected=Number(cr[2])-Number(cr[1])+1;let bytes=0;
  if(length&&length!==expected){void reader.cancel().catch(()=>{});return json('Taille de la plage satellite incohérente.',502);}
  try{
   while(bytes<expected){const next=await reader.read();if(next.done)throw new Error('Réponse satellite partielle ou interrompue.');bytes+=next.value.length;if(bytes>MAX_BYTES||bytes>expected){void reader.cancel().catch(()=>{});return json('Réponse satellite trop volumineuse.',502);}chunks.push(next.value);}
  }finally{
   // All requested bytes are present. Do not wait for connection finalization
   // or let a stalled EOF turn a complete range into a failed observation.
   void reader.cancel().catch(()=>{});
  }
  const body=new Uint8Array(bytes);let at=0;for(const c of chunks){body.set(c,at);at+=c.length;}
  return new Response(body,{status:206,headers:{'Content-Type':'image/tiff','Content-Length':String(bytes),'Content-Range':r.headers.get('content-range')!,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff','X-Satellite-Transport':'same-origin-range','X-Satellite-Source-Endpoint':attempt?'regional':'bucket'}});
 }catch(error){lastError=error;if(signal.aborted)break;}
 return json('Lecture des pixels satellite interrompue : '+((lastError as Error).name==='TimeoutError'?'délai du fournisseur dépassé':(lastError as Error).message).slice(0,180),502);
}
