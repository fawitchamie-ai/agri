/** Same-origin fallback transfers public TIFF bytes only; decoding stays in the browser. */
export async function relaySentinelRequest(asset:string,options:RequestInit,fetcher:typeof fetch):Promise<Response>{
 const head=options.method==='HEAD',query=new URLSearchParams({satellite:'raster',asset,...(head?{head:'1'}:{})});
 const headers=new Headers();if(!head){const range=new Headers(options.headers).get('range');if(!range)throw new Error('Plage de pixels satellite absente.');headers.set('range',range);}
 const response=await fetcher('/api/seasonal?'+query,{method:'GET',headers,signal:options.signal,credentials:'same-origin',redirect:'manual'});
 if(!response.ok){let message='Relais satellite HTTP '+response.status;try{const b=await response.json() as {error?:string};if(b.error)message=b.error;}catch{/* retain status */}throw new Error(message);}
 if(!head)return response;
 const {size}=await response.json() as {size?:number};if(!Number.isSafeInteger(size)||size!<1)throw new Error('Taille satellite reçue invalide.');
 return new Response(null,{status:200,headers:{'content-length':String(size)}});
}
export function canRelaySentinel(url:string){
 const u=new URL(url);
 return ['deafrica-sentinel-2.s3.af-south-1.amazonaws.com','sentinel-cogs.s3.us-west-2.amazonaws.com','deafrica-sentinel-2-l2a-c1.s3.af-south-1.amazonaws.com','e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com'].includes(u.hostname)&&
  /^\/(sentinel-2-c1-l2a|sentinel-s2-l2a-cogs)\//.test(u.pathname);
}
