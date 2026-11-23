import {getChatGPTUser} from '@/app/chatgpt-auth';
import {session} from '@/lib/server-auth';
import {body,database,failure,HttpError,json} from '@/lib/server-db';
export async function POST(request:Request){try{
  const s=await session(request);
  if(s.demo)throw new HttpError(401,'Connectez-vous avec Cloudflare Access pour changer d’espace réel.');
  const b=await body(request);
  if(b.action!=='switch'||typeof b.coopId!=='string'||b.coopId.length>300)throw new HttpError(400,'Choisissez un espace de travail valide.');
  const db=database(),membership=await db.prepare('SELECT role FROM account_cooperatives WHERE account_id=? AND coop_id=?').bind(s.userId,b.coopId).first<any>();
  if(!membership)throw new HttpError(404,'Cet espace n’est pas associé à votre compte.');
  await db.prepare('UPDATE accounts SET name=?,role=?,coop_id=? WHERE id=?').bind(s.name,membership.role,b.coopId,s.userId).run();
  return json({ok:true,coopId:b.coopId});
}catch(error){return failure(error);}}
export async function DELETE(request:Request){try{await body(request);const identity=await getChatGPTUser();if(!identity)throw new HttpError(401,'La démonstration locale ne dispose pas d’un compte Cloudflare Access.');return json({ok:true},200,{'Set-Cookie':'agri_demo=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0'});}catch(error){return failure(error);}}
