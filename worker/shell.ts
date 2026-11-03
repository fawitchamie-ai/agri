/** Only the public initial loading document is cached at build time. The caller
 * MUST authorize before invoking this helper. RSC and actions stay dynamic. */
export async function loadingShell(request:Request,assets?:{fetch:(r:Request)=>Promise<Response>}):Promise<Response|null>{
 const u=new URL(request.url);
 if(!assets||u.pathname!=='/'||!['GET','HEAD'].includes(request.method)||request.headers.has('rsc')||u.searchParams.has('_rsc')||request.headers.get('accept')?.includes('text/x-component'))return null;
 const response=await assets.fetch(new Request(new URL('/_shell/index.html',u),{method:request.method}));
 if(!response.ok)return null; // build renderer and local dev use normal SSR
 const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');headers.set('X-Agri-Rendering','build-shell');
 return new Response(response.body,{status:response.status,headers});
}
