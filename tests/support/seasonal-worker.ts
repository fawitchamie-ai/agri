// Test entry point only. Fixed test identity never ships in the production Worker.
import {POST,GET} from '../../app/api/seasonal/route';
import {runWithAccessIdentity} from '../../lib/cloudflare-access';
export default {fetch(request:Request){return runWithAccessIdentity({userId:'runtime-owner',email:'runtime@example.test',displayName:'Runtime test',fullName:null},()=>request.method==='GET'?GET(request):POST(request));}};
