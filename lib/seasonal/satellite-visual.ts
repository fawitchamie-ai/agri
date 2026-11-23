import {readRasterWindow} from './raster.ts';
import {sentinelAssetUrl,reflectanceTransform,pixelCenter,sclAt} from './satellite-index.ts';
import {fieldNdviColor} from './field-analysis.ts';
import {satelliteMapUrl} from './satellite.ts';
import {verifiedImageCatalog} from './field-image-loader.ts';
import type {ParcelPolygon} from './parcel.ts';
import {bestSentinelScene} from './sentinel-scene.ts';

export const SCL_PALETTE:Record<number,string>={0:'#00000000',1:'#ff0000',2:'#2f2f2f',3:'#643200',4:'#27a525',5:'#ffe65a',6:'#0064ff',7:'#888888',8:'#cccccc',9:'#ffffff',10:'#65d3e6',11:'#ff96ff'};
const key=(cell:Parameters<typeof pixelCenter>[0])=>pixelCenter(cell).map(v=>v.toFixed(7)).join(':');
/** Display stretch only: fixed 0–0.3 reflectance, gamma 2.2. Never an NDVI calculation. */
export const reflectanceChannel=(value:number)=>Math.round(255*Math.pow(Math.max(0,Math.min(1,value/.3)),1/2.2));
export async function readSatelliteVisual(bounds:number[],date:string,layer:'rgb'|'classification'|'ndvi'|'contrast',fetcher:typeof fetch=fetch,requestSignal?:AbortSignal,reader:typeof readRasterWindow=readRasterWindow,preferredItemId?:string){
 const deadline=AbortSignal.timeout(160000),signal=requestSignal?AbortSignal.any([deadline,requestSignal]):deadline;
 satelliteMapUrl(layer==='contrast'?'ndvi':layer,date,bounds);
 const [w,s,e,n]=bounds,shape:ParcelPolygon={type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]};
 const scoped:typeof fetch=(input,init={})=>fetcher(input,{...init,signal:init.signal?AbortSignal.any([signal,init.signal]):signal});
 const catalog=await verifiedImageCatalog(bounds,date,date,scoped);
 const items=catalog.features.filter(i=>i.properties?.datetime?.slice(0,10)===date).sort((a,b)=>(a.properties?.['eo:cloud_cover']??100)-(b.properties?.['eo:cloud_cover']??100));
 const candidates=items.filter(i=>(!preferredItemId||i.id===preferredItemId)&&(layer!=='rgb'||!!(i.assets?.B03??i.assets?.green)));
 if(!candidates.length)throw new Error('Aucune acquisition datée avec les bandes nécessaires.');
 const {item,scl,mask}=await bestSentinelScene(candidates,shape,scoped,signal,reader,100000);
 const assets=item.assets??{},asset=(...keys:string[])=>{const a=keys.map(k=>assets[k]).find(v=>v?.href);if(!a)throw new Error('Bande satellite absente.');return a;};
 if(layer==='classification'){
  const r=scl;
  const pixels=r.cells.filter(c=>c.value!==null&&c.value!==0).map(c=>({geometry:c.geometry,color:SCL_PALETTE[c.value!]??'#888888',value:c.value}));
  if(!pixels.length)throw new Error('Acquisition sans pixels de classification sur cette emprise.');
  return {date,itemId:item.id,source:catalog.provider,pixels,resolutionM:r.resolutionM,valueRange:null,mask,maskReason:null as string|null};
 }
 if(layer==='ndvi'||layer==='contrast'){
  if(mask.clear===0)return {date,itemId:item.id,source:catalog.provider,pixels:[] as {geometry:ParcelPolygon;color:string;value:number}[],resolutionM:10,valueRange:null,mask,
   maskReason:'Acquisition chargée : aucun pixel de sol clair pour le NDVI. '+Math.round(mask.cloud*100)+' % de nuages/cirrus, '+Math.round(mask.shadow*100)+' % d’ombres, '+Math.round(mask.noData*100)+' % sans donnée. Consultez l’image datée ou choisissez une autre date.'};
  const bands=[asset('B04','red'),asset('B08','nir','nir_1')];
  const [red,nir]=await Promise.all(bands.map(a=>reader(sentinelAssetUrl(a.href),shape,scoped,signal,[0],false,100000)));
  if(Math.abs(red.resolutionM-10)>1||Math.abs(nir.resolutionM-10)>1)throw new Error('Résolution Sentinel-2 incompatible : les bandes B04/B08 doivent être à 10 m.');
  const nirBy=new Map(nir.cells.map(c=>[key(c),c.value])),rt=reflectanceTransform(bands[0],item),nt=reflectanceTransform(bands[1],item),buckets=new Map<string,typeof scl.cells>();
  for(const cell of scl.cells){const p=pixelCenter(cell),k=p.map(v=>Math.floor(v/.00005)).join(':');buckets.set(k,[...(buckets.get(k)??[]),cell]);}
  const values=red.cells.flatMap(c=>{
   const cls=sclAt(scl.cells,buckets,pixelCenter(c)),nr=nirBy.get(key(c));
   if((cls!==4&&cls!==5)||c.value==null||nr==null||c.value<=0||nr<=0)return [];
   const r=(c.value*rt.scale+rt.offset)/rt.light,n=(nr*nt.scale+nt.offset)/nt.light;
   if(r<0||n<0||r+n<=0)return [];const value=(n-r)/(n+r);
   return value>=-1&&value<=1?[{geometry:c.geometry,value}]:[];
  });
  if(!values.length)throw new Error('Aucun pixel NDVI clair sur cette emprise. Choisissez une autre date.');
  const minimum=layer==='contrast'?values.reduce((v,p)=>Math.min(v,p.value),Infinity):-1;
  const maximum=layer==='contrast'?values.reduce((v,p)=>Math.max(v,p.value),-Infinity):1;
  const pixels=values.map(p=>({...p,color:fieldNdviColor(p.value,minimum,maximum)}));
  return {date,itemId:item.id,source:catalog.provider,pixels,resolutionM:red.resolutionM,valueRange:[minimum,maximum] as [number,number],mask,maskReason:null as string|null};
 }
 const bands=[asset('B04','red'),asset('B03','green'),asset('B02','blue')];
 const [red,green,blue]=await Promise.all(bands.map(a=>reader(sentinelAssetUrl(a.href),shape,scoped,signal,[0],false,100000)));
 const greenBy=new Map(green.cells.map(c=>[key(c),c.value])),blueBy=new Map(blue.cells.map(c=>[key(c),c.value])),transforms=bands.map(a=>reflectanceTransform(a,item));
 const pixels=red.cells.flatMap(c=>{
  const values=[c.value,greenBy.get(key(c)),blueBy.get(key(c))];
  if(values.some(v=>v==null||!Number.isFinite(v)||v<=0))return [];
  const rgb=values.map((v,i)=>reflectanceChannel((v!*transforms[i].scale+transforms[i].offset)/transforms[i].light));
  return [{geometry:c.geometry,color:`rgb(${rgb.join(',')})`,value:null}];
 });
 if(!pixels.length)throw new Error('Acquisition sans pixels RGB sur cette emprise.');
 return {date,itemId:item.id,source:catalog.provider,pixels,resolutionM:red.resolutionM,valueRange:null,mask,maskReason:null as string|null};
}
