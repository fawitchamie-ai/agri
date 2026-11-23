import {bbox} from './land.ts';
import {readZoneSeason} from './field-zones-provider.ts';
import {zoneGrid,type ZoneSeasonRead} from './field-zones.ts';
import {meetsFieldImageTarget,FIELD_IMAGE_CLEAR_TARGET} from './field-analysis.ts';
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

export const MAX_FIELD_IMAGE_ATTEMPTS=36;
/** Walk past a cloudy recent run. Each opaque date only reads its SCL mask;
 * the explicit date range and cancellation bound the search. */
export async function loadUsableFieldImage(geometry:unknown,dates:string[],options:{
 signal:AbortSignal;fetcher?:typeof fetch;reader?:typeof readZoneSeason;
 onRead:(read:ZoneSeasonRead,usable:boolean)=>void;
 onProgress?:(date:string,attempt:number,total:number)=>void;
}){
 const grid=zoneGrid(geometry),all=[...new Set(dates)].sort().reverse(),candidates=all.slice(0,MAX_FIELD_IMAGE_ATTEMPTS),issues:string[]=[];let readFailures=0,evaluated=0;
 const remainingDates=all.length-candidates.length,targetCoverage=FIELD_IMAGE_CLEAR_TARGET;
 for(const [i,day] of candidates.entries()){
  options.signal.throwIfAborted();options.onProgress?.(day,i+1,candidates.length);
  try{
   const r=await (options.reader??readZoneSeason)(geometry,{id:'observation-'+day,startDate:day,endDate:day,cropId:'unknown',comparable:false},options.fetcher??fetch,undefined,options.signal);
   options.signal.throwIfAborted();evaluated++;const usable=meetsFieldImageTarget(grid,r);
   options.onRead(r,usable);if(usable)return {read:r,attempts:i+1,issues,readFailures,evaluated,remainingDates:all.length-i-1,targetCoverage};
   issues.push(day+' : '+Math.round((r.scenes[0]?.clearFraction??0)*100)+' % de surface claire ; objectif 80 %');
  }catch(error){options.signal.throwIfAborted();readFailures++;issues.push(day+' : '+(error as Error).message);}
 }
 return {read:null,attempts:candidates.length,issues,readFailures,evaluated,remainingDates,targetCoverage};
}

export function fieldImageFailureMessage(result:{attempts:number;readFailures:number;evaluated:number;issues:string[];remainingDates?:number}){
 if(result.readFailures===result.attempts&&result.readFailures>0)return 'Les dates ont été trouvées, mais la lecture des pixels a échoué. La couverture nuageuse n’a pas pu être évaluée. Vos observations déjà enregistrées sont conservées. Détail : '+result.issues.join(' ; ');
 if(result.readFailures>0)return result.evaluated+' acquisitions ont été lues sans atteindre 80 % de couverture exploitable ; '+result.readFailures+' autres lectures ont échoué. Réessayez les lectures en erreur. Détail : '+result.issues.join(' ; ');
 return 'Aucune image avec au moins 80 % de couverture exploitable parmi les '+result.attempts+' acquisitions lues. '+(result.remainingDates?'Il reste '+result.remainingDates+' dates plus anciennes : choisissez une fin de période antérieure pour les explorer.':'Essayez une autre période.')+' Vos observations déjà enregistrées sont conservées.';
}

export async function fieldImageDates(geometry:unknown,from:string,to:string,fetcher:typeof fetch=fetch){
 const result=await verifiedImageCatalog(bbox(zoneGrid(geometry).shape),from,to,fetcher);
 return [...new Set(result.features.map(v=>v.properties?.datetime?.slice(0,10)).filter((d):d is string=>!!d&&d>=from&&d<=to))].sort();
}
