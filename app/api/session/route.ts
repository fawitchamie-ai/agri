import {getChatGPTUser} from '@/app/chatgpt-auth';
import {body,failure,HttpError,json} from '@/lib/server-db';
export async function DELETE(request:Request){try{await body(request);const identity=await getChatGPTUser();if(!identity)throw new HttpError(401,'La démonstration locale ne dispose pas d’un compte Cloudflare Access.');return json({ok:true},200,{'Set-Cookie':'agri_demo=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0'});}catch(error){return failure(error);}}
