import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import type { Session, Role } from './contracts';
import { database, HttpError, digest } from './server-db';
export type ServerSession = Session & {
    rootId?: string;
};
export function cookieToken(req: Request) { return req.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith('agri_demo='))?.slice(10) || ''; }
export async function session(req: Request): Promise<ServerSession> {
    const db = database(), token = cookieToken(req);
    if (token) {
        const row = await db.prepare('SELECT * FROM demo_sessions WHERE token=? AND expires_at>?').bind(await digest(token), new Date().toISOString()).first<any>();
        if (row)
            return { userId: row.user_id, name: row.name, role: row.role, coopId: row.coop_id, demo: true, rootId: row.root_id };
    }
    const user = await getChatGPTUser();
    if (!user)
        throw new HttpError(401, 'Connectez-vous ou ouvrez un espace de démonstration.');
    const adminIds = ((env as unknown as {
        ADMIN_USER_IDS?: string;
    }).ADMIN_USER_IDS || '').split(',').map(s => s.trim());
    let account = await db.prepare('SELECT * FROM accounts WHERE id=?').bind(user.userId).first<any>();
    if (!account) {
        const now = new Date().toISOString();
        await db.prepare('INSERT OR IGNORE INTO accounts (id,name,role,coop_id,created_at) VALUES (?,?,?,?,?)').bind(user.userId, user.displayName, 'responsable', 'real-' + user.userId, now).run();
        account = await db.prepare('SELECT * FROM accounts WHERE id=?').bind(user.userId).first<any>();
    }
    return { userId: user.userId, name: user.displayName, role: adminIds.includes(user.userId) ? 'admin' : account.role as Role, coopId: account.coop_id, demo: false };
}
export function canManage(s: Session) { return s.role === 'admin' || s.role === 'responsable' || s.role === 'agent'; }
export function assertManage(s: Session) { if (!canManage(s))
    throw new HttpError(403, 'Cette action est réservée au responsable ou à un agent.'); }
export function canSee(s: Session, row: any) { return row.coop_id === s.coopId && (s.role !== 'producteur' || row.owner_id === s.userId); }
