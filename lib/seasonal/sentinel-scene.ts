import {multiArea,type RasterCell} from './land.ts';
import {intersection} from './geometry-ops.ts';
import type {ParcelPolygon} from './parcel.ts';
import type {SatelliteStacItem} from './satellite.ts';
import {readRasterWindow} from './raster.ts';
import {sentinelAssetUrl} from './sentinel-assets.ts';

export type SentinelMaskCoverage={clear:number;cloud:number;shadow:number;water:number;uncertain:number;noData:number;other:number};
/** Area inside the actual outline, including holes. Scene-wide cloud metadata
 * never measures the parcel, and RGB availability does not imply clear ground. */
export function sentinelMaskCoverage(shape:ParcelPolygon,cells:RasterCell[]):SentinelMaskCoverage{
 const area=multiArea([shape.coordinates]),totals:SentinelMaskCoverage={clear:0,cloud:0,shadow:0,water:0,uncertain:0,noData:0,other:0};
 let observed=0;
 for(const c of cells){
  const inside=multiArea(intersection(c.geometry.coordinates,shape.coordinates));if(inside<=.001)continue;
  observed+=inside;
  const v=c.value,k=v===4||v===5?'clear':v===8||v===9||v===10?'cloud':v===2||v===3?'shadow':v===6?'water':v===7?'uncertain':v===null||v===0?'noData':'other';
  totals[k]+=inside;
 }
 totals.noData+=Math.max(0,area-observed);
 for(const k of Object.keys(totals) as (keyof SentinelMaskCoverage)[])totals[k]=Math.max(0,Math.min(1,totals[k]/area));
 return totals;
}

/** Overlapping tiles on the same date can differ locally or contain no data.
 * Measure their SCL on the parcel before choosing one radiometrically consistent
 * acquisition. Never mosaic different dates or relax the cloud mask. */
export async function bestSentinelScene(items:SatelliteStacItem[],shape:ParcelPolygon,fetcher:typeof fetch,signal:AbortSignal,reader:typeof readRasterWindow=readRasterWindow,maxPixels=25000){
 const candidates=items.filter(i=>{
  const a=i.assets??{},has=(...keys:string[])=>keys.some(k=>a[k]?.href);
  return has('SCL','scl','mask')&&has('B04','red')&&has('B08','nir','nir_1');
 })
  .sort((a,b)=>(a.properties?.['eo:cloud_cover']??100)-(b.properties?.['eo:cloud_cover']??100)||String(a.id).localeCompare(String(b.id))).slice(0,4);
 let best:{item:SatelliteStacItem;scl:Awaited<ReturnType<typeof readRasterWindow>>;mask:SentinelMaskCoverage}|undefined;
 const errors:string[]=[];
 for(const item of candidates){
  signal.throwIfAborted();
  try{
   const a=item.assets!.SCL??item.assets!.scl??item.assets!.mask;
   const scl=await reader(sentinelAssetUrl(a.href),shape,fetcher,signal,[0],false,maxPixels),mask=sentinelMaskCoverage(shape,scl.cells);
   if(!best||mask.clear>best.mask.clear+1e-8||Math.abs(mask.clear-best.mask.clear)<1e-8&&mask.noData<best.mask.noData-1e-8)best={item,scl,mask};
   if(mask.clear>=1-1e-8)break;
  }catch(error){signal.throwIfAborted();errors.push((error as Error).message);}
 }
 if(!best)throw new Error('Lecture du masque satellite impossible. '+errors.join(' ; '));
 return {...best,errors};
}
