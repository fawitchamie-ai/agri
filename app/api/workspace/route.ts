import type { BusinessRecord, RecordKind } from '@/lib/contracts';
import { session, canSee, canManage, assertManage } from '@/lib/server-auth';
import { body, database, failure, HttpError, json } from '@/lib/server-db';
import { validateRecord } from '@/lib/server-validation';
import { scienceFor } from '@/lib/server-science';
import { validateConfig } from '@/lib/seasonal/validation';
import { migrateInputs } from '@/lib/seasonal/provenance';
import { decodeCampaignValue } from '@/lib/seasonal/storage';
function record(row: any): BusinessRecord { return { id: row.id, kind: row.kind, coopId: row.coop_id, ownerId: row.owner_id, data: JSON.parse(row.data), createdAt: row.created_at, updatedAt: row.updated_at }; }
function clockMinutes(value: string) { const [hours,minutes]=value.split(':').map(Number); return hours*60+minutes; }
function clockText(value: number) { return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`; }
export async function GET(request: Request) { try {
    const s = await session(request), db = database();
    const rows = await db.prepare('SELECT * FROM business_records WHERE coop_id=? ORDER BY created_at DESC').bind(s.coopId).all<any>();
    const visible = rows.results.filter(r => canSee(s, r) || ['capacity','pumpBooking'].includes(r.kind));
    const historyRows = await db.prepare('SELECT record_id,actor_id,data,created_at FROM record_changes WHERE coop_id=? ORDER BY created_at').bind(s.coopId).all<any>();
    const histories = new Map<string, any[]>();
    for (const h of historyRows.results) {
        const list = histories.get(h.record_id) || [];
        list.push({ actorId: h.actor_id, data: JSON.parse(h.data), createdAt: h.created_at });
        histories.set(h.record_id, list);
    }
    const records = visible.map(r => {
        const item=record(r), ownerVisible=r.kind!=='pumpBooking'||r.owner_id===s.userId||canManage(s);
        return {...item,ownerId:ownerVisible?item.ownerId:'',history:r.kind==='pumpBooking'&&!ownerVisible?[]:histories.get(r.id)||[]};
    });
    const { rootId: _, ...publicSession } = s;
    const cooperatives = s.demo
      ? [{ coopId: s.coopId, name: `${s.coopId.includes('demo-b') ? 'Coopérative B' : 'Coopérative A'} · démonstration`, role: s.role }]
      : (await db.prepare(`SELECT access.coop_id AS coopId,access.role,profile.name
          FROM account_cooperatives access LEFT JOIN cooperative_profiles profile ON profile.coop_id=access.coop_id
          WHERE access.account_id=? ORDER BY access.created_at,access.coop_id`).bind(s.userId).all<any>()).results
        .map((entry:any) => ({
          coopId: entry.coopId,
          name: entry.name || (entry.coopId === `real-${s.userId}` ? 'Mon espace personnel' : 'Ma coopérative'),
          role: s.role === 'admin' ? 'admin' : entry.role,
        }));
    return json({ session: { ...publicSession, cooperatives }, records });
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
        if (['member', 'capacity'].includes(kind) && !['responsable', 'admin'].includes(s.role))
            throw new HttpError(403, 'La gestion des membres et des moyens est réservée au responsable.');
        if(kind==='pumpBooking'&&s.demo)throw new HttpError(403,'Les réservations de pompe nécessitent un espace coopératif réel.');
        let memberOwnerId: string | undefined;
        const old = b.id ? await db.prepare('SELECT * FROM business_records WHERE id=? AND coop_id=?').bind(b.id, s.coopId).first<any>() : null;
        if (b.id && !old)
            throw new HttpError(404, 'Enregistrement introuvable dans votre coopérative.');
        if (old && old.kind !== kind)
            throw new HttpError(400, 'Le type de l’enregistrement ne peut pas être modifié.');
        if (old && !canSee(s, old))
            throw new HttpError(403, 'Vous ne pouvez pas modifier cet enregistrement.');
        if(old&&kind==='pumpBooking'&&b.updatedAt!==old.updated_at)
            throw new HttpError(409,'Cette réservation a changé. Actualisez avant de la modifier.');
        const pumpCapacityChanged=!!old&&kind==='capacity'&&(()=>{
            const before=JSON.parse(old.data);
            return ['pumpFlowM3h','pumpDays','pumpStartHHmm','pumpEndHHmm'].some(key=>JSON.stringify(before[key]??null)!==JSON.stringify(data[key]??null));
        })();
        if(pumpCapacityChanged){
            const bookings=await db.prepare("SELECT id FROM business_records WHERE coop_id=? AND kind='pumpBooking' AND json_extract(data,'$.pumpId')=? AND json_extract(data,'$.status')='reserved' LIMIT 1").bind(s.coopId,old.id).first<any>();
            if(bookings)throw new HttpError(409,'Annulez les créneaux réservés avant de modifier le débit ou les disponibilités de cette pompe.');
        }
        if (s.role === 'producteur' && !['harvest', 'simulation', 'pumpBooking'].includes(kind))
            throw new HttpError(403, 'Le producteur peut enregistrer ses récoltes, ses simulations et réserver une pompe pour sa propre campagne.');
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
        if(kind==='pumpBooking'){
            if(data.status==='cancelled'){
                if(!old)throw new HttpError(400,'Une réservation doit exister avant son annulation.');
                const previous=JSON.parse(old.data);
                if(previous.status!=='reserved')throw new HttpError(409,'Cette réservation n’est plus active. Actualisez la liste.');
                Object.assign(data,previous,{status:'cancelled',cancelledAt:new Date().toISOString()});
            }else{
                if(old&&JSON.parse(old.data).status!=='reserved')throw new HttpError(409,'Cette réservation a déjà été annulée. Créez un nouveau créneau.');
                const pumpRow=await db.prepare("SELECT * FROM business_records WHERE id=? AND coop_id=? AND kind='capacity'").bind(data.pumpId,s.coopId).first<any>();
                if(!pumpRow)throw new HttpError(404,'Pompe introuvable dans cette coopérative.');
                const pumpData=JSON.parse(pumpRow.data),flow=Number(pumpData.pumpFlowM3h);
                if(!Number.isFinite(flow)||flow<=0||!Array.isArray(pumpData.pumpDays)||!pumpData.pumpDays.length)throw new HttpError(409,'Le débit et les disponibilités de cette pompe ne sont pas renseignés.');
                const campaign=await db.prepare('SELECT * FROM seasonal_campaigns WHERE id=? AND coop_id=? AND archived_at IS NULL').bind(data.campaignId,s.coopId).first<any>();
                if(!campaign||!canSee(s,campaign))throw new HttpError(404,'Campagne introuvable dans votre espace.');
                if(campaign.demo)throw new HttpError(403,'Une campagne de démonstration ne peut pas réserver une pompe réelle.');
                let config:any,plan:any;
                try{config=validateConfig(migrateInputs(decodeCampaignValue(campaign.config)));plan=decodeCampaignValue(campaign.plan);}catch{throw new HttpError(409,'La campagne enregistrée doit être vérifiée avant de réserver la pompe.');}
                if(config.system.sourceFlowM3h===null||Math.abs(config.system.sourceFlowM3h-flow)>Math.max(0.001,flow*0.001))throw new HttpError(409,'Le débit de la pompe ne correspond pas au débit utilisé pour recalculer cette campagne. Actualisez les paramètres et enregistrez la campagne.');
                if(plan?.status==='blocked')throw new HttpError(409,'Le bilan d’eau enregistré est indisponible. Aucun créneau ne peut être déduit.');
                const day=(plan?.days??[]).find((item:any)=>item.date===data.date),water=day?.intervention;
                if(data.date<config.asOfDate||!water||water.type!=='proposed'||!Number.isFinite(water.durationHours)||water.durationHours<=0||!Number.isFinite(water.sourceM3)||water.sourceM3<=0)throw new HttpError(409,'Aucun arrosage futur calculé et mesuré par le moteur n’existe à cette date.');
                const weekday=new Date(data.date+'T00:00:00Z').getUTCDay(),days=pumpData.pumpDays as number[];
                if(!days.includes(weekday))throw new HttpError(409,'La pompe n’est pas disponible ce jour-là.');
                const start=clockMinutes(data.startHHmm),durationMinutes=Math.ceil(water.durationHours*60),end=start+durationMinutes;
                if(end>24*60)throw new HttpError(409,'La durée calculée dépasse la fin de la journée. Choisissez un autre créneau.');
                const availabilityStart=clockMinutes(pumpData.pumpStartHHmm),availabilityEnd=clockMinutes(pumpData.pumpEndHHmm);
                if(start<availabilityStart||end>availabilityEnd)throw new HttpError(409,'Le créneau calculé dépasse les horaires déclarés pour la pompe.');
                Object.assign(data,{endHHmm:clockText(end),durationMinutes,volumeM3:water.sourceM3,campaignName:config.name,campaignRevision:campaign.revision,pumpName:pumpData.point||'Pompe partagée',flowM3h:flow,pumpUpdatedAt:pumpRow.updated_at,status:'reserved'});
            }
        }
        const now = new Date().toISOString(), id = old?.id || crypto.randomUUID(), ownerId = old?.owner_id || memberOwnerId || s.userId;
        data.demo = s.demo;
        const stmts = [];
        const activeCollection = kind === 'collection' && data.status !== 'annule';
        const activePumpBooking=kind==='pumpBooking'&&data.status==='reserved';
        const baseGuard = activeCollection ? "NOT EXISTS (SELECT 1 FROM business_records other WHERE other.coop_id=? AND other.kind='collection' AND other.id<>? AND json_extract(other.data,'$.memberId')=? AND json_extract(other.data,'$.crop')=? AND json_extract(other.data,'$.year')=? AND json_extract(other.data,'$.territory')=? AND json_extract(other.data,'$.status')<>'annule')" : activePumpBooking ? "NOT EXISTS (SELECT 1 FROM business_records other WHERE other.coop_id=? AND other.kind='pumpBooking' AND other.id<>? AND json_extract(other.data,'$.pumpId')=? AND json_extract(other.data,'$.date')=? AND json_extract(other.data,'$.status')='reserved' AND json_extract(other.data,'$.startHHmm')<? AND json_extract(other.data,'$.endHHmm')>?) AND EXISTS (SELECT 1 FROM business_records pump WHERE pump.id=? AND pump.coop_id=? AND pump.kind='capacity' AND pump.updated_at=?) AND EXISTS (SELECT 1 FROM seasonal_campaigns c WHERE c.id=? AND c.coop_id=? AND c.revision=?)" : '1=1';
        const baseGuardArgs = activeCollection ? [s.coopId, id, data.memberId, data.crop, data.year, data.territory] : activePumpBooking ? [s.coopId,id,data.pumpId,data.date,data.endHHmm,data.startHHmm,data.pumpId,s.coopId,data.pumpUpdatedAt,data.campaignId,s.coopId,data.campaignRevision] : [];
        const capacityGuard=pumpCapacityChanged?" AND NOT EXISTS (SELECT 1 FROM business_records booking WHERE booking.coop_id=? AND booking.kind='pumpBooking' AND json_extract(booking.data,'$.pumpId')=? AND json_extract(booking.data,'$.status')='reserved')":'';
        const guard=baseGuard+capacityGuard,guardArgs=[...baseGuardArgs,...(pumpCapacityChanged?[s.coopId,id]:[])];
        if (old) {
            if (b.updatedAt && b.updatedAt !== old.updated_at)
                throw new HttpError(409, 'Cet enregistrement a changé. Actualisez avant de corriger.');
            stmts.push(db.prepare(`INSERT INTO record_changes (id,record_id,coop_id,actor_id,data,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM business_records current WHERE current.id=? AND current.coop_id=? AND current.updated_at=? AND ${guard})`).bind(crypto.randomUUID(), id, s.coopId, s.userId, old.data, now, id, s.coopId, old.updated_at, ...guardArgs));
            stmts.push(db.prepare(`UPDATE business_records SET data=?,updated_at=? WHERE id=? AND coop_id=? AND updated_at=? AND ${guard}`).bind(JSON.stringify(data), now, id, s.coopId, old.updated_at, ...guardArgs));
        }
        else
            stmts.push(db.prepare(`INSERT INTO business_records (id,kind,coop_id,owner_id,data,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE ${guard}`).bind(id, kind, s.coopId, ownerId, JSON.stringify(data), now, now, ...guardArgs));
        const results = await db.batch(stmts);
        if (results[results.length - 1].meta.changes !== 1)
            throw new HttpError(409,kind==='pumpBooking'?'Le créneau vient d’être pris ou la campagne/pompe a changé. Actualisez avant de réessayer.':pumpCapacityChanged?'Les disponibilités de la pompe viennent de changer ou un créneau a été réservé. Actualisez avant de réessayer.':'Cette collecte vient d’être enregistrée ailleurs. Actualisez pour éviter un double compte.');
        return json({ record: { id, kind, coopId: s.coopId, ownerId, data, createdAt: old?.created_at || now, updatedAt: now }, warnings }, old ? 200 : 201);
    }
    catch (e) {
        return failure(e);
    }
}
export async function DELETE(request: Request) { try {
    const s = await session(request);
    const b = await body(request);
    if (b.confirm !== true)
        throw new HttpError(400, 'Confirmation de suppression requise.');
    const db = database(), old = await db.prepare('SELECT * FROM business_records WHERE id=? AND coop_id=?').bind(b.id, s.coopId).first<any>();
    if (!old)
        throw new HttpError(404, 'Enregistrement introuvable.');
    if(!canManage(s)&&!(old.kind==='pumpBooking'&&old.owner_id===s.userId))assertManage(s);
    if (['member', 'capacity'].includes(old.kind) && !['responsable', 'admin'].includes(s.role))
        throw new HttpError(403, 'La gestion des membres et des moyens est réservée au responsable.');
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
    if(old.kind==='capacity'){
        const bookings=await db.prepare("SELECT data FROM business_records WHERE coop_id=? AND kind='pumpBooking' AND json_extract(data,'$.pumpId')=? AND json_extract(data,'$.status')='reserved'").bind(s.coopId,old.id).all<any>();
        if(bookings.results.length)throw new HttpError(409,'Cette pompe a des créneaux réservés. Annulez-les avant de retirer le matériel.');
    }
    if(old.kind==='pumpBooking'&&JSON.parse(old.data).status==='reserved')throw new HttpError(409,'Annulez la réservation avant de supprimer son historique.');
    const deleteCapacityGuard=old.kind==='capacity'?" AND NOT EXISTS (SELECT 1 FROM business_records booking WHERE booking.coop_id=? AND booking.kind='pumpBooking' AND json_extract(booking.data,'$.pumpId')=? AND json_extract(booking.data,'$.status')='reserved')":'';
    const deleteArgs=old.kind==='capacity'?[s.coopId,old.id]:[];
    const stamp=new Date().toISOString();
    const results=await db.batch([
        db.prepare(`INSERT INTO record_changes (id,record_id,coop_id,actor_id,data,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM business_records current WHERE current.id=? AND current.coop_id=? AND current.updated_at=?${deleteCapacityGuard})`).bind(crypto.randomUUID(),old.id,s.coopId,s.userId,JSON.stringify({deleted:true,previous:JSON.parse(old.data)}),stamp,old.id,s.coopId,old.updated_at,...deleteArgs),
        db.prepare(`DELETE FROM business_records WHERE id=? AND coop_id=? AND updated_at=?${deleteCapacityGuard}`).bind(old.id,s.coopId,old.updated_at,...deleteArgs),
    ]);
    if(results[1].meta.changes!==1)throw new HttpError(409,old.kind==='capacity'?'Cette pompe a reçu une réservation. Annulez les créneaux avant de retirer le matériel.':'Cet enregistrement a changé. Actualisez avant de le supprimer.');
    return json({ ok: true });
}
catch (e) {
    return failure(e);
} }
