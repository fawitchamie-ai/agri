import {authoritativeLand,startLandJob,stepLandJob,landJobStatus} from '@/lib/seasonal/land-jobs';
import {planSeason,yieldCsv} from '@/lib/seasonal/yield';
import {loadLandAssessment} from '@/lib/seasonal/land-provider';
import {migrateInputs} from '@/lib/seasonal/provenance';
import {validateParcel,parcelMetrics} from '@/lib/seasonal/parcel';
import { body, database, failure, HttpError, json } from '@/lib/server-db';
import { session, canSee } from '@/lib/server-auth';
import { upsertEvent, waterPlanCsv } from '@/lib/seasonal/engine';
import { validateConfig, validateEvents, InputError } from '@/lib/seasonal/validation';
import { COUNTRIES, type Campaign } from '@/lib/seasonal/types';
import {terrestrialSoilPoint} from '@/lib/seasonal/land';
import { loadEnvironment } from '@/lib/seasonal/environment';
import { loadForecast } from '@/lib/seasonal/weather';
import { seasonalCapabilities } from '@/lib/seasonal/capabilities';
import { cropById } from '@/lib/seasonal/catalog';
import { searchPlaces } from '@/lib/seasonal/places';

function campaign(row: any): Campaign { return { id: row.id, revision: row.revision, config: migrateInputs(JSON.parse(row.config)), events: JSON.parse(row.events), plan: JSON.parse(row.plan), updatedAt: row.updated_at, demo: !!row.demo }; }
async function readable(id: string, request: Request) {
  const s = await session(request), db = database();
  const row = await db.prepare('SELECT * FROM seasonal_campaigns WHERE id=? AND coop_id=?').bind(id, s.coopId).first<any>();
  if (!row || !canSee(s, row)) throw new HttpError(404, 'Campagne introuvable dans votre espace.');
  return { s, db, row };
}
function error(e: unknown) { return e instanceof InputError ? json({ error: e.message }, 400) : failure(e); }
export async function GET(request: Request) { try {
  const url = new URL(request.url), id = url.searchParams.get('id');
  if (id) {
    const { db, row } = await readable(id, request);
    const revision = url.searchParams.get('revision');
    if (revision !== null) {
      if (!/^\d+$/.test(revision)) throw new InputError('Révision invalide.');
      const snapshot = await db.prepare('SELECT * FROM seasonal_revisions WHERE campaign_id=? AND revision=?').bind(id,Number(revision)).first<any>();
      if (!snapshot) throw new HttpError(404,'Révision introuvable.');
      return json({ id,revision:snapshot.revision,config:JSON.parse(snapshot.config),events:JSON.parse(snapshot.events),plan:JSON.parse(snapshot.plan),reason:snapshot.reason,createdAt:snapshot.created_at },200,{'Content-Disposition':`attachment; filename="campagne-revision-${snapshot.revision}.json"`});
    }
    if(url.searchParams.get('format')==='yield-csv'){const snapshot=JSON.parse(row.plan).yieldEstimation;if(!snapshot)throw new HttpError(409,'Rendement non paramétré dans cette révision.');return new Response(yieldCsv(snapshot),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename=estimation-rendement-revision-${row.revision}.csv`,'Cache-Control':'no-store'}});}
    if (url.searchParams.get('format')==='csv') {
      const config=validateConfig(migrateInputs(JSON.parse(row.config)));
      if(config.parcelGeometry)config.landAssessment=await authoritativeLand(config.parcelGeometry,await session(request));
      const plan=planSeason(config,JSON.parse(row.events),{requireGeometry:true});
      if(plan.status==='blocked')throw new HttpError(409,'Export du calendrier suspendu : '+plan.missing[0]);
      return new Response(waterPlanCsv(plan), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="plan-irrigation.csv"', 'Cache-Control': 'no-store' } });
    }
    const histories = await db.prepare('SELECT revision,reason,created_at FROM seasonal_revisions WHERE campaign_id=? ORDER BY revision DESC LIMIT 50').bind(id).all<any>();
    return json({ campaign: campaign(row), history: histories.results });
  }
  const s = await session(request), rows = await database().prepare('SELECT id,coop_id,owner_id,revision,config,demo,updated_at FROM seasonal_campaigns WHERE coop_id=? ORDER BY updated_at DESC LIMIT 100').bind(s.coopId).all<any>();
  return json({ campaigns: rows.results.filter(r => canSee(s,r)).map(r => ({ id:r.id, revision:r.revision, name:JSON.parse(r.config).name, country:JSON.parse(r.config).country, crop:JSON.parse(r.config).crop, updatedAt:r.updated_at, demo:!!r.demo })) });
} catch (e) { return error(e); } }
export async function POST(request: Request) { try {
  const s = await session(request), b = await body(request), db = database();
  if(b.action==='land-job-start')return json(await startLandJob(b.geometry,s));
  if(b.action==='land-job-step')return json(await stepLandJob(b.id,s));
  if(b.action==='land-job-status')return json(await landJobStatus(b.id,s));
  if(b.action==='environment'){
    let geometry;try{geometry=validateParcel(b.geometry);}catch(e){throw new InputError((e as Error).message);}
    const m=parcelMetrics(geometry);
    const now=new Date().toISOString();
    const landAssessment=m.areaM2>=1_000_000?await authoritativeLand(geometry,s):await loadLandAssessment(geometry,fetch,now,b.refresh===true);
    const environment=await loadEnvironment(m.point[1],m.point[0],b.country,b.start,b.days,fetch,now,geometry,b.refresh===true,terrestrialSoilPoint(landAssessment));
    return json({...environment,landAssessment});
  }
  if(b.action==='land'){try{return json({assessment:await authoritativeLand(validateParcel(b.geometry),s)});}catch(e){throw new InputError((e as Error).message);}}
  if(b.action==='places')return json({places:await searchPlaces(b.query),attribution:'GeoNames, répertoire local ; Open-Meteo Geocoding en complément'});
  if (b.action === 'capabilities') {
    if (!Object.hasOwn(COUNTRIES, b.country)) throw new InputError('Pays inconnu.');
    if (b.cropId !== undefined && (typeof b.cropId !== 'string' || !cropById(b.cropId))) throw new InputError('Culture inconnue.');
    return json(seasonalCapabilities(b.country as keyof typeof COUNTRIES, b.cropId));
  }
  if (b.action === 'weather') {
    if (!Object.hasOwn(COUNTRIES, b.country)) throw new InputError('Pays inconnu.');
    return json(await loadForecast(b.latitude, b.longitude, COUNTRIES[b.country as keyof typeof COUNTRIES].timezone));
  }
  if (b.action === 'simulate'){const config=validateConfig(b.config);if(config.parcelGeometry)config.landAssessment=await authoritativeLand(config.parcelGeometry,await session(request));return json({plan:planSeason(config,b.events??[],{requireGeometry:true}),config});}
  if (!['save', 'event'].includes(b.action)) throw new InputError('Action saisonnière inconnue.');
  const id = b.id;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new InputError('Identifiant de campagne invalide.');
  if (!Number.isInteger(b.expectedRevision) || b.expectedRevision < 0) throw new InputError('Numéro de révision attendu.');
  const old = await db.prepare('SELECT * FROM seasonal_campaigns WHERE id=? AND coop_id=?').bind(id, s.coopId).first<any>();
  if (old && !canSee(s,old)) throw new HttpError(404, 'Campagne introuvable.');
  if (!old && b.action === 'event') throw new HttpError(404, 'Enregistrez la campagne avant une observation.');
  if (old && b.action === 'event') {
    const previous = JSON.parse(old.events).find((e: any) => e.id === b.event?.id);
    if (previous && (previous.landSelection??'whole')===(JSON.parse(old.config).landSelection??'whole') && ['date','kind','amount','unit','point','status','source','unitId'].every(key => previous[key] === b.event[key])) return json({ campaign: campaign(old), unchanged: true });
  }
  if (old && b.expectedRevision !== old.revision || !old && b.expectedRevision !== 0) throw new HttpError(409, 'Cette campagne a changé. Rechargez sa dernière révision avant de corriger.');
  const config = validateConfig(b.action === 'event' ? JSON.parse(old.config) : b.config);
  if(old&&b.action==='save'&&JSON.parse(old.events).some((e:any)=>['measured','declared'].includes(e.status))&&JSON.stringify(JSON.parse(old.config).yieldEstimation?.units.map((u:any)=>[u.id,u.geometry,u.sownAreaM2])??null)!==JSON.stringify(config.yieldEstimation?.units.map(u=>[u.id,u.geometry,u.sownAreaM2])??null))throw new InputError('Des observations sont liées à la surface semée précédente. Créez une nouvelle campagne pour modifier cette portée.');
  if(old&&b.action==='save'&&JSON.parse(old.events).some((e:any)=>['measured','declared'].includes(e.status))&&JSON.stringify(JSON.parse(old.config).parcelGeometry??null)!==JSON.stringify(config.parcelGeometry??null))throw new InputError('Cette parcelle contient des observations. Créez une nouvelle campagne pour changer son contour.');
  if (config.asOfDate > new Date().toISOString().slice(0,10)) throw new InputError('La date du conseil ne peut pas être future. Une date de semis future reste possible avec un scénario.');
  let events = old ? JSON.parse(old.events) : b.events ?? [];
  if (b.action === 'event') {
    // Client supplies stable ID but receipt time is server-owned. Past plans stay
    // immutable; a delayed observation is replayed in the newly issued plan.
    config.asOfDate = new Date().toISOString().slice(0,10);
    const event = validateEvents([{ ...b.event, landSelection:config.landSelection??'whole',recordedAt: new Date().toISOString() }], config)[0];
    const next = upsertEvent(events,event);
    const previous = events.find((e: any) => e.id === event.id);
    if (previous && ['date','kind','amount','unit','point','status','source','landSelection','unitId'].every(key => previous[key] === event[key as keyof typeof event])) return json({ campaign: campaign(old), unchanged: true });
    events = next;
  }
  // save never replaces the event log supplied by another client.
  events = validateEvents(events, config);
  if(config.parcelGeometry)config.landAssessment=await authoritativeLand(config.parcelGeometry,await session(request));
  const plan = planSeason(config, events,{requireGeometry:true}), revision = b.expectedRevision + 1, now = new Date().toISOString();
  const reason = b.action === 'event' ? `Observation ${b.event.id} enregistrée/corrigée ; bilan et calendrier rejoués.` : 'Paramètres et scénario de campagne actualisés.';
  if (!old) {
    await db.batch([
      db.prepare('INSERT INTO seasonal_campaigns (id,coop_id,owner_id,revision,config,events,plan,demo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,s.coopId,s.userId,revision,JSON.stringify(config),JSON.stringify(events),JSON.stringify(plan),s.demo?1:0,now,now),
      db.prepare('INSERT INTO seasonal_revisions (campaign_id,revision,actor_id,config,events,plan,reason,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,revision,s.userId,JSON.stringify(config),JSON.stringify(events),JSON.stringify(plan),reason,now),
    ]);
  } else {
    const args = [id, s.coopId, b.expectedRevision];
    const results = await db.batch([
      db.prepare('INSERT INTO seasonal_revisions (campaign_id,revision,actor_id,config,events,plan,reason,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM seasonal_campaigns WHERE id=? AND coop_id=? AND revision=?)').bind(id,revision,s.userId,JSON.stringify(config),JSON.stringify(events),JSON.stringify(plan),reason,now,...args),
      db.prepare('UPDATE seasonal_campaigns SET revision=?,config=?,events=?,plan=?,updated_at=? WHERE id=? AND coop_id=? AND revision=?').bind(revision,JSON.stringify(config),JSON.stringify(events),JSON.stringify(plan),now,...args),
    ]);
    if (results[1].meta.changes !== 1) throw new HttpError(409, 'Une autre saisie vient de modifier la campagne. Rechargez-la avant de réessayer.');
  }
  return json({ campaign: { id, revision, config, events, plan, updatedAt: now, demo: s.demo }, reason }, old ? 200 : 201);
} catch(e) { return error(e); } }
