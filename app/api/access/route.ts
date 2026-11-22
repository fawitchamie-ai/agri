import { getChatGPTUser } from '@/app/chatgpt-auth';
import { session } from '@/lib/server-auth';
import { body, database, digest, failure, HttpError, json } from '@/lib/server-db';
export async function GET(request: Request) { try {
    const s = await session(request);
    if (!['responsable', 'admin'].includes(s.role))
        throw new HttpError(403, 'La gestion des accès est réservée au responsable.');
    const db = database();
    const [accounts, members, invites] = await Promise.all([
      db.prepare('SELECT id,name,role,created_at AS createdAt FROM accounts WHERE coop_id=? ORDER BY name').bind(s.coopId).all<any>(),
      db.prepare("SELECT owner_id,data FROM business_records WHERE coop_id=? AND kind='member'").bind(s.coopId).all<any>(),
      db.prepare('SELECT id,role,member_id AS memberId,email,created_by AS createdBy,expires_at AS expiresAt,accepted_at AS acceptedAt FROM invitations WHERE coop_id=? ORDER BY expires_at DESC LIMIT 200').bind(s.coopId).all<any>(),
    ]);
    const memberByOwner = new Map<string, { id: string; name: string }>();
    for (const row of members.results) {
      const existing = memberByOwner.get(row.owner_id);
      const data = JSON.parse(row.data);
      if (!existing || String(data.name).localeCompare(existing.name) < 0) memberByOwner.set(row.owner_id, { id: row.id, name: data.name });
    }
    return json({
      accounts: accounts.results.map((account: any) => ({ ...account, memberId: memberByOwner.get(account.id)?.id ?? null, memberName: memberByOwner.get(account.id)?.name ?? null })),
      invitations: invites.results,
    });
}
catch (e) {
    return failure(e);
} }
export async function POST(request: Request) {
    try {
        const b = await body(request), db = database();
        if (b.action === 'accept') {
            const user = await getChatGPTUser();
            if (!user)
                throw new HttpError(401, 'Connectez-vous avec votre compte Cloudflare Access pour rejoindre une coopérative.');
            if (typeof b.code !== 'string' || b.code.length > 200)
                throw new HttpError(400, 'Code d’invitation invalide.');
            const invite = await db.prepare('SELECT * FROM invitations WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?').bind(await digest(b.code.trim()), new Date().toISOString()).first<any>();
            if (!invite)
                throw new HttpError(404, 'Invitation introuvable, expirée ou déjà acceptée.');
            if (invite.coop_id.startsWith('demo-'))
                throw new HttpError(400, 'Une invitation de démonstration ne permet pas d’affecter un compte réel.');
            if (invite.email && invite.email !== user.email.toLowerCase())
                throw new HttpError(403, 'Cette invitation est destinée à une autre adresse.');
            const account = await db.prepare('SELECT * FROM accounts WHERE id=?').bind(user.userId).first<any>();
            if (account && account.coop_id !== invite.coop_id) {
                const owned = await db.prepare('SELECT COUNT(*) AS total FROM business_records WHERE coop_id=? AND owner_id=?').bind(account.coop_id, user.userId).first<any>();
                if (owned?.total > 0 && b.confirmMove !== true)
                    return json({ error: 'Vous possédez des données dans votre coopérative actuelle. Elles y seront conservées et ne seront plus accessibles avec votre nouvelle affectation. Confirmez explicitement le changement.', requiresConfirmation: true }, 409);
            }
            const now = new Date().toISOString(), guard = 'EXISTS (SELECT 1 FROM invitations WHERE id=? AND accepted_by=? AND accepted_at=?)', guardArgs = [invite.id, user.userId, now], statements = [db.prepare('UPDATE invitations SET accepted_by=?,accepted_at=? WHERE id=? AND accepted_at IS NULL').bind(user.userId, now, invite.id), db.prepare(`INSERT INTO accounts (id,name,role,coop_id,created_at) SELECT ?,?,?,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET name=excluded.name,role=excluded.role,coop_id=excluded.coop_id`).bind(user.userId, user.displayName, invite.role, invite.coop_id, now, ...guardArgs)];
            if (invite.role === 'producteur') {
                if (invite.member_id) {
                    statements.push(db.prepare(`UPDATE business_records SET owner_id=?,updated_at=? WHERE id=? AND coop_id=? AND kind='member' AND ${guard}`).bind(user.userId, now, invite.member_id, invite.coop_id, ...guardArgs));
                    const oldHarvests = await db.prepare("SELECT id,data FROM business_records WHERE coop_id=? AND kind IN ('harvest','collection')").bind(invite.coop_id).all<any>();
                    for (const r of oldHarvests.results)
                        if (JSON.parse(r.data).memberId === invite.member_id)
                            statements.push(db.prepare(`UPDATE business_records SET owner_id=? WHERE id=? AND coop_id=? AND ${guard}`).bind(user.userId, r.id, invite.coop_id, ...guardArgs));
                }
                else {
                    statements.push(db.prepare(`INSERT INTO business_records (id,kind,coop_id,owner_id,data,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE ${guard}`).bind(crypto.randomUUID(), 'member', invite.coop_id, user.userId, JSON.stringify({ name: user.displayName, locality: 'À préciser', demo: false }), now, now, ...guardArgs));
                }
            }
            const result = await db.batch(statements);
            if (result[0].meta.changes !== 1)
                throw new HttpError(409, 'Cette invitation vient d’être utilisée.');
            return json({ ok: true, coopId: invite.coop_id, role: invite.role }, 200, { 'Set-Cookie': 'agri_demo=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' });
        }
        const s = await session(request);
        if (!['responsable', 'admin'].includes(s.role))
            throw new HttpError(403, 'La gestion des accès est réservée au responsable.');
        if (s.demo)
            throw new HttpError(403, 'Les invitations réelles sont désactivées dans la démonstration.');
        if (b.action === 'create') {
            if (!['agent', 'producteur'].includes(b.role))
                throw new HttpError(400, 'Un responsable peut inviter un agent ou un producteur.');
            if (b.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) || b.email.length > 200))
                throw new HttpError(400, 'Adresse électronique invalide.');
            if (b.memberId) {
                if (b.role !== 'producteur')
                    throw new HttpError(400, 'Une fiche membre ne peut être liée qu’à une invitation de producteur.');
                const member = await db.prepare("SELECT data FROM business_records WHERE id=? AND coop_id=? AND kind='member'").bind(b.memberId, s.coopId).first<any>();
                if (!member)
                    throw new HttpError(400, 'Membre inconnu dans votre coopérative.');
                if (JSON.parse(member.data).active === false)
                    throw new HttpError(400, 'Réactivez cette fiche membre avant de lui attribuer un accès producteur.');
            }
            const code = crypto.randomUUID() + crypto.randomUUID(), id = crypto.randomUUID(), expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
            await db.prepare('INSERT INTO invitations (id,token_hash,coop_id,role,member_id,email,created_by,expires_at) VALUES (?,?,?,?,?,?,?,?)').bind(id, await digest(code), s.coopId, b.role, b.memberId || null, b.email?.toLowerCase() || null, s.userId, expiresAt).run();
            return json({ id, code, role: b.role, expiresAt }, 201);
        }
        if (b.action === 'revoke') {
            await db.prepare('DELETE FROM invitations WHERE id=? AND coop_id=? AND accepted_at IS NULL').bind(b.id, s.coopId).run();
            return json({ ok: true });
        }
        throw new HttpError(400, 'Action inconnue.');
    }
    catch (e) {
        return failure(e);
    }
}
