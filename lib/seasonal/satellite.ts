import {bbox} from './land.ts';
import {validateParcel,type ParcelPolygon} from './parcel.ts';
export const SATELLITE_WMS='https://ows.digitalearth.africa/wms';
export const SATELLITE_SOURCE='https://docs.digitalearthafrica.org/en/latest/data_specs/NDVI_Anomaly_specs.html';
export const SATELLITE_LAYERS={
 rgb:{name:'s2_l2a',style:'simple_rgb',label:'Image Sentinel-2',resolutionM:10,period:'day'},
 ndvi:{name:'s2_l2a',style:'ndvi',label:'Vigueur de la végétation (NDVI)',resolutionM:10,period:'day'},
 classification:{name:'s2_l2a',style:'scl',label:'Nuages, sol et eau (SCL)',resolutionM:20,period:'day'},
 anomaly:{name:'ndvi_anomaly',style:'style_ndvi_anomaly',label:'Anomalie mensuelle de végétation',resolutionM:30,period:'month'},
 clear:{name:'ndvi_anomaly',style:'style_count',label:'Observations claires du mois',resolutionM:30,period:'month'},
} as const;
export type SatelliteLayer=keyof typeof SATELLITE_LAYERS;
/** Workers supports manual/follow, but rejects redirect:error before fetching.
 * Reject redirects explicitly so parcel coordinates never reach a new host. */
async function satelliteFetch(url:string|URL,timeoutMs:number,fetcher:typeof fetch){
 const response=await fetcher(url,{signal:AbortSignal.timeout(timeoutMs),redirect:'manual'});
 if(response.status>=300&&response.status<400){await response.body?.cancel();throw new Error('Redirection du fournisseur satellite refusée.');}
 return response;
}
const iso=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
/** Normalize advertised dates only; timestamps and declared ISO intervals are
 * valid WMS time dimensions. Never fill missing months outside those intervals. */
export function advertisedSatelliteDates(value:string,asOf:string){
 const out=new Set<string>();
 const date=(raw:string)=>{const t=raw.trim();const d=t.slice(0,10);return iso(d)&&(t.length===10||/^\d{4}-\d{2}-\d{2}T/.test(t)&&Number.isFinite(Date.parse(t)))?d:null;};
 for(const token of value.split(',')){
  const parts=token.trim().split('/');
  if(parts.length===1){const d=date(token);if(d&&d<=asOf)out.add(d);continue;}
  if(parts.length!==3)continue;
  const from=date(parts[0]),to=date(parts[1]),step=parts[2].match(/^P(\d+)(D|M|Y)$/);
  if(!from||!to||!step||Number(step[1])<1||from>to)continue;
  const count=Number(step[1]),unit=step[2];
  let current=from;
  for(let i=0;i<20000&&current<=to&&current<=asOf;i++){
   out.add(current);const d=new Date(current+'T00:00:00Z');
   if(unit==='D')d.setUTCDate(d.getUTCDate()+count);
   else if(unit==='M')d.setUTCMonth(d.getUTCMonth()+count);
   else d.setUTCFullYear(d.getUTCFullYear()+count);
   const next=d.toISOString().slice(0,10);if(next<=current)break;current=next;
  }
 }
 return [...out].sort().reverse();
}
/** Metadata only: no parcel sent to the regional capabilities service. */
export function satelliteDates(xml:string,asOf:string){
 if(xml.length>8_000_000||!iso(asOf))throw new Error('Métadonnées satellite ou date invalides.');
 const found:Record<string,{dates:string[];styles:string[]}>={};
 for(const block of xml.split(/<(?:\w+:)?Layer(?:\s[^>]*)?>/).slice(1)){
  const name=block.match(/<(?:\w+:)?Name>\s*([^<]+)\s*<\/(?:\w+:)?Name>/)?.[1]?.trim();
  if(!name||!['s2_l2a','ndvi_anomaly'].includes(name))continue;
  const times=[...block.matchAll(/<(?:\w+:)?(?:Dimension|Extent)\b[^>]*name=["']time["'][^>]*>([^<]+)<\/(?:\w+:)?(?:Dimension|Extent)>/gi)].map(m=>m[1]);
  const styles=[...block.matchAll(/<(?:\w+:)?Style\b[^>]*>[\s\S]*?<(?:\w+:)?Name>([^<]+)<\/(?:\w+:)?Name>/g)].map(x=>x[1].trim());
  found[name]={dates:advertisedSatelliteDates(times.join(','),asOf),styles};
 }
 return Object.fromEntries(Object.entries(SATELLITE_LAYERS).map(([id,l])=>[id,{...l,dates:found[l.name]?.styles.includes(l.style)?found[l.name].dates.slice(0,l.period==='month'?24:120):[]}])) as Record<SatelliteLayer,{name:string;style:string;label:string;resolutionM:number;period:string;dates:string[]}>;
}
let cache:{until:number;xml:string}|undefined;
let inflight:Promise<string>|undefined;
let parsedCatalog:{xml:string;asOf:string;layers:ReturnType<typeof satelliteDates>}|undefined;
async function capabilities(fetcher:typeof fetch){
 if(fetcher===fetch&&cache&&cache.until>Date.now())return cache.xml;
 if(fetcher===fetch&&inflight)return inflight;
 const task=(async()=>{const r=await satelliteFetch(SATELLITE_WMS+'?service=WMS&version=1.3.0&request=GetCapabilities',25000,fetcher);if(!r.ok){await r.body?.cancel();throw new Error('Catalogue satellite temporairement indisponible.');}const xml=await r.text();if(!xml.includes('WMS_Capabilities')&&!xml.includes('WMT_MS_Capabilities'))throw new Error('Catalogue satellite illisible.');if(xml.length>8_000_000)throw new Error('Catalogue satellite trop volumineux.');if(fetcher===fetch)cache={until:Date.now()+6*3600000,xml};return xml;})();
 if(fetcher===fetch)inflight=task;
 try{return await task;}finally{if(fetcher===fetch)inflight=undefined;}
}
export async function satelliteCatalog(asOf:string,fetcher:typeof fetch=fetch){
 if(!iso(asOf)||asOf>new Date().toISOString().slice(0,10))throw new Error('Date satellite invalide.');
 const xml=await capabilities(fetcher);
 const layers=parsedCatalog?.xml===xml&&parsedCatalog.asOf===asOf?parsedCatalog.layers:satelliteDates(xml,asOf);
 if(fetcher===fetch)parsedCatalog={xml,asOf,layers};
 return {provider:'Digital Earth Africa',license:'Données Copernicus Sentinel-2 / produits DE Africa CC BY 4.0',source:SATELLITE_SOURCE,asOf,layers,scope:'Dates du catalogue régional ; une acquisition peut être nuageuse ou absente sur le champ. Les zones transparentes restent sans donnée.'};
}
export function satelliteBounds(input:unknown,contextM=200):[number,number,number,number]{
 const shape=validateParcel(input),[w,s,e,n]=bbox(shape),lat=(s+n)/2,k=Math.max(.2,Math.cos(lat*Math.PI/180));
 // Wider analytical context keeps native 10–30 m cells readable without inventing detail.
 if(!Number.isFinite(contextM)||contextM<200||contextM>10000)throw new Error('Contexte satellite invalide.');
 let width=Math.max((e-w)*1.2,contextM/111320/k),height=Math.max((n-s)*1.2,contextM/111320);const cx=(w+e)/2,cy=(s+n)/2;
 if(width*k/height<1.6)width=height*1.6/k;else height=width*k/1.6;
 return [cx-width/2,cy-height/2,cx+width/2,cy+height/2];
}
export function satelliteMapUrl(layer:SatelliteLayer,date:string,bounds:number[]){
 if(!Object.hasOwn(SATELLITE_LAYERS,layer)||!iso(date)||bounds.length!==4||bounds.some(v=>!Number.isFinite(v))||bounds[0]>=bounds[2]||bounds[1]>=bounds[3]||bounds[0]<-180||bounds[2]>180||bounds[1]<-85||bounds[3]>85||bounds[2]-bounds[0]>2||bounds[3]-bounds[1]>2)throw new Error('Emprise ou couche satellite invalide.');
 const l=SATELLITE_LAYERS[layer],u=new URL(SATELLITE_WMS);
 u.search=new URLSearchParams({service:'WMS',request:'GetMap',version:'1.3.0',layers:l.name,styles:l.style,crs:'EPSG:4326',bbox:[bounds[1],bounds[0],bounds[3],bounds[2]].join(','),width:'512',height:'320',format:'image/png',transparent:'true',time:date}).toString();return u.toString();
}
export async function satelliteImage(layer:SatelliteLayer,date:string,bounds:number[],fetcher:typeof fetch=fetch){
 const url=satelliteMapUrl(layer,date,bounds),catalog=await satelliteCatalog(new Date().toISOString().slice(0,10),fetcher);
 if(!catalog.layers[layer].dates.includes(date))throw new Error('Cette date n’est pas publiée dans le catalogue courant. Actualisez les dates.');
 const r=await satelliteFetch(url,45000,fetcher);
 if(!r.ok){await r.body?.cancel();throw new Error('Image satellite indisponible pour cette date.');}
 const bytes=await r.arrayBuffer();const signature=new Uint8Array(bytes,0,Math.min(8,bytes.byteLength));
 if(bytes.byteLength>3_000_000||signature.length!==8||![137,80,78,71,13,10,26,10].every((v,i)=>signature[i]===v))throw new Error('Le fournisseur n’a pas renvoyé une image PNG exploitable.');
 return new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff','X-Satellite-Date':date,'X-Satellite-Provider':'Digital Earth Africa'}});
}
export function satelliteClientUrl(layer:SatelliteLayer,date:string,shape:ParcelPolygon){return '/api/seasonal?'+new URLSearchParams({satellite:'image',layer,date,bbox:satelliteBounds(shape).join(',')});}

/** Called only after the visitor explicitly requests images for this geometry. */
export async function satelliteScenes(input:unknown,asOf:string,fetcher:typeof fetch=fetch){
 const shape=validateParcel(input);if(!iso(asOf)||asOf>new Date().toISOString().slice(0,10))throw new Error('Date satellite invalide.');
 const from=new Date(Date.parse(asOf)-120*86400000).toISOString(),u=new URL('https://explorer.digitalearth.africa/stac/search');
 u.search=new URLSearchParams({collections:'s2_l2a',bbox:bbox(shape).join(','),datetime:`${from}/${asOf}T23:59:59Z`,sortby:'-datetime',limit:'60'}).toString();
 const r=await satelliteFetch(u,25000,fetcher);if(!r.ok){await r.body?.cancel();throw new Error('Dates d’acquisition de la parcelle indisponibles.');}
 const data=await r.json() as {features?:{properties?:{datetime?:string;'eo:cloud_cover'?:number}}[]};if(!Array.isArray(data.features)||data.features.length>60)throw new Error('Catalogue des scènes satellite invalide.');
 const dates=new Map<string,{date:string;sceneCloudMin:number|null;sceneCloudMax:number|null}>();
 for(const item of data.features){const p=item.properties,date=p?.datetime?.slice(0,10);if(!date||!iso(date)||date>asOf||date<from.slice(0,10))continue;const cloud=p?.['eo:cloud_cover'],qualified=typeof cloud==='number'&&Number.isFinite(cloud)&&cloud>=0&&cloud<=100?cloud:null;const old=dates.get(date);dates.set(date,{date,sceneCloudMin:qualified===null?old?.sceneCloudMin??null:old?.sceneCloudMin==null?qualified:Math.min(qualified,old.sceneCloudMin),sceneCloudMax:qualified===null?old?.sceneCloudMax??null:old?.sceneCloudMax==null?qualified:Math.max(qualified,old.sceneCloudMax)});}
 return {dates:[...dates.values()].sort((a,b)=>b.date.localeCompare(a.date)),source:'Digital Earth Africa STAC / Sentinel-2 L2A',scope:'Scènes intersectant l’emprise. La couverture nuageuse concerne la scène entière, pas une mesure sur votre parcelle.'};
}

/** Public undated basemap, distinct from a dated Sentinel observation or index. */
export function satelliteBasemapUrl(bounds:number[],width:1600|1024|640=1600){
 if(![1600,1024,640].includes(width))throw new Error('Taille de fond satellite invalide.');
 // Reuse the exact same geographic bounds validation as WMS.
 satelliteMapUrl('rgb','2026-01-01',bounds);
 const u=new URL('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export');
 u.search=new URLSearchParams({bbox:bounds.join(','),bboxSR:'4326',imageSR:'4326',size:`${width},${width/1.6}`,format:'png32',transparent:'false',f:'image'}).toString();return u.toString();
}

/** Four bounded requests, each within the provider's 512 px limit.
 * Together they render 1024×640 actual output pixels, with no invented source detail. */
export function satelliteTilePlan(layer:SatelliteLayer,date:string,bounds:number[]){
 satelliteMapUrl(layer,date,bounds);
 const [w,s,e,n]=bounds,mx=(w+e)/2,my=(s+n)/2;
 return [[w,my,mx,n],[mx,my,e,n],[w,s,mx,my],[mx,s,e,my]].map((b,index)=>({index,bounds:b,
  direct:satelliteMapUrl(layer,date,b),
  src:'/api/seasonal?'+new URLSearchParams({satellite:'image',layer,date,bbox:b.join(',')})}));
}
