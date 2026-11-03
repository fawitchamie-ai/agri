import handler from 'vinext/server/fetch-handler';
import { authorizeAccessRequest, runWithAccessIdentity } from '../lib/cloudflare-access';
import {loadingShell} from './shell';
export default {
  async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext):Promise<Response>{
    const authorized=await authorizeAccessRequest(request,env);
    if(authorized instanceof Response)return authorized;
    const shell=await loadingShell(authorized.request,(env as unknown as {ASSETS?:{fetch:(r:Request)=>Promise<Response>}}).ASSETS);
    if(shell)return shell;
    return runWithAccessIdentity(authorized.identity,()=>handler.fetch(authorized.request,env,ctx));
  },
};
