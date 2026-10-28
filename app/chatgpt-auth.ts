import { redirect } from 'next/navigation';
import { currentAccessIdentity, type AccessIdentity } from '../lib/cloudflare-access';
// Compatibility aliases retained for the business API. Identity comes only from
// a verified Cloudflare Access JWT in the Worker, never from visitor headers.
export type ChatGPTUser=AccessIdentity;
export async function getChatGPTUser():Promise<AccessIdentity|null>{return currentAccessIdentity();}
export async function requireChatGPTUser(returnTo:string):Promise<AccessIdentity>{
  const user=await getChatGPTUser();if(user)return user;redirect(chatGPTSignInPath(returnTo));
}
export function chatGPTSignInPath(returnTo='/'):string{return safeRelativePath(returnTo);}
export function chatGPTSignOutPath(_returnTo='/'):string{return '/cdn-cgi/access/logout';}
function safeRelativePath(path:string){
  if(!path.startsWith('/')||path.startsWith('//'))return '/';
  try{const url=new URL(path,'https://app.local');return url.origin==='https://app.local'?url.pathname+url.search+url.hash:'/';}catch{return '/';}
}
