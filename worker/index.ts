import handler from 'vinext/server/fetch-handler';
import { authorizeAccessRequest, clearStaleDemoCookie, runWithAccessIdentity } from '../lib/cloudflare-access';
import {redirectLegacyWebInterface} from './web-routes';
import {GET as seasonalGet,POST as seasonalPost} from '../app/api/seasonal/route';
export default {
  async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext):Promise<Response>{
    const authorized=await authorizeAccessRequest(request,env);
    if(authorized instanceof Response)return authorized;
    // JSON/image API requests need no React/Vinext page routing. Keep this
    // inside the same verified identity context as the framework routes.
    if(new URL(authorized.request.url).pathname==='/api/seasonal'){
      const response=await runWithAccessIdentity(authorized.identity,()=>authorized.request.method==='GET'?seasonalGet(authorized.request):authorized.request.method==='POST'?seasonalPost(authorized.request):new Response(null,{status:405,headers:{Allow:'GET, POST'}}));
      return clearStaleDemoCookie(response,authorized.request,authorized.identity);
    }
    const redirect=redirectLegacyWebInterface(authorized.request);
    if(redirect)return clearStaleDemoCookie(redirect,authorized.request,authorized.identity);
    const response=await runWithAccessIdentity(authorized.identity,()=>handler.fetch(authorized.request,env,ctx));
    return clearStaleDemoCookie(response,authorized.request,authorized.identity);
  },
};
