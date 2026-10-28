import type { BusinessRecord, RecordKind } from '@/lib/contracts';
import { session, canSee, assertManage } from '@/lib/server-auth';
import { body, database, failure, HttpError, json } from '@/lib/server-db';
import { validateRecord } from '@/lib/server-validation';
import { scienceFor } from '@/lib/server-science';
function record(row: any): BusinessRecord { return { id: row.id, kind: row.kind, coopId: row.coop_id, ownerId: row.owner_id, data: JSON.parse(row.data), createdAt: row.created_at, updatedAt: row.updated_at }; }
export async function GET(request: Request) { try {
    const s = await session(request), db = database();
    const rows = await db.prepare('SELECT * FROM business_records WHERE coop_id=? ORDER BY created_at DESC').bind(s.coopId).all<any>();
    const visible = rows.results.filter(r => canSee(s, r));
    const historyRows = await db.prepare('SELECT record_id,actor_id,data,created_at FROM record_changes WHERE coop_id=? ORDER BY created_at').bind(s.coopId).all<any>();
    const histories = new Map<string, any[]>();
    for (const h of historyRows.results) {
        const list = histories.get(h.record_id) || [];
        list.push({ actorId: h.actor_id, data: JSON.parse(h.data), createdAt: h.created_at });
        histories.set(h.record_id, list);
    }
    const records = visible.map(r => ({ ...record(r), history: histories.get(r.id) || [] }));
    const { rootId: _, ...publicSession } = s;
    return json({ session: publicSession, records });
}
catch (e) {
    return failure(e);
} }
export async function POST(request: Request) {
    try {
        const s = await session(request), b = await body(request), db = database(), kind = b.kind as RecordKind;
        let validated;
        try {
            validated = validateRecord(kind, b.data);
        }
        catch (e) {
            throw new HttpError(400, e instanceof Error ? e.message : 'Données invalides.');
        }
        const { data, warnings } = validated;
        let memberOwnerId: string | undefined;
        const old = b.id ? await db.prepare('SELECT * FROM business_records WHERE id=? AND coop_id=?').bind(b.id, s.coopId).first<any>() : null;
        if (b.id && !old)
            throw new HttpError(404, 'Enregistrement introuvable dans votre coopérative.');
        if (old && old.kind !== kind)
            throw new HttpError(400, 'Le type de l’enregistrement ne peut pas être modifié.');
        if (old && !canSee(s, old))
            throw new HttpError(403, 'Vous ne pouvez pas modifier cet enregistrement.');
        if (s.role === 'producteur' && !['harvest', 'simulation'].includes(kind))
            throw new HttpError(403, 'Le producteur peut enregistrer ses récoltes et simulations.');
        if (kind === 'harvest' && data.status === 'valide' && !['responsable', 'admin', 'agent'].includes(s.role))
            throw new HttpError(403, 'Seul le responsable ou un agent peut valider une récolte.');
        if (old && kind === 'harvest' && JSON.parse(old.data).status === 'valide' && !['admin', 'responsable'].includes(s.role))
            throw new HttpError(403, 'Une récolte validée doit être corrigée par le responsable.');
        if (old && ['harvest','collection'].includes(kind) && JSON.parse(old.data).memberId !== data.memberId)
            throw new HttpError(409, 'Le producteur d’une fiche existante ne peut pas être réaffecté. Créez une fiche distincte pour préserver la provenance.');
        if (old && kind === 'harvest') {
            const previous=JSON.parse(old.data);
            if (['crop','year','territory'].some(key=>previous[key]!==data[key])) {
                const links=await db.prepare("SELECT data FROM business_records WHERE coop_id=? AND kind='collection'").bind(s.coopId).all<any>();
                if(links.results.some(row=>JSON.parse(row.data).harvestId===old.id))
                    throw new HttpError(409, 'Cette récolte est liée à une collecte. Sa culture, sa campagne et son territoire doivent rester cohérents avec ce lien.');
            }
        }
        if (kind === 'harvest' || kind === 'collection') {
            const member = await db.prepare("SELECT * FROM business_records WHERE id=? AND coop_id=? AND kind='member'").bind(data.memberId, s.coopId).first<any>();
            if (!member)
                throw new HttpError(400, 'Le membre choisi ne fait pas partie de votre coopérative.');
            if (s.role === 'producteur' && member.owner_id !== s.userId)
                throw new HttpError(403, 'Vous ne pouvez déclarer que votre propre récolte.');
            memberOwnerId = member.owner_id;
            if (kind === 'harvest') {
                data.producer = JSON.parse(member.data).name;
                memberOwnerId = member.owner_id;
            }
        }
        if (kind === 'simulation' && data.forecastId) {
            const science = await scienceFor(s), f = science.forecasts.find(f => f.id === data.forecastId) || (old && JSON.parse(old.data).forecastId === data.forecastId ? JSON.parse(old.data).forecastSnapshot : undefined);
            if (!f || f.crop !== data.crop || f.year !== data.year || f.territory !== data.territory)
                throw new HttpError(400, 'Prévision incompatible avec la culture, la campagne ou le territoire.');
            if (Math.abs(data.yield - f.yield) > 1e-10)
                throw new HttpError(400, 'Le rendement doit correspondre à la prévision choisie.');
            data.forecastSnapshot = f;
            data.areaDefinition = f.areaDefinition;
            data.hypothesis = `Hypothèse locale fondée sur ${f.level} / ${f.territory}. Définition de la superficie source : ${f.areaDefinition}. La superficie saisie est supposée compatible. Aucune validation parcellaire.`;
        }
        if (kind === 'collection') {
            const others = await db.prepare("SELECT id,data FROM business_records WHERE coop_id=? AND kind='collection' AND id<>?").bind(s.coopId, old?.id || '').all<any>();
            if (others.results.some(r => { const d = JSON.parse(r.data); return d.memberId === data.memberId && d.crop === data.crop && d.year === data.year && d.territory === data.territory && d.status !== 'annule'; }))
                throw new HttpError(409, 'Une collecte est déjà planifiée pour ce membre, cette culture et cette campagne. Modifiez cette ligne pour éviter un double compte.');
            if (data.harvestId) {
                const harvest = await db.prepare("SELECT * FROM business_records WHERE id=? AND coop_id=? AND kind='harvest'").bind(data.harvestId, s.coopId).first<any>();
                if (!harvest)
                    throw new HttpError(400, 'Récolte source introuvable.');
                const h = JSON.parse(harvest.data);
                if (h.memberId !== data.memberId || h.crop !== data.crop || h.year !== data.year || h.territory !== data.territory)
                    throw new HttpError(400, 'La récolte liée ne correspond pas à cette collecte.');
            }
        }
        if (kind === 'harvest') {
            const others = await db.prepare("SELECT id,data FROM business_records WHERE coop_id=? AND kind='harvest' AND id<>?").bind(s.coopId, old?.id || '').all<any>();
            if (others.results.some(r => { const d = JSON.parse(r.data); return d.memberId === data.memberId && d.crop === data.crop && d.year === data.year && d.date === data.date && d.territory === data.territory; }))
                warnings.push('Doublon probable : une récolte de ce membre existe déjà pour cette culture et cette date. Aucune donnée n’a été supprimée.');
        }
        const now = new Date().toISOString(), id = old?.id || crypto.randomUUID(), ownerId = old?.owner_id || memberOwnerId || s.userId;
        data.demo = s.demo;
        const stmts = [];
        const activeCollection = kind === 'collection' && data.status !== 'annule';
        const guard = activeCollection ? "NOT EXISTS (SELECT 1 FROM business_records other WHERE other.coop_id=? AND other.kind='collection' AND other.id<>? AND json_extract(other.data,'$.memberId')=? AND json_extract(other.data,'$.crop')=? AND json_extract(other.data,'$.year')=? AND json_extract(other.data,'$.territory')=? AND json_extract(other.data,'$.status')<>'annule')" : '1=1';
        const guardArgs = activeCollection ? [s.coopId, id, data.memberId, data.crop, data.year, data.territory] : [];
        if (old) {
            if (b.updatedAt && b.updatedAt !== old.updated_at)
                throw new HttpError(409, 'Cet enregistrement a changé. Actualisez avant de corriger.');
            stmts.push(db.prepare('INSERT INTO record_changes (id,record_id,coop_id,actor_id,data,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(), id, s.coopId, s.userId, old.data, now));
            stmts.push(db.prepare(`UPDATE business_records SET data=?,updated_at=? WHERE id=? AND coop_id=? AND ${guard}`).bind(JSON.stringify(data), now, id, s.coopId, ...guardArgs));
        }
        else
            stmts.push(db.prepare(`INSERT INTO business_records (id,kind,coop_id,owner_id,data,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE ${guard}`).bind(id, kind, s.coopId, ownerId, JSON.stringify(data), now, now, ...guardArgs));
        const results = await db.batch(stmts);
        if (results[results.length - 1].meta.changes !== 1)
            throw new HttpError(409, 'Cette collecte vient d’être enregistrée ailleurs. Actualisez pour éviter un double compte.');
        return json({ record: { id, kind, coopId: s.coopId, ownerId, data, createdAt: old?.created_at || now, updatedAt: now }, warnings }, old ? 200 : 201);
    }
    catch (e) {
        return failure(e);
    }
}
export async function DELETE(request: Request) { try {
    const s = await session(request);
    assertManage(s);
    const b = await body(request);
    if (b.confirm !== true)
        throw new HttpError(400, 'Confirmation de suppression requise.');
    const db = database(), old = await db.prepare('SELECT * FROM business_records WHERE id=? AND coop_id=?').bind(b.id, s.coopId).first<any>();
    if (!old)
        throw new HttpError(404, 'Enregistrement introuvable.');
    if (old.kind === 'harvest') {
        const linked = await db.prepare("SELECT data FROM business_records WHERE coop_id=? AND kind='collection'").bind(s.coopId).all<any>();
        if (linked.results.some(r => JSON.parse(r.data).harvestId === b.id))
            throw new HttpError(409, 'Cette récolte est liée à une collecte. Modifiez ou retirez la liaison avant de la supprimer.');
    }
    if (old.kind === 'member') {
        const linked = await db.prepare("SELECT data FROM business_records WHERE coop_id=? AND kind IN ('harvest','collection')").bind(s.coopId).all<any>();
        if (linked.results.some(r => JSON.parse(r.data).memberId === b.id))
            throw new HttpError(409, 'Ce membre a des récoltes ou collectes. Conservez-le pour préserver les références.');
    }
    await db.batch([db.prepare('INSERT INTO record_changes (id,record_id,coop_id,actor_id,data,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(), old.id, s.coopId, s.userId, JSON.stringify({ deleted: true, previous: JSON.parse(old.data) }), new Date().toISOString()), db.prepare('DELETE FROM business_records WHERE id=? AND coop_id=?').bind(old.id, s.coopId)]);
    return json({ ok: true });
}
catch (e) {
    return failure(e);
} }
