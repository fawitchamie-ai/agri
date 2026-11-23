import {bbox} from './land.ts';
import {readZoneSeason} from './field-zones-provider.ts';
import {zoneGrid,type ZoneSeasonRead,type FieldImageCheck,type FieldImageSearch} from './field-zones.ts';
import {fieldImageSummary,meetsFieldImageTarget,FIELD_IMAGE_CLEAR_TARGET} from './field-analysis.ts';
import {verifiedImageCatalog,type VerifiedSentinelCatalog} from './sentinel-catalog.ts';
export {verifiedImageCatalog} from './sentinel-catalog.ts';

/** Check every advertised date. The catalogue and per-date footprints bound the
 * work; there is no first-clear-date stop or 36-date truncation. */
export async function loadUsableFieldImage(geometry:unknown,dates:string[],options:{
 signal:AbortSignal;fetcher?:typeof fetch;reader?:typeof readZoneSeason;catalog?:VerifiedSentinelCatalog;
 previousSearch?:FieldImageSearch;cachedReads?:ZoneSeasonRead[];
 onRead:(read:ZoneSeasonRead,usable:boolean)=>void;
 onCheck?:(check:FieldImageCheck)=>void;
 onProgress?:(date:string,attempt:number,total:number)=>void;
}){
 const grid=zoneGrid(geometry),fetcher=options.fetcher??fetch;
 const catalog=options.catalog??(!options.reader&&dates.length?await verifiedImageCatalog(bbox(grid.shape),[...dates].sort()[0],[...dates].sort().at(-1)!,fetcher):undefined);
 const candidates=[...new Set([...dates,...(catalog?.dates??[])])].sort().reverse(),issues:string[]=[],checks:FieldImageCheck[]=[];
 const previous=options.previousSearch?.retrievedOn===new Date().toISOString().slice(0,10)?new Map(options.previousSearch.entries.map(e=>[e.date,e])):new Map<string,FieldImageCheck>();
 let read:ZoneSeasonRead|null=null,readFailures=0,evaluated=0,reused=0,usableCount=0,unavailable=0;
 for(const [i,day] of candidates.entries()){
  options.signal.throwIfAborted();options.onProgress?.(day,i+1,candidates.length);
  const items=catalog?.features.filter(f=>f.properties?.datetime?.slice(0,10)===day);
  const fingerprint=items?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(items.map(i=>[i.id,i.properties?.updated,i.assets?.B04?.href??i.assets?.red?.href]).map(v=>JSON.stringify(v)).sort().join('\n'))))).map(b=>b.toString(16).padStart(2,'0')).join(''):undefined;
  const publish=(check:FieldImageCheck)=>{checks.push(check);options.onCheck?.(check);};
  if(items&&!items.length){unavailable++;publish({date:day,status:'unavailable',fingerprint,reason:'Acquisition répertoriée ; bandes publiques à radiométrie vérifiable indisponibles.'});continue;}
  const known=previous.get(day),cached=options.cachedReads?.find(r=>r.season.startDate===day&&r.scenes[0]?.itemId===known?.itemId);
  if(fingerprint&&known?.fingerprint===fingerprint&&(known.status==='insufficient'||known.status==='usable'&&cached&&meetsFieldImageTarget(grid,cached))){
   evaluated++;reused++;publish(known);
   if(known.status==='usable'){usableCount++;if(!read)read=cached!;options.onRead(cached!,true);}
   continue;
  }
  try{
   const r=await (options.reader??readZoneSeason)(geometry,{id:'observation-'+day,startDate:day,endDate:day,cropId:'unknown',comparable:false},fetcher,undefined,options.signal,undefined,{catalog:catalog?{...catalog,features:items!}:undefined,minimumClearFraction:FIELD_IMAGE_CLEAR_TARGET});
   options.signal.throwIfAborted();evaluated++;const usable=meetsFieldImageTarget(grid,r),s=fieldImageSummary(grid,r),scene=r.scenes[0];
   options.onRead(r,usable);
   const reason=usable?undefined:scene?.mask&&scene.mask.clear<.8?'Surface de sol clair '+Math.round(scene.mask.clear*100)+' % ; objectif 80 %.':s.cells<12?'Moins de 12 cellules qualifiées.':'Couverture NDVI ou grille qualifiée inférieure à 80 %.';
   publish({date:day,status:usable?'usable':'insufficient',fingerprint,itemId:scene?.itemId,clearFraction:scene?.clearFraction??0,gridCoverage:s.coverage,cells:s.cells,ndviMean:s.mean,...(reason?{reason}:{})});
   if(usable){usableCount++;if(!read)read=r;}else issues.push(day+' : '+reason);
  }catch(error){options.signal.throwIfAborted();readFailures++;const reason=(error as Error).message.slice(0,900);issues.push(day+' : '+reason);publish({date:day,status:'error',fingerprint,reason});}
 }
 return {read,attempts:candidates.length,issues,readFailures,evaluated,reused,usableCount,unavailable,checks,remainingDates:0,targetCoverage:FIELD_IMAGE_CLEAR_TARGET};
}

export function fieldImageFailureMessage(result:{attempts:number;readFailures:number;evaluated:number;issues:string[];remainingDates?:number;unavailable?:number}){
 if(result.readFailures===result.attempts&&result.readFailures>0)return 'Les dates ont été trouvées, mais la lecture des pixels a échoué. La couverture nuageuse n’a pas pu être évaluée. Vos observations déjà enregistrées sont conservées. Détail : '+result.issues.join(' ; ');
 if(result.readFailures>0)return result.evaluated+' acquisitions vérifiées ; '+result.readFailures+' lectures restent en erreur et peuvent être reprises. Détail : '+result.issues.join(' ; ');
 return 'Aucune image avec au moins 80 % de couverture exploitable parmi les '+result.attempts+' acquisitions examinées.'+(result.unavailable?' '+result.unavailable+' acquisitions attendent des bandes publiques lisibles.':'')+' Essayez une autre période. Vos observations déjà enregistrées sont conservées.';
}

export async function fieldImageDates(geometry:unknown,from:string,to:string,fetcher:typeof fetch=fetch){
 return (await verifiedImageCatalog(bbox(zoneGrid(geometry).shape),from,to,fetcher)).dates;
}
