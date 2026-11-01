import {estimateSowing} from '@/lib/seasonal/sowing';
import {managementCsv,editableIrrigation,emptyManagement} from '@/lib/seasonal/management';
import {decodeCampaignValue,encodeCampaignSnapshot} from '@/lib/seasonal/storage';
import {loadNasaHistory,mergeNasa} from '@/lib/seasonal/nasa';
import {parseSalinityInput} from '@/lib/seasonal/salinity';
import {dataReadiness} from '@/lib/seasonal/data-readiness';
import {agronomicCoverage,compareAgronomic,harvestDiagnostic} from '@/lib/seasonal/agronomic';
import {sampleParcelSoil} from '@/lib/seasonal/agronomic-spatial';
import {authoritativeLand,startLandJob,stepLandJob,landJobStatus} from '@/lib/seasonal/land-jobs';
import {planSeason,yieldCsv} from '@/lib/seasonal/yield';
import {loadLandAssessment} from '@/lib/seasonal/land-provider';
import {migrateInputs} from '@/lib/seasonal/provenance';
import {validateParcel,parcelMetrics} from '@/lib/seasonal/parcel';
import { body, database, failure, HttpError, ServiceStageError, json } from '@/lib/server-db';
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

function campaign(row: any): Campaign { return { id: row.id, revision: row.revision, config: migrateInputs(decodeCampaignValue(row.config)), events: decodeCampaignValue(row.events), plan: decodeCampaignValue(row.plan), updatedAt: row.updated_at, demo: !!row.demo }; }
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
      return json({ id,revision:snapshot.revision,config:decodeCampaignValue(snapshot.config),events:decodeCampaignValue(snapshot.events),plan:decodeCampaignValue(snapshot.plan),reason:snapshot.reason,createdAt:snapshot.created_at },200,{'Content-Disposition':`attachment; filename="campagne-revision-${snapshot.revision}.json"`});
    }
    if(url.searchParams.get('format')==='yield-csv'){const snapshot=decodeCampaignValue(row.plan).yieldEstimation;if(!snapshot)throw new HttpError(409,'Rendement non paramétré dans cette révision.');return new Response(yieldCsv(snapshot),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename=estimation-rendement-revision-${row.revision}.csv`,'Cache-Control':'no-store'}});}
    if(url.searchParams.get('format')==='management-csv'){
      const config=validateConfig(migrateInputs(decodeCampaignValue(row.config))),snapshot=decodeCampaignValue(row.plan);
      const p=config.managementPlan??emptyManagement(config);
      return new Response(managementCsv({...p,irrigation:{mode:'manual',applications:editableIrrigation(config,snapshot)}}),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename=apports-revision-${row.revision}.csv`,'Cache-Control':'no-store'}});
    }
    if (url.searchParams.get('format')==='csv') {
      const config=validateConfig(migrateInputs(decodeCampaignValue(row.config)));
      if(config.parcelGeometry)config.landAssessment=await authoritativeLand(config.parcelGeometry,await session(request));
      const plan=planSeason(config,decodeCampaignValue(row.events),{requireGeometry:true});
      if(plan.status==='blocked')throw new HttpError(409,'Export du calendrier suspendu : '+plan.missing[0]);
      return new Response(waterPlanCsv(plan), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="plan-irrigation.csv"', 'Cache-Control': 'no-store' } });
    }
    const histories = await db.prepare('SELECT revision,reason,created_at FROM seasonal_revisions WHERE campaign_id=? ORDER BY revision DESC LIMIT 50').bind(id).all<any>();
    return json({ campaign: campaign(row), history: histories.results });
  }
  const s = await session(request), rows = await database().prepare('SELECT id,coop_id,owner_id,revision,config,demo,updated_at FROM seasonal_campaigns WHERE coop_id=? ORDER BY updated_at DESC LIMIT 100').bind(s.coopId).all<any>();
  return json({ campaigns: rows.results.filter(r => canSee(s,r)).map(r => {const c=decodeCampaignValue(r.config);return {id:r.id,revision:r.revision,name:c.name,country:c.country,crop:c.crop,updatedAt:r.updated_at,demo:!!r.demo};}) });
} catch (e) { return error(e); } }
export async function POST(request: Request) { try {
  const s = await session(request), b = await body(request,8000000), db = database();
  if(b.action==='sowing-plan'){
    const config=validateConfig(b.config,{allowUnparametrisedCycle:true});
    if(!config.parcelGeometry)throw new InputError('Dessinez une parcelle pour préparer le semis.');
    config.landAssessment=await authoritativeLand(config.parcelGeometry,s);
    return json({sowingPlan:estimateSowing(config),land:config.landAssessment});
  }
  if(b.action==='land-job-start')return json(await startLandJob(b.geometry,s));
  if(b.action==='land-job-step')return json(await stepLandJob(b.id,s));
  if(b.action==='land-job-status')return json(await landJobStatus(b.id,s));
  if(['agronomic-coverage','agronomic-compare'].includes(b.action)){
    const config=validateConfig(b.config);if(config.parcelGeometry)config.landAssessment=await authoritativeLand(config.parcelGeometry,s);
    return json(b.action==='agronomic-coverage'?agronomicCoverage(config):await compareAgronomic(config,b.events??[],b.variants));
  }
  if(b.action==='agronomic-soil')return json(await sampleParcelSoil(await authoritativeLand(validateParcel(b.geometry),s)));
  if(b.action==='agronomic-harvest'){
    const {row}=await readable(b.id,request);if(!Number.isInteger(b.revision))throw new InputError('Révision antérieure requise.');
    const old=await db.prepare('SELECT * FROM seasonal_revisions WHERE campaign_id=? AND revision=?').bind(b.id,b.revision).first<any>();
    if(!old)throw new HttpError(404,'Révision introuvable.');
    const config=decodeCampaignValue(old.config),estimate=decodeCampaignValue(old.plan).yieldEstimation,actual=decodeCampaignValue(row.config);
    if(typeof b.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!Number.isFinite(Date.parse(b.date))||new Date(b.date).toISOString().slice(0,10)!==b.date||b.date>new Date().toISOString().slice(0,10)||b.date<=config.asOfDate||b.date<=old.created_at.slice(0,10))throw new InputError('La prédiction doit être enregistrée avant la récolte, à une date réelle.');
    if(JSON.stringify(config.parcelGeometry)!==JSON.stringify(actual.parcelGeometry)||config.crop!==actual.crop)throw new InputError('Parcelle ou culture incompatible.');
    const predicted=estimate?.scenarios.find((x:any)=>x.id==='recorded')?.totals?.yieldKgHaSown;
    if(predicted==null||estimate.method!=='fao-seasonal')throw new InputError('Prédiction hydrique disponible requise ; une hypothèse imposée ne constitue pas une prévision évaluée.');
    if(b.productCompatible!==true||!b.source?.trim())throw new InputError('Source et compatibilité organe/produit/référence requises.');
    const result=harvestDiagnostic(predicted,b.kg,estimate.surface.sownM2,b.moisture,b.referenceMoisture);
    const now=new Date().toISOString(),revision=row.revision+1;
    const observation={parameter:'Récolte observée',value:JSON.stringify({date:b.date,kg:b.kg,moisture:b.moisture,referenceMoisture:b.referenceMoisture,predictionRevision:b.revision,productCompatible:true}),unit:'kg',method:'Observation déclarée après récolte, diagnostic non certifié',source:b.source,depthCm:null,availableOn:now.slice(0,10)};
    actual.agronomic=actual.agronomic??{version:'agronomic-1',geometryId:JSON.stringify(actual.parcelGeometry??null),system:'single',season:null,observations:[]};
    const duplicate=actual.agronomic.observations.some((o:any)=>o.parameter===observation.parameter&&o.value===observation.value&&o.source===observation.source);
    if(!duplicate){actual.agronomic.observations.push(observation);actual.asOfDate=now.slice(0,10);const nextPlan=planSeason(validateConfig(actual),decodeCampaignValue(row.events),{requireGeometry:true});
      const packed=encodeCampaignSnapshot(actual,decodeCampaignValue(row.events),nextPlan);
      const writes=await db.batch([
        db.prepare('INSERT INTO seasonal_revisions (campaign_id,revision,actor_id,config,events,plan,reason,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM seasonal_campaigns WHERE id=? AND revision=?)').bind(b.id,revision,s.userId,packed.config,packed.events,packed.plan,'Observation de récolte et diagnostic enregistrés.',now,b.id,row.revision),
        db.prepare('UPDATE seasonal_campaigns SET revision=?,config=?,plan=?,updated_at=? WHERE id=? AND revision=?').bind(revision,packed.config,packed.plan,now,b.id,row.revision)
      ]);if(writes[1].meta.changes!==1)throw new HttpError(409,'Campagne modifiée pendant le diagnostic ; réessayez.');
    }
    return json({...result,observationSaved:true,campaignRevision:duplicate?row.revision:revision,country:config.country,crop:config.crop,system:config.systemDomain,revision:b.revision,source:b.source,limits:['Produit et humidité de référence déclarés compatibles par l’utilisateur ; non certifiés.','Observation conservée dans une nouvelle révision ; anciennes versions préservées.']});
  }
  if(['data-readiness','salinity-scenario','nasa-history'].includes(b.action)){
    const config=validateConfig(b.config);if(config.parcelGeometry)config.landAssessment=await authoritativeLand(config.parcelGeometry,s);
    if(b.action==='data-readiness')return json(dataReadiness(config,b.events??[]));
    if(b.action==='salinity-scenario'){config.salinity=parseSalinityInput(b.parameters);if(!config.salinity)throw new InputError('Paramètres de salinité requis.');const plan=planSeason(config,b.events??[],{requireGeometry:true});if(!plan.salinity||plan.salinity.status==='unavailable')throw new InputError(plan.salinity?.missing.join(' ')??'Scénario indisponible.');return json({result:plan.salinity,config});}
    if(config.latitude===null||config.longitude===null)throw new InputError('Coordonnées de la parcelle requises.');
    const result=await loadNasaHistory(config.latitude,config.longitude,b.start,b.end,config.asOfDate);return json({...result,config:mergeNasa(config,result.weather)});
  }
  if(b.action==='environment'){

    let geometry;try{geometry=validateParcel(b.geometry);}catch(e){throw new InputError((e as Error).message);}
    const m=parcelMetrics(geometry);
    const now=new Date().toISOString();
    let landAssessment;try{landAssessment=m.areaM2>=1_000_000?await authoritativeLand(geometry,s):await loadLandAssessment(geometry,fetch,now,b.refresh===true);}catch(e){if(e instanceof HttpError)throw e;throw new ServiceStageError('terrain',e);}
    let point;try{point=terrestrialSoilPoint(landAssessment);}catch(e){throw new ServiceStageError('point-sol',e);}
    let environment;try{environment=await loadEnvironment(m.point[1],m.point[0],b.country,b.start,b.days,fetch,now,geometry,b.refresh===true,point);}catch(e){if(e instanceof InputError)throw e;throw new ServiceStageError('sol-meteo',e);}
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
    const previous = decodeCampaignValue(old.events).find((e: any) => e.id === b.event?.id);
    if (previous && (previous.landSelection??'whole')===(decodeCampaignValue(old.config).landSelection??'whole') && ['date','kind','amount','unit','point','status','source','unitId'].every(key => previous[key] === b.event[key])) return json({ campaign: campaign(old), unchanged: true });
  }
  if (old && b.expectedRevision !== old.revision || !old && b.expectedRevision !== 0) throw new HttpError(409, 'Cette campagne a changé. Rechargez sa dernière révision avant de corriger.');
  const config = validateConfig(b.action === 'event' ? decodeCampaignValue(old.config) : b.config);
  if(old&&b.action==='save'&&decodeCampaignValue(old.events).some((e:any)=>['measured','declared'].includes(e.status))&&(decodeCampaignValue(old.config).sowingPlan?.areaM2??null)!==(config.sowingPlan?.areaM2??null))throw new InputError('Des observations sont liées à la surface précédente. Créez une nouvelle campagne pour modifier la surface prévue.');
  if(old&&b.action==='save'&&decodeCampaignValue(old.events).some((e:any)=>['measured','declared'].includes(e.status))&&JSON.stringify(decodeCampaignValue(old.config).yieldEstimation?.units.map((u:any)=>[u.id,u.geometry,u.sownAreaM2])??null)!==JSON.stringify(config.yieldEstimation?.units.map(u=>[u.id,u.geometry,u.sownAreaM2])??null))throw new InputError('Des observations sont liées à la surface semée précédente. Créez une nouvelle campagne pour modifier cette portée.');
  if(old&&b.action==='save'&&decodeCampaignValue(old.events).some((e:any)=>['measured','declared'].includes(e.status))&&JSON.stringify(decodeCampaignValue(old.config).parcelGeometry??null)!==JSON.stringify(config.parcelGeometry??null))throw new InputError('Cette parcelle contient des observations. Créez une nouvelle campagne pour changer son contour.');
  if (config.asOfDate > new Date().toISOString().slice(0,10)) throw new InputError('La date du conseil ne peut pas être future. Une date de semis future reste possible avec un scénario.');
  let events = old ? decodeCampaignValue(old.events) : b.events ?? [];
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
  const packed=encodeCampaignSnapshot(config,events,plan);
  if (!old) {
    await db.batch([
      db.prepare('INSERT INTO seasonal_campaigns (id,coop_id,owner_id,revision,config,events,plan,demo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,s.coopId,s.userId,revision,packed.config,packed.events,packed.plan,s.demo?1:0,now,now),
      db.prepare('INSERT INTO seasonal_revisions (campaign_id,revision,actor_id,config,events,plan,reason,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,revision,s.userId,packed.config,packed.events,packed.plan,reason,now),
    ]);
  } else {
    const args = [id, s.coopId, b.expectedRevision];
    const results = await db.batch([
      db.prepare('INSERT INTO seasonal_revisions (campaign_id,revision,actor_id,config,events,plan,reason,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM seasonal_campaigns WHERE id=? AND coop_id=? AND revision=?)').bind(id,revision,s.userId,packed.config,packed.events,packed.plan,reason,now,...args),
      db.prepare('UPDATE seasonal_campaigns SET revision=?,config=?,events=?,plan=?,updated_at=? WHERE id=? AND coop_id=? AND revision=?').bind(revision,packed.config,packed.events,packed.plan,now,...args),
    ]);
    if (results[1].meta.changes !== 1) throw new HttpError(409, 'Une autre saisie vient de modifier la campagne. Rechargez-la avant de réessayer.');
  }
  return json({ campaign: { id, revision, config, events, plan, updatedAt: now, demo: s.demo }, reason }, old ? 200 : 201);
} catch(e) { return error(e); } }
