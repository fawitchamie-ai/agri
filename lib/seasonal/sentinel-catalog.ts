import {searchSentinelCatalog,type SatelliteStacItem,type SentinelCatalogProvider} from './satellite.ts';
import {sentinelAssetUrl} from './sentinel-assets.ts';

export type VerifiedSentinelCatalog={provider:string;features:SatelliteStacItem[];dates:string[];officialVerified:boolean;officialScenes:number;sources:string[];warnings:string[]};
const asset=(i:SatelliteStacItem,...keys:string[])=>keys.map(k=>i.assets?.[k]).find(a=>a?.href);
const qualifiedAssets=(i:SatelliteStacItem)=>{
 try{return ['B04','B08','SCL'].every(b=>{const a=b==='B04'?asset(i,'B04','red'):b==='B08'?asset(i,'B08','nir','nir_1'):asset(i,'SCL','scl','mask');if(!a?.href)return false;sentinelAssetUrl(a.href);return true;});}catch{return false;}
};
/** Compare every public COG catalogue with the official acquisition calendar.
 * A nonempty C1 mirror is not proof that the other mirrors have no extra dates.
 * Official metadata without readable COG bands remain explicit unavailable dates. */
export async function verifiedImageCatalog(bounds:number[],from:string,to:string,fetcher:typeof fetch=fetch):Promise<VerifiedSentinelCatalog>{
 if((Date.parse(to)-Date.parse(from))/86400000>366)throw new Error('Choisissez une période satellite de 366 jours maximum. Toutes ses acquisitions seront recherchées.');
 const sources:{name:string;provider:SentinelCatalogProvider;c1:boolean}[]=[
  {name:'Digital Earth Africa C1',provider:'deafrica',c1:true},
  {name:'Earth Search C1',provider:'earth',c1:true},
  {name:'Digital Earth Africa harmonisé',provider:'deafrica',c1:false},
  {name:'Earth Search harmonisé',provider:'earth',c1:false},
  {name:'Copernicus Data Space',provider:'copernicus',c1:true},
 ];
 const results=await Promise.allSettled(sources.map(s=>searchSentinelCatalog(s.provider,bounds,from,to,s.c1,fetcher)));
 const dates=new Set<string>(),features=new Map<string,SatelliteStacItem>(),warnings:string[]=[],available:string[]=[];let officialVerified=false,officialScenes=0;
 for(const [n,result] of results.entries()){
  const s=sources[n];
  if(result.status==='rejected'){warnings.push(s.name+' : '+String((result.reason as Error).message).slice(0,200));continue;}
  available.push(s.name);
  if(s.provider==='copernicus'){officialVerified=true;officialScenes=result.value.length;}
  for(const item of result.value){
   const day=item.properties!.datetime!.slice(0,10);dates.add(day);
   if(s.provider==='copernicus')continue;
   const isC1=s.c1||asset(item,'B04','red')?.href?.includes('/sentinel-2-c1-l2a/');
   if(!isC1&&item.properties?.['earthsearch:boa_offset_applied']!==true&&item.properties?.['sentinel:boa_offset_applied']!==true)continue;
   if(!qualifiedAssets(item))continue;
   const key=(item.id??day)+':'+asset(item,'B04','red')!.href;
   if(!features.has(key))features.set(key,item);
  }
 }
 if(!available.length)throw new Error('Catalogues Sentinel-2 indisponibles. '+warnings.join(' ; '));
 return {provider:available.filter(s=>s!=='Copernicus Data Space').join(' + ')||'Copernicus Data Space',features:[...features.values()],dates:[...dates].sort(),officialVerified,officialScenes,sources:available,warnings};
}
