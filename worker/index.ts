import handler from 'vinext/server/fetch-handler';
import { authorizeAccessRequest, runWithAccessIdentity } from '../lib/cloudflare-access';
import {loadingShell} from './shell';
import {GET as seasonalGet,POST as seasonalPost} from '../app/api/seasonal/route';
export default {
  async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext):Promise<Response>{
    const authorized=await authorizeAccessRequest(request,env);
    if(authorized instanceof Response)return authorized;
    // JSON/image API requests need no React/Vinext page routing. Keep this
    // inside the same verified identity context as the framework routes.
    if(new URL(authorized.request.url).pathname==='/api/seasonal'){
      return runWithAccessIdentity(authorized.identity,()=>authorized.request.method==='GET'?seasonalGet(authorized.request):authorized.request.method==='POST'?seasonalPost(authorized.request):new Response(null,{status:405,headers:{Allow:'GET, POST'}}));
    }
    const shell=await loadingShell(authorized.request,(env as unknown as {ASSETS?:{fetch:(r:Request)=>Promise<Response>}}).ASSETS);
    if(shell)return shell;
    return runWithAccessIdentity(authorized.identity,()=>handler.fetch(authorized.request,env,ctx));
  },
};
