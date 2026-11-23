import {bbox,type RasterCell} from './land.ts';
import {containsPoint,parcelMetrics,validateParcel,type ParcelPolygon,type Position} from './parcel.ts';
import {readRasterWindow} from './raster.ts';
import {SATELLITE_INDEX_VERSION,satelliteStacSearch,type SatelliteIndexObservation,type SatelliteStacItem} from './satellite.ts';

import {sentinelAssetUrl} from './sentinel-assets.ts';
import {bestSentinelScene} from './sentinel-scene.ts';
export {sentinelAssetUrl} from './sentinel-assets.ts';
const SATELLITE_READ_MAX_PIXELS=50_000,MAX_INDEX_SCENES=6;
const isoDay=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
type StacAsset=NonNullable<SatelliteStacItem['assets']>[string];
type StacIndexItem=SatelliteStacItem;

/** Sentinel asset metadata use the STAC Raster extension when transforms are present. */
export function reflectanceTransform(asset:StacAsset,item?:SatelliteStacItem){
 const b=Array.isArray(asset?.['raster:bands'])?asset['raster:bands'][0]:undefined;
 const scale=typeof b?.scale==='number'&&Number.isFinite(b.scale)&&b.scale>0?b.scale:1;
 // Legacy Earth Search COGs can already contain the BOA offset while still
 // advertising it in STAC. C1 assets retain raw DN and need the stated offset.
 const applied=item?.properties?.['earthsearch:boa_offset_applied']===true||item?.properties?.['sentinel:boa_offset_applied']===true;
 const offset=applied?0:typeof b?.offset==='number'&&Number.isFinite(b.offset)?b.offset:0;
 return {scale,offset,light:scale<1?1:10000};
}
export function vegetationIndices(blueRaw:number,redRaw:number,nirRaw:number,transforms={blue:{scale:1,offset:0,light:10000},red:{scale:1,offset:0,light:10000},nir:{scale:1,offset:0,light:10000}}){
 if([blueRaw,redRaw,nirRaw].some(v=>!Number.isFinite(v)||v<=0))return {ndvi:null,evi:null};
 const blue=blueRaw*transforms.blue.scale+transforms.blue.offset,red=redRaw*transforms.red.scale+transforms.red.offset,nir=nirRaw*transforms.nir.scale+transforms.nir.offset;
 const ndviDenominator=nir+red,eviDenominator=nir+6*red-7.5*blue+transforms.nir.light;
 const ndvi=ndviDenominator>0?(nir-red)/ndviDenominator:null,evi=eviDenominator>0?2.5*(nir-red)/eviDenominator:null;
 return {ndvi:ndvi!==null&&Number.isFinite(ndvi)&&ndvi>=-1&&ndvi<=1?ndvi:null,evi:evi!==null&&Number.isFinite(evi)&&evi>=-1&&evi<=1?evi:null};
}
export function pixelCenter(cell:RasterCell):Position{
 const ring=cell.geometry.coordinates[0],corners=ring.slice(0,4);
 return [corners.reduce((n,p)=>n+p[0],0)/corners.length,corners.reduce((n,p)=>n+p[1],0)/corners.length];
}
function inParcel(shape:ParcelPolygon,p:Position){return containsPoint(shape.coordinates[0],p)&&!shape.coordinates.slice(1).some(r=>containsPoint(r,p));}
const centerKey=(p:Position)=>`${p[0].toFixed(7)}:${p[1].toFixed(7)}`;
function inRing(ring:Position[],p:Position){return containsPoint(ring,p);}
export function sclAt(cells:RasterCell[],buckets:Map<string,RasterCell[]>,p:Position):number|null{
 const step=.00005,ix=Math.floor(p[0]/step),iy=Math.floor(p[1]/step);
 for(let x=ix-4;x<=ix+4;x++)for(let y=iy-4;y<=iy+4;y++)for(const c of buckets.get(`${x}:${y}`)??[])if(inRing(c.geometry.coordinates[0],p))return c.value;
 // Tiny parcels can have very few SCL pixels; use a bounded fallback.
 if(cells.length<=256){for(const c of cells)if(inRing(c.geometry.coordinates[0],p))return c.value;}
 return null;
}
function median(values:number[]){if(!values.length)return null;values.sort((a,b)=>a-b);const m=values.length>>1;return values.length%2?values[m]:(values[m-1]+values[m])/2;}
function sampledDates(features:StacIndexItem[],limit=MAX_INDEX_SCENES){
 const byDate=new Map<string,StacIndexItem>();
 for(const item of features){const rawDate=item.properties?.datetime,date=typeof rawDate==='string'?rawDate.slice(0,10):'';if(!isoDay(date))continue;const old=byDate.get(date),cloud=item.properties?.['eo:cloud_cover'],oldCloud=old?.properties?.['eo:cloud_cover'];if(!old||(typeof cloud==='number'&&(!Number.isFinite(oldCloud)||cloud<oldCloud!)))byDate.set(date,item);}
 const sorted=[...byDate.entries()].sort(([a],[b])=>a.localeCompare(b));
 if(sorted.length<=limit)return sorted;
 if(limit===1)return [sorted.at(-1)!];
 return Array.from({length:limit},(_,i)=>sorted[Math.round(i*(sorted.length-1)/(limit-1))]);
}
/** Parcel medians from native Sentinel-2 pixels. These indices are monitoring features, not tonnes/ha. */
export async function satelliteIndexSeries(input:unknown,startDate:string,asOf:string,fetcher:typeof fetch=fetch,reader:typeof readRasterWindow=readRasterWindow,maxScenes=MAX_INDEX_SCENES){
 const shape=validateParcel(input),area=parcelMetrics(shape).areaM2,today=new Date().toISOString().slice(0,10);
 if(!Number.isInteger(maxScenes)||maxScenes<1||maxScenes>60)throw new Error('Nombre de scènes Sentinel-2 invalide (1 à 60).');
 if(!isoDay(startDate)||!isoDay(asOf)||asOf>today||startDate>asOf||(Date.parse(asOf)-Date.parse(startDate))/86400000>240)throw new Error('Période satellite invalide : une campagne doit tenir dans les 240 derniers jours.');
 if(area>5_000_000)throw new Error('Contour supérieur à 500 ha : découpez-le en secteurs pour l’analyse Sentinel-2.');
 const catalog=await satelliteStacSearch(bbox(shape),startDate,asOf,fetcher,true,true);
 const selected=sampledDates(catalog.features,maxScenes).filter(([date,item])=>date>=startDate&&date<=asOf&&item.assets);
 if(!selected.length)throw new Error(`Aucune scène Sentinel-2 exploitable pendant ce cycle (${catalog.provider}).`);
 const signal=AbortSignal.timeout(150_000),observations:SatelliteIndexObservation[]=[],issues:string[]=[];
 for(const [date,candidate] of selected){
  try{
  const candidates=catalog.features.filter(i=>i.properties?.datetime?.slice(0,10)===date&&(i.assets?.B02?.href||i.assets?.blue?.href));
  const {item,scl}=await bestSentinelScene(candidates.length?candidates:[candidate],shape,fetcher,signal,reader,SATELLITE_READ_MAX_PIXELS);
  const assets=item.assets!,asset=(...names:string[])=>{for(const name of names)if(assets[name]?.href)return assets[name];throw new Error(`Bande Sentinel-2 absente (${names.join('/')}).`);};
  const blueAsset=asset('B02','blue'),redAsset=asset('B04','red'),nirAsset=asset('B08','nir','nir_1');
  const [blue,red,nir]=await Promise.all([
   reader(sentinelAssetUrl(blueAsset.href),shape,fetcher,signal,[0],false,SATELLITE_READ_MAX_PIXELS),
   reader(sentinelAssetUrl(redAsset.href),shape,fetcher,signal,[0],false,SATELLITE_READ_MAX_PIXELS),
   reader(sentinelAssetUrl(nirAsset.href),shape,fetcher,signal,[0],false,SATELLITE_READ_MAX_PIXELS),
  ]);
  const redCells=new Map(red.cells.map(c=>[centerKey(pixelCenter(c)),c])),nirCells=new Map(nir.cells.map(c=>[centerKey(pixelCenter(c)),c]));
  const sclBuckets=new Map<string,RasterCell[]>();for(const cell of scl.cells){const p=pixelCenter(cell),key=`${Math.floor(p[0]/.00005)}:${Math.floor(p[1]/.00005)}`;sclBuckets.set(key,[...(sclBuckets.get(key)??[]),cell]);}
  const ndviValues:number[]=[],eviValues:number[]=[];let parcelPixels=0;
 const transforms={blue:reflectanceTransform(blueAsset,item),red:reflectanceTransform(redAsset,item),nir:reflectanceTransform(nirAsset,item)};
  for(const cell of blue.cells){const point=pixelCenter(cell);if(!inParcel(shape,point))continue;parcelPixels++;
   const redCell=redCells.get(centerKey(point)),nirCell=nirCells.get(centerKey(point)),blueValue=cell.value,redValue=redCell?.value,nirValue=nirCell?.value;
   if(blueValue===null||redValue===null||nirValue===null||redValue===undefined||nirValue===undefined)continue;
   const sclValue=sclAt(scl.cells,sclBuckets,point);if(sclValue!==4&&sclValue!==5)continue;
   const indices=vegetationIndices(blueValue,redValue,nirValue,transforms);if(indices.ndvi!==null&&indices.evi!==null){ndviValues.push(indices.ndvi);eviValues.push(indices.evi);}
  }
  const validPixels=Math.min(ndviValues.length,eviValues.length),clearFraction=parcelPixels?validPixels/parcelPixels:0;
  const quality:SatelliteIndexObservation['quality']=validPixels<10?'too-few-pixels':clearFraction<.2?'low-coverage':'usable';
  const cloud=item.properties?.['eo:cloud_cover'],sceneCloudPercent=typeof cloud==='number'&&Number.isFinite(cloud)&&cloud>=0&&cloud<=100?cloud:null;
  observations.push({date,availableOn:today,itemId:(item.id??date).slice(0,200),ndviMedian:validPixels>=10?median(ndviValues):null,eviMedian:validPixels>=10?median(eviValues):null,validPixels,parcelPixels,clearFraction,sceneCloudPercent,quality});
  }catch{issues.push(date);}
 }
 if(!observations.length)throw new Error('Aucune des scènes Sentinel-2 sélectionnées n’a pu être lue. Actualisez les dates et réessayez.');
 return {version:SATELLITE_INDEX_VERSION,source:`${catalog.provider} STAC · Sentinel-2 L2A Collection 1 · bandes natives B02/B04/B08 · masque SCL 4/5`,retrievedOn:today,observations,
  issues,coverageNote:'Médiane spatiale des pixels du contour, après exclusion des classes SCL nuage, ombre, eau et sans donnée. La couverture nuageuse de scène reste un indicateur régional. NDVI/EVI suivent la végétation et ne constituent pas un rendement en t/ha.'};
}
