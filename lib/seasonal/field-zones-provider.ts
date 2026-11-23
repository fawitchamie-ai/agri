import {bbox,multiArea,type RasterCell} from './land.ts';
import type {Position} from './parcel.ts';
import {intersection} from './geometry-ops.ts';
import {geometryIdentity} from './provenance.ts';
import {readRasterWindow} from './raster.ts';
import {satelliteStacSearch,type SatelliteStacItem} from './satellite.ts';
import {sentinelAssetUrl,reflectanceTransform,pixelCenter} from './satellite-index.ts';
import {containsPoint} from './parcel.ts';
import {zoneGrid,parseZoneSeason,middle,FIELD_ZONES_VERSION,type ZoneSeasonRead} from './field-zones.ts';
import {bestSentinelScene} from './sentinel-scene.ts';

const pointKey=(p:Position)=>p.map(n=>n.toFixed(7)).join(':');
const SCL_BUCKET_DEGREES=.0002;
function indexedSclAt(buckets:Map<string,RasterCell[]>,p:Position):number|null{
 const ix=Math.floor(p[0]/SCL_BUCKET_DEGREES),iy=Math.floor(p[1]/SCL_BUCKET_DEGREES);
 // African Sentinel-2 tiles stay below 40° latitude. A 20 m SCL pixel spans
 // less than one bucket there; adjacent buckets cover boundary rounding.
 for(let x=ix-1;x<=ix+1;x++)for(let y=iy-1;y<=iy+1;y++)
  for(const cell of buckets.get(`${x}:${y}`)??[])if(containsPoint(cell.geometry.coordinates[0],p))return cell.value;
 return null;
}
function pixelAreaInsideRectangle(rasterPixel:Position[],bounds:{left:number;right:number;bottom:number;top:number}):number{
 let points=rasterPixel.slice(0,-1);
 const edges:[0|1,number,boolean][]=[[0,bounds.left,true],[0,bounds.right,false],[1,bounds.bottom,true],[1,bounds.top,false]];
 for(const [axis,limit,greater] of edges){
  const input=points;points=[];if(!input.length)break;
  const inside=(p:Position)=>greater?p[axis]>=limit:p[axis]<=limit;
  let previous=input.at(-1)!,previousInside=inside(previous);
  for(const current of input){
   const currentInside=inside(current);
   if(currentInside!==previousInside){const span=current[axis]-previous[axis];if(span!==0){const t=(limit-previous[axis])/span;points.push([previous[0]+t*(current[0]-previous[0]),previous[1]+t*(current[1]-previous[1])]);}}
   if(currentInside)points.push(current);
   previous=current;previousInside=currentInside;
  }
 }
 if(points.length<3)return 0;
 const ring=[...points,points[0]];
 return multiArea([[ring]]);
}
/** One season per read: two stratified dates, up to two cloud fallbacks.
 * Never consumes harvests, inferred crop labels or future interpolation. */
export async function readZoneSeason(geometry:unknown,rawSeason:unknown,fetcher:typeof fetch=fetch,reader:typeof readRasterWindow=readRasterWindow,requestSignal?:AbortSignal,onSceneProgress?:(progress:{date:string;attempt:number;maxAttempts:number})=>void):Promise<ZoneSeasonRead>{
 const grid=zoneGrid(geometry),today=new Date().toISOString().slice(0,10),season=parseZoneSeason(rawSeason,today);
 if(grid.areaM2>1_000_000)throw new Error('Découpez le champ en secteurs de 100 ha maximum pour l’historique satellite.');
 const deadline=AbortSignal.timeout(160000),signal=requestSignal?AbortSignal.any([deadline,requestSignal]):deadline;
 const scopedFetcher:typeof fetch=(input,init={})=>fetcher(input,{...init,signal:init.signal?AbortSignal.any([signal,init.signal]):signal});
 let catalog:Awaited<ReturnType<typeof satelliteStacSearch>>,radiometry='Collection 1';
 try{catalog=await satelliteStacSearch(bbox(grid.shape),season.startDate,season.endDate,scopedFetcher,'ndvi',true,true);}
 catch{
  // C1 backfill is not complete everywhere. Accept a legacy COG only when
  // its provider explicitly certifies that the BOA offset was already applied.
  // Never guess from the year or silently mix unqualified raw digital numbers.
  const legacy=await satelliteStacSearch(bbox(grid.shape),season.startDate,season.endDate,scopedFetcher,'ndvi',false,true);
  const features=legacy.features.filter(i=>i.properties?.['earthsearch:boa_offset_applied']===true||i.properties?.['sentinel:boa_offset_applied']===true);
  if(!features.length)throw new Error('Aucun historique avec radiométrie vérifiable : Collection 1 absente et anciens offsets non certifiés.');
  catalog={...legacy,features};radiometry='COG harmonisé · offset déjà appliqué selon les métadonnées';
 }
 const byDate=new Map<string,SatelliteStacItem>();
 const dateItems=new Map<string,SatelliteStacItem[]>();
 for(const item of catalog.features){const date=item.properties?.datetime?.slice(0,10);if(!date||date<season.startDate||date>season.endDate)continue;
  dateItems.set(date,[...(dateItems.get(date)??[]),item]);
  const old=byDate.get(date),cloud=item.properties?.['eo:cloud_cover']??100,oldCloud=old?.properties?.['eo:cloud_cover']??100;
  if(!old||cloud<oldCloud)byDate.set(date,item);
 }
 const candidates=[...byDate.entries()].sort(([a],[b])=>a.localeCompare(b)),selected:typeof candidates=[];
 // Start with two dates from opposite halves of the requested window. Most
 // seasons can meet the two-clear-date rule with these; only cloudy/partial
 // seasons pay for additional acquisitions.
 const count=Math.min(2,candidates.length);
 for(let i=0;i<count;i++){
  const group=candidates.slice(Math.floor(i*candidates.length/count),Math.floor((i+1)*candidates.length/count));
  group.sort((a,b)=>(a[1].properties?.['eo:cloud_cover']??100)-(b[1].properties?.['eo:cloud_cover']??100));selected.push(group[0]);
 }
 // A single fallback can recover cloudy/partial seasons without letting one
 // Worker invocation decode four full acquisitions and hit Cloudflare 1102.
 const extra=candidates.filter(([d])=>!selected.some(([chosen])=>chosen===d))
  .sort((a,b)=>(a[1].properties?.['eo:cloud_cover']??100)-(b[1].properties?.['eo:cloud_cover']??100)).slice(0,1);
 if(!selected.length)throw new Error('Aucune scène à radiométrie vérifiée publiée pendant cette fenêtre.');
 const [w,s,,north]=grid.bounds,cos=Math.max(.2,Math.cos((s+north)/2*Math.PI/180)),dx=grid.gridM/(111320*cos),dy=grid.gridM/111320;
 const lattice=(p:Position)=>`${Math.floor((p[0]-w)/dx)}:${Math.floor((p[1]-s)/dy)}`;
 const cellIds=new Map(grid.cells.map(c=>[lattice(c.center),c.id])),perCell=new Map<number,number[]>();
 // Interior 20 m cells are unchanged rectangles. Native pixels completely
 // inside one of them have an exact spherical area without polygon clipping.
 // Keep clipping for every boundary/partial cell so field edges and holes stay
 // exact. This removes most per-pixel polygon intersections on small fields.
 const cellLattices=new Map<number,{x:number;y:number;left:number;right:number;bottom:number;top:number;full:boolean}>();
 for(const c of grid.cells){
  const x=Math.floor((c.center[0]-w)/dx),y=Math.floor((c.center[1]-s)/dy),left=w+x*dx,right=left+dx,bottom=s+y*dy,top=bottom+dy;
  const polygon=c.geometry.coordinates;
  const points=polygon.flat(2) as Position[];
  const bounds=points.length?[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))] as const:null;
  const expectedArea=multiArea([[[[left,bottom],[right,bottom],[right,top],[left,top],[left,bottom]]]]);
  const full=polygon.length===1&&polygon[0].length===1&&bounds!==null&&
   Math.abs(c.areaM2-expectedArea)<.01&&Math.abs(bounds[0]-left)<1e-10&&Math.abs(bounds[1]-bottom)<1e-10&&Math.abs(bounds[2]-right)<1e-10&&Math.abs(bounds[3]-top)<1e-10;
  cellLattices.set(c.id,{x,y,left,right,bottom,top,full});
 }
 const scenes:ZoneSeasonRead['scenes']=[],issues:string[]=[];
 const acquisitions=[...selected,...extra];
 for(const [attempt,[date,candidate]] of acquisitions.entries()){
  if(attempt>=2){const twice=grid.cells.filter(c=>(perCell.get(c.id)?.length??0)>=2).reduce((n,c)=>n+c.areaM2,0);if(twice/grid.areaM2>=.6)break;}
  onSceneProgress?.({date,attempt:attempt+1,maxAttempts:acquisitions.length});
  try{
  const {item,scl,mask}=await bestSentinelScene(dateItems.get(date)??[candidate],grid.shape,scopedFetcher,signal,reader);
  // An opaque acquisition still has an RGB image. Retain its measured mask
  // and date without downloading two unusable reflectance bands.
  if(mask.clear===0){scenes.push({date,itemId:(item.id??date).slice(0,200),clearFraction:0,mask});continue;}
  const assets=item.assets??{},asset=(...keys:string[])=>{const a=keys.map(k=>assets[k]).find(a=>a?.href);if(!a)throw new Error('Bande absente');return a;};
  const redAsset=asset('B04','red'),nirAsset=asset('B08','nir','nir_1');
  const [red,nir]=await Promise.all([
   reader(sentinelAssetUrl(redAsset.href),grid.shape,scopedFetcher,signal,[0],false,25000),
   reader(sentinelAssetUrl(nirAsset.href),grid.shape,scopedFetcher,signal,[0],false,25000),
  ]);
  if(red.resolutionM>grid.gridM||nir.resolutionM>grid.gridM||scl.resolutionM>grid.gridM)throw new Error('Résolution source plus grossière que la grille : analyse suspendue.');
  const nirCells=new Map(nir.cells.map(c=>[pointKey(pixelCenter(c)),c]));
  const buckets=new Map<string,RasterCell[]>();
  for(const c of scl.cells){const p=pixelCenter(c),key=`${Math.floor(p[0]/SCL_BUCKET_DEGREES)}:${Math.floor(p[1]/SCL_BUCKET_DEGREES)}`;buckets.set(key,[...(buckets.get(key)??[]),c]);}
  const rt=reflectanceTransform(redAsset,item),nt=reflectanceTransform(nirAsset,item),values=new Map<number,{ndvi:number;area:number}[]>();let clearAreaTotal=0;
  for(const cell of red.cells){const p=pixelCenter(cell);
   const cls=indexedSclAt(buckets,p);if(cls!==4&&cls!==5)continue;
   const nr=nirCells.get(pointKey(p))?.value,rr=cell.value;
   if(nr==null||rr==null||!Number.isFinite(nr)||!Number.isFinite(rr)||nr<=0||rr<=0)continue;
   const redRho=(rr*rt.scale+rt.offset)/rt.light,nirRho=(nr*nt.scale+nt.offset)/nt.light;
   if(redRho<0||nirRho<0||redRho+nirRho<=0)continue;
   const ndvi=(nirRho-redRho)/(nirRho+redRho);if(ndvi<-1||ndvi>1)continue;
   const ring=cell.geometry.coordinates[0],corners=ring.slice(0,4),b:[number,number,number,number]=[
    Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1])),Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))];
   const epsilon=1e-10,x0=Math.floor((b[0]-w)/dx+epsilon),x1=Math.ceil((b[2]-w)/dx-epsilon)-1,y0=Math.floor((b[1]-s)/dy+epsilon),y1=Math.ceil((b[3]-s)/dy-epsilon)-1;
   // A native pixel can straddle multiple grid cells. Intersect its footprint
   // with every candidate, counting only actual clear surface inside the field.
   for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
    const id=cellIds.get(`${x}:${y}`);if(id===undefined)continue;
    const info=cellLattices.get(id)!;
    // Most native pixels fit fully inside one 20 m cell; avoid clipping those.
    // Only pixels crossing a grid edge or the parcel boundary need clipping.
    const fullyInside=info.full&&b[0]>=info.left&&b[2]<=info.right&&b[1]>=info.bottom&&b[3]<=info.top;
    const area=fullyInside?multiArea([[ring]]):info.full?pixelAreaInsideRectangle(ring,info):multiArea(intersection(cell.geometry.coordinates,grid.cells[id].geometry.coordinates));if(area<=.001)continue;
    clearAreaTotal+=area;const list=values.get(id)??[];list.push({ndvi,area});values.set(id,list);
   }
  }
  const clearFraction=Math.min(1,clearAreaTotal/grid.areaM2);
  scenes.push({date,itemId:(item.id??date).slice(0,200),clearFraction,mask});
  for(const [id,list] of values){const area=list.reduce((n,v)=>n+v.area,0);if(area/grid.cells[id].areaM2<.6)continue;
   const sorted=list.sort((a,b)=>a.ndvi-b.ndvi);let cumulative=0,value=sorted.at(-1)!.ndvi;
   for(const v of sorted){cumulative+=v.area;if(cumulative>=area/2){value=v.ndvi;break;}}
   const observations=perCell.get(id)??[];observations.push(value);perCell.set(id,observations);
  }
 }catch(error){issues.push(`${date} : ${((error as Error).message||'lecture impossible').slice(0,300)}`);}}
 if(!scenes.length)throw new Error('Aucune scène n’a pu être lue. '+issues.join(' ; '));
 return {version:FIELD_ZONES_VERSION,geometryId:geometryIdentity(grid.shape),season,retrievedOn:today,source:`${catalog.provider} · Copernicus Sentinel-2 L2A ${radiometry} · NDVI natif, SCL 4/5`,gridM:grid.gridM,scenes,
  cells:[...perCell].sort(([a],[b])=>a-b).map(([id,values])=>[id,Math.round(middle(values)!*100000)/100000,values.length]),issues};
}
