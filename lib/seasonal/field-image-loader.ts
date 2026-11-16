import {bbox} from './land.ts';
import {readZoneSeason} from './field-zones-provider.ts';
import {zoneGrid,type ZoneSeasonRead} from './field-zones.ts';
import {fieldImageSummary} from './field-analysis.ts';
import {satelliteStacSearch} from './satellite.ts';

/** Prefer C1; legacy imagery is usable only with an explicitly applied BOA offset. */
export async function verifiedImageCatalog(bounds:number[],from:string,to:string,fetcher:typeof fetch=fetch){
 try{return await satelliteStacSearch(bounds,from,to,fetcher,'ndvi',true,true);}
 catch(error){
  const old=await satelliteStacSearch(bounds,from,to,fetcher,'ndvi',false,true);
  const features=old.features.filter(i=>i.properties?.['earthsearch:boa_offset_applied']===true||i.properties?.['sentinel:boa_offset_applied']===true);
  if(!features.length)throw error;
  return {...old,features};
 }
}

/** A tile's cloud percentage never substitutes for measured clear parcel coverage. */
export async function loadUsableFieldImage(geometry:unknown,dates:string[],options:{
 signal:AbortSignal;fetcher?:typeof fetch;reader?:typeof readZoneSeason;
 onRead:(read:ZoneSeasonRead,usable:boolean)=>void;
 onProgress?:(date:string,attempt:number,total:number)=>void;
}){
 const grid=zoneGrid(geometry),candidates=[...new Set(dates)].sort().reverse().slice(0,6),issues:string[]=[];let readFailures=0,evaluated=0;
 for(const [i,day] of candidates.entries()){
  options.signal.throwIfAborted();options.onProgress?.(day,i+1,candidates.length);
  try{
   const r=await (options.reader??readZoneSeason)(geometry,{id:'observation-'+day,startDate:day,endDate:day,cropId:'unknown',comparable:false},options.fetcher??fetch,undefined,options.signal);
   options.signal.throwIfAborted();evaluated++;const s=fieldImageSummary(grid,r),usable=s.cells>=12&&s.coverage>=.6;
   options.onRead(r,usable);if(usable)return {read:r,attempts:i+1,issues,readFailures,evaluated};
   issues.push(day+' : surface claire insuffisante');
  }catch(error){options.signal.throwIfAborted();readFailures++;issues.push(day+' : '+(error as Error).message);}
 }
 return {read:null,attempts:candidates.length,issues,readFailures,evaluated};
}

export function fieldImageFailureMessage(result:{attempts:number;readFailures:number;evaluated:number;issues:string[]}){
 if(result.readFailures===result.attempts&&result.readFailures>0)return 'Les dates ont été trouvées, mais la lecture des pixels a échoué. La couverture nuageuse n’a pas pu être évaluée. Vos observations déjà enregistrées sont conservées. Détail : '+result.issues.join(' ; ');
 if(result.readFailures>0)return result.evaluated+' acquisitions ont été lues sans observation suffisamment claire ; '+result.readFailures+' autres lectures ont échoué. Réessayez les lectures en erreur. Détail : '+result.issues.join(' ; ');
 return 'Aucune image suffisamment claire parmi les '+result.attempts+' dernières acquisitions lues. Essayez une autre période. Vos observations déjà enregistrées sont conservées.';
}

export async function fieldImageDates(geometry:unknown,from:string,to:string,fetcher:typeof fetch=fetch){
 const result=await verifiedImageCatalog(bbox(zoneGrid(geometry).shape),from,to,fetcher);
 return [...new Set(result.features.map(v=>v.properties?.datetime?.slice(0,10)).filter((d):d is string=>!!d&&d>=from&&d<=to))].sort();
}
