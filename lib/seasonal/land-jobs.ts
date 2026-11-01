import {AREA_METHOD} from './spherical-area.ts';
import * as clipping from './geometry-ops.ts';
import {bbox,multiArea,LAND_CLASSES,LAND_VERSION,type LandAssessment,type MultiShape} from './land.ts';
import {validateParcel,parcelMetrics,type ParcelPolygon} from './parcel.ts';
import {scopeId,geometryIdentity} from './provenance.ts';
import {loadLandAssessment} from './land-provider.ts';
import {database,digest,HttpError} from '../server-db.ts';
import type {session} from '../server-auth.ts';
type Identity=Awaited<ReturnType<typeof session>>;
export const SECTOR_AREA_THRESHOLD_M2=1_000_000;
/** Bounded geographic windows; exact intersections preserve holes/disconnections. */
export function splitLandSectors(shape:ParcelPolygon):ParcelPolygon[]{
 const [w,s,e,n]=bbox(shape),size=.005,result:ParcelPolygon[]=[];
 if(Math.ceil((e-w)/size)*Math.ceil((n-s)/size)>1024)throw new HttpError(422,'Contour trop étendu : créez plusieurs campagnes de secteurs (1 024 fenêtres maximum par traitement).');
 for(let y=s;y<n;y+=size)for(let x=w;x<e;x+=size){
  const east=Math.min(e,x+size),north=Math.min(n,y+size);
  const rect=[[[x,y],[east,y],[east,north],[x,north],[x,y]]] as ParcelPolygon['coordinates'];
  const cut=clipping.intersection([shape.coordinates],[rect]);
  for(const polygon of cut)if(multiArea([polygon])>=1)result.push({type:'Polygon',coordinates:polygon as ParcelPolygon['coordinates']});
 }
 if(result.length>256)throw new HttpError(422,'Découpez le contour en plusieurs campagnes : 256 secteurs au maximum par traitement.');
 if(Math.abs(result.reduce((n,g)=>n+parcelMetrics(g).areaM2,0)-parcelMetrics(shape).areaM2)>Math.max(.001,parcelMetrics(shape).areaM2*1e-7))throw new HttpError(422,'Partition incomplète à cette résolution : dessinez des secteurs plus simples.');
 return result;
}
export function combineLandSectors(shape:ParcelPolygon,parts:LandAssessment[],now:string):LandAssessment{
 const areaM2=parcelMetrics(shape).areaM2,tol=Math.max(.001,areaM2*1e-7);
 let covered:MultiShape['coordinates']=[];
 for(const part of parts){const g=[part.geometry.coordinates];if(multiArea(clipping.intersection(covered,g))>tol)throw new Error('Secteurs superposés.');covered=clipping.union(covered,g);}
 if(multiArea(clipping.difference([shape.coordinates],covered))>tol||multiArea(clipping.difference(covered,[shape.coordinates]))>tol)throw new Error('Couverture des secteurs incomplète.');
 const fractions={} as LandAssessment['fractions'];
 for(const cls of LAND_CLASSES){let geometry:MultiShape['coordinates']=[];for(const p of parts)geometry=clipping.union(geometry,p.fractions[cls].geometry.coordinates);const size=multiArea(geometry);fractions[cls]={areaM2:size,fraction:size/areaM2,geometry:{type:'MultiPolygon',coordinates:geometry}};}
 if(Math.abs(LAND_CLASSES.reduce((n,k)=>n+fractions[k].areaM2,0)-areaM2)>tol)throw new Error('Surfaces non réconciliées.');
 const excludedAreaM2=fractions.permanentWater.areaM2+fractions.incompatible.areaM2,unknownAreaM2=fractions.unknown.areaM2;
 return {version:LAND_VERSION,areaMethod:AREA_METHOD,scopeId:scopeId(shape),geometry:shape,assessedAt:now,areaM2,fractions,
 sources:[...new Map(parts.flatMap(p=>p.sources).map(s=>[JSON.stringify(s),s])).values()],status:excludedAreaM2>=areaM2-tol?'excluded':excludedAreaM2>tol?'mixed':unknownAreaM2>=areaM2-tol?'unknown':'conditional',candidateAreaM2:fractions.potentialLand.areaM2,excludedAreaM2,unknownAreaM2,messages:[...new Set(parts.flatMap(p=>p.messages)),'Analyse par secteurs : couverture traitée complète ; les zones inconnues restent inconnues.'],boundaryUncertaintyM:null,legalStatus:'not_assessed'};
}
async function owned(id:unknown,s:Identity){
 if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw new HttpError(400,'Identifiant du traitement invalide.');
 const row=await database().prepare('SELECT * FROM land_jobs WHERE id=? AND coop_id=? AND owner_id=?').bind(id,s.coopId,s.userId).first<any>();
 if(!row)throw new HttpError(404,'Traitement introuvable.');return row;
}
export async function landJobStatus(id:unknown,s:Identity){
 const row=await owned(id,s),sectors=await database().prepare('SELECT sector,area_m2,result IS NOT NULL AS complete,error FROM land_sectors WHERE job_id=? ORDER BY sector').bind(row.id).all<any>();
 const processedM2=sectors.results.filter(x=>x.complete).reduce((n,x)=>n+x.area_m2,0);
 return {id:row.id,status:row.result?'complete':'pending',completed:sectors.results.filter(x=>x.complete).length,total:row.total,processedM2,totalM2:parcelMetrics(JSON.parse(row.geometry)).areaM2,errors:sectors.results.filter(x=>x.error).map(x=>({sector:x.sector,error:x.error})),assessment:row.result?JSON.parse(row.result):null};
}
export async function startLandJob(input:unknown,s:Identity){
 const shape=validateParcel(input),now=new Date().toISOString(),id=await digest(JSON.stringify(['land-sectors-2-spherical-linear-edges',s.coopId,s.userId,geometryIdentity(shape),now.slice(0,10)]));
 const existing=await database().prepare('SELECT id FROM land_jobs WHERE id=?').bind(id).first();if(existing)return landJobStatus(id,s);
 const sectors=splitLandSectors(shape),db=database();
 // Job and rows are atomic. Bounded 256 rows; D1 batch is transactional.
 await db.batch([db.prepare('INSERT INTO land_jobs (id,coop_id,owner_id,geometry,created_at,total) VALUES (?,?,?,?,?,?)').bind(id,s.coopId,s.userId,JSON.stringify(shape),now,sectors.length),db.prepare("INSERT INTO land_sectors (job_id,sector,geometry,area_m2) SELECT ?, CAST(key AS INTEGER), json_extract(value,'$.geometry'), json_extract(value,'$.areaM2') FROM json_each(?)").bind(id,JSON.stringify(sectors.map(g=>({geometry:g,areaM2:parcelMetrics(g).areaM2}))))]);
 return landJobStatus(id,s);
}
export async function stepLandJob(id:unknown,s:Identity){
 const row=await owned(id,s),db=database();if(row.result)return landJobStatus(id,s);
 const now=new Date().toISOString(),stale=new Date(Date.now()-180000).toISOString();
 const sector=await db.prepare('SELECT * FROM land_sectors WHERE job_id=? AND result IS NULL AND (lease IS NULL OR lease_at<?) ORDER BY sector LIMIT 1').bind(row.id,stale).first<any>();
 if(sector){
  const lease=crypto.randomUUID(),claim=await db.prepare('UPDATE land_sectors SET lease=?,lease_at=?,error=NULL WHERE job_id=? AND sector=? AND result IS NULL AND (lease IS NULL OR lease_at<?)').bind(lease,now,row.id,sector.sector,stale).run();
  if(claim.meta.changes){try{
   const result=await loadLandAssessment(JSON.parse(sector.geometry));
   await db.prepare('UPDATE land_sectors SET result=?,lease=NULL,lease_at=NULL WHERE job_id=? AND sector=? AND lease=?').bind(JSON.stringify(result),row.id,sector.sector,lease).run();
  }catch{
   await db.prepare('UPDATE land_sectors SET lease=NULL,lease_at=NULL,error=? WHERE job_id=? AND sector=? AND lease=?').bind('Acquisition interrompue : reprendre ce secteur.',row.id,sector.sector,lease).run();
  }}
 }
 const remaining=await db.prepare('SELECT COUNT(*) AS n FROM land_sectors WHERE job_id=? AND result IS NULL').bind(row.id).first<{n:number}>();
 if(remaining?.n===0){
  const parts=await db.prepare('SELECT result FROM land_sectors WHERE job_id=? ORDER BY sector').bind(row.id).all<{result:string}>();
  const result=combineLandSectors(JSON.parse(row.geometry),parts.results.map(p=>JSON.parse(p.result)),new Date().toISOString());
  await db.prepare('UPDATE land_jobs SET result=?,completed_at=? WHERE id=? AND result IS NULL').bind(JSON.stringify(result),new Date().toISOString(),row.id).run();
 }
 return landJobStatus(id,s);
}
export async function authoritativeLand(shape:ParcelPolygon,s:Identity):Promise<LandAssessment>{
 if(parcelMetrics(shape).areaM2<SECTOR_AREA_THRESHOLD_M2)return loadLandAssessment(shape);
 const row=await database().prepare('SELECT result FROM land_jobs WHERE coop_id=? AND owner_id=? AND geometry=? AND result IS NOT NULL AND completed_at>=? ORDER BY completed_at DESC LIMIT 1').bind(s.coopId,s.userId,JSON.stringify(shape),new Date(Date.now()-86400000).toISOString()).first<{result:string}>();
 if(!row)throw new HttpError(409,'Analyse par secteurs requise : lancez ou reprenez le traitement du grand contour. Aucun résultat partiel ne sera extrapolé.');
 const result=JSON.parse(row.result);
 if(result.areaMethod!==AREA_METHOD)throw new HttpError(409,'La méthode de surface a été corrigée : relancez l’analyse par secteurs avant un nouveau calcul. Les campagnes enregistrées restent conservées.');
 return result;
}
