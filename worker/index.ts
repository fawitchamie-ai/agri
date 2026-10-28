import handler from 'vinext/server/fetch-handler';
import { authorizeAccessRequest, runWithAccessIdentity } from '../lib/cloudflare-access';
export default {
  async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext):Promise<Response>{
    const authorized=await authorizeAccessRequest(request,env);
    if(authorized instanceof Response)return authorized;
    return runWithAccessIdentity(authorized.identity,()=>handler.fetch(authorized.request,env,ctx));
  },
};
