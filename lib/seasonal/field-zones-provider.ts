import {bbox,multiArea,type RasterCell} from './land.ts';
import type {Position} from './parcel.ts';
import {intersection} from './geometry-ops.ts';
import {geometryIdentity} from './provenance.ts';
import {readRasterWindow} from './raster.ts';
import {satelliteStacSearch,type SatelliteStacItem} from './satellite.ts';
import {sentinelAssetUrl,reflectanceTransform,pixelCenter,sclAt} from './satellite-index.ts';
import {zoneGrid,parseZoneSeason,middle,FIELD_ZONES_VERSION,type ZoneSeasonRead} from './field-zones.ts';

const pointKey=(p:Position)=>p.map(n=>n.toFixed(7)).join(':');
/** One season per request: four stratified dates, up to two cloud fallbacks.
 * Never consumes harvests, inferred crop labels or future interpolation. */
export async function readZoneSeason(geometry:unknown,rawSeason:unknown,fetcher:typeof fetch=fetch,reader:typeof readRasterWindow=readRasterWindow):Promise<ZoneSeasonRead>{
 const grid=zoneGrid(geometry),today=new Date().toISOString().slice(0,10),season=parseZoneSeason(rawSeason,today);
 if(grid.areaM2>1_000_000)throw new Error('Découpez le champ en secteurs de 100 ha maximum pour l’historique satellite.');
 let catalog:Awaited<ReturnType<typeof satelliteStacSearch>>,radiometry='Collection 1';
 try{catalog=await satelliteStacSearch(bbox(grid.shape),season.startDate,season.endDate,fetcher,'ndvi',true);}
 catch{
  // C1 backfill is not complete everywhere. Accept a legacy COG only when
  // its provider explicitly certifies that the BOA offset was already applied.
  // Never guess from the year or silently mix unqualified raw digital numbers.
  const legacy=await satelliteStacSearch(bbox(grid.shape),season.startDate,season.endDate,fetcher,'ndvi',false);
  const features=legacy.features.filter(i=>i.properties?.['earthsearch:boa_offset_applied']===true||i.properties?.['sentinel:boa_offset_applied']===true);
  if(!features.length)throw new Error('Aucun historique avec radiométrie vérifiable : Collection 1 absente et anciens offsets non certifiés.');
  catalog={...legacy,features};radiometry='COG harmonisé · offset déjà appliqué selon les métadonnées';
 }
 const byDate=new Map<string,SatelliteStacItem>();
 for(const item of catalog.features){const date=item.properties?.datetime?.slice(0,10);if(!date||date<season.startDate||date>season.endDate)continue;
  const old=byDate.get(date),cloud=item.properties?.['eo:cloud_cover']??100,oldCloud=old?.properties?.['eo:cloud_cover']??100;
  if(!old||cloud<oldCloud)byDate.set(date,item);
 }
 const candidates=[...byDate.entries()].sort(([a],[b])=>a.localeCompare(b)),selected:typeof candidates=[];
 const count=Math.min(4,candidates.length);
 for(let i=0;i<count;i++){
  const group=candidates.slice(Math.floor(i*candidates.length/count),Math.floor((i+1)*candidates.length/count));
  group.sort((a,b)=>(a[1].properties?.['eo:cloud_cover']??100)-(b[1].properties?.['eo:cloud_cover']??100));selected.push(group[0]);
 }
 const extra=candidates.filter(([d])=>!selected.some(([chosen])=>chosen===d)).sort((a,b)=>(a[1].properties?.['eo:cloud_cover']??100)-(b[1].properties?.['eo:cloud_cover']??100)).slice(0,2);
 if(!selected.length)throw new Error('Aucune scène à radiométrie vérifiée publiée pendant cette fenêtre.');
 const [w,s,,north]=grid.bounds,cos=Math.max(.2,Math.cos((s+north)/2*Math.PI/180)),dx=grid.gridM/(111320*cos),dy=grid.gridM/111320;
 const lattice=(p:Position)=>`${Math.floor((p[0]-w)/dx)}:${Math.floor((p[1]-s)/dy)}`;
 const cellIds=new Map(grid.cells.map(c=>[lattice(c.center),c.id])),perCell=new Map<number,number[]>();
 const scenes:ZoneSeasonRead['scenes']=[],issues:string[]=[],signal=AbortSignal.timeout(160000);
 for(const [attempt,[date,item]] of [...selected,...extra].entries()){
  if(attempt>=4){const twice=grid.cells.filter(c=>(perCell.get(c.id)?.length??0)>=2).reduce((n,c)=>n+c.areaM2,0);if(twice/grid.areaM2>=.6)break;}
  try{
  const assets=item.assets??{},asset=(...keys:string[])=>{const a=keys.map(k=>assets[k]).find(a=>a?.href);if(!a)throw new Error('Bande absente');return a;};
  const redAsset=asset('B04','red'),nirAsset=asset('B08','nir','nir_1'),sclAsset=asset('SCL','scl','mask');
  const [red,nir,scl]=await Promise.all([
   reader(sentinelAssetUrl(redAsset.href),grid.shape,fetcher,signal,[0],false,25000),
   reader(sentinelAssetUrl(nirAsset.href),grid.shape,fetcher,signal,[0],false,25000),
   reader(sentinelAssetUrl(sclAsset.href),grid.shape,fetcher,signal,[0],false,25000),
  ]);
  if(red.resolutionM>grid.gridM||nir.resolutionM>grid.gridM||scl.resolutionM>grid.gridM)throw new Error('Résolution source plus grossière que la grille : analyse suspendue.');
  const nirCells=new Map(nir.cells.map(c=>[pointKey(pixelCenter(c)),c]));
  const buckets=new Map<string,RasterCell[]>();
  for(const c of scl.cells){const p=pixelCenter(c),key=`${Math.floor(p[0]/.00005)}:${Math.floor(p[1]/.00005)}`;buckets.set(key,[...(buckets.get(key)??[]),c]);}
  const rt=reflectanceTransform(redAsset,item),nt=reflectanceTransform(nirAsset,item),values=new Map<number,{ndvi:number;area:number}[]>();let clearAreaTotal=0;
  for(const cell of red.cells){const p=pixelCenter(cell);
   const cls=sclAt(scl.cells,buckets,p);if(cls!==4&&cls!==5)continue;
   const nr=nirCells.get(pointKey(p))?.value,rr=cell.value;
   if(nr==null||rr==null||!Number.isFinite(nr)||!Number.isFinite(rr)||nr<=0||rr<=0)continue;
   const redRho=(rr*rt.scale+rt.offset)/rt.light,nirRho=(nr*nt.scale+nt.offset)/nt.light;
   if(redRho<0||nirRho<0||redRho+nirRho<=0)continue;
   const ndvi=(nirRho-redRho)/(nirRho+redRho);if(ndvi<-1||ndvi>1)continue;
   const b=bbox(cell.geometry),x0=Math.floor((b[0]-w)/dx),x1=Math.floor((b[2]-w)/dx),y0=Math.floor((b[1]-s)/dy),y1=Math.floor((b[3]-s)/dy);
   // A native pixel can straddle multiple grid cells. Intersect its footprint
   // with every candidate, counting only actual clear surface inside the field.
   for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
    const id=cellIds.get(`${x}:${y}`);if(id===undefined)continue;
    const area=multiArea(intersection(cell.geometry.coordinates,grid.cells[id].geometry.coordinates));if(area<=.001)continue;
    clearAreaTotal+=area;const list=values.get(id)??[];list.push({ndvi,area});values.set(id,list);
   }
  }
  const clearFraction=Math.min(1,clearAreaTotal/grid.areaM2);
  scenes.push({date,itemId:(item.id??date).slice(0,200),clearFraction});
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
