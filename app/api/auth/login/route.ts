import { env } from 'cloudflare:workers';
import { accessConfiguration, generateAccessLoginURL, safeAccessReturnPath, type AccessEnvironment } from '@/lib/cloudflare-access';

export async function GET(request:Request){
  try{
    const settings=accessConfiguration(env as unknown as AccessEnvironment);
    const current=new URL(request.url);
    const destination=new URL(safeAccessReturnPath(current.searchParams.get('returnTo')),current.origin);
    const loginURL=generateAccessLoginURL(destination,settings);
    return new Response(null,{status:302,headers:{Location:loginURL,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }catch{
    return Response.json({error:'La connexion Cloudflare Access n’est pas encore configurée.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
