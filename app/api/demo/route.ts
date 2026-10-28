import { body, database, digest, failure, HttpError, json } from '@/lib/server-db';
import { cookieToken } from '@/lib/server-auth';
import type { Role } from '@/lib/contracts';
export async function POST(request: Request) {
    try {
        const b = await body(request);
        if (!['admin', 'responsable', 'agent', 'producteur'].includes(b.role))
            throw new HttpError(400, 'Rôle inconnu.');
        if (!['demo-a', 'demo-b'].includes(b.coopId))
            throw new HttpError(400, 'Coopérative de démonstration inconnue.');
        const db = database(), previous = cookieToken(request);
        const prev = previous ? await db.prepare('SELECT root_id FROM demo_sessions WHERE token=? AND expires_at>?').bind(await digest(previous), new Date().toISOString()).first<any>() : null;
        const rootId = prev?.root_id || crypto.randomUUID();
        const scope = b.coopId + ':' + rootId, role = b.role as Role, token = crypto.randomUUID() + crypto.randomUUID(), now = new Date().toISOString();
        const userId = (role === 'producteur' ? 'demo-producer:' : 'demo-' + role + ':') + scope;
        await db.prepare('INSERT INTO demo_sessions (token,root_id,user_id,name,role,coop_id,expires_at) VALUES (?,?,?,?,?,?,?)').bind(await digest(token), rootId, userId, role === 'producteur' ? 'Afi Mensah (démo)' : 'Espace pédagogique', role, scope, new Date(Date.now() + 7 * 86400000).toISOString()).run();
        const memberId = 'm-producteur:' + scope;
        await db.prepare('INSERT OR IGNORE INTO business_records (id,kind,coop_id,owner_id,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(memberId, 'member', scope, 'demo-producer:' + scope, JSON.stringify({ name: 'Afi Mensah (démo)', locality: 'Localité de démonstration', demo: true }), now, now).run();
        return json({ session: { userId, name: role === 'producteur' ? 'Afi Mensah (démo)' : 'Espace pédagogique', role, coopId: scope, demo: true } }, 200, { 'Set-Cookie': `agri_demo=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}` });
    }
    catch (e) {
        return failure(e);
    }
}
export async function DELETE(request: Request) { try {
    await body(request);
    const token = cookieToken(request);
    if (token)
        await database().prepare('DELETE FROM demo_sessions WHERE token=?').bind(await digest(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': 'agri_demo=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' });
}
catch (e) {
    return failure(e);
} }
