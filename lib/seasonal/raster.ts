import {BaseClient,BaseResponse,fromCustomClient} from 'geotiff';
import proj4 from 'proj4';
import {bbox,type RasterCell} from './land.ts';
import type {ParcelPolygon,Position} from './parcel.ts';

const ALLOWED_HOSTS=new Set(['esa-worldcover.s3.eu-central-1.amazonaws.com','s3.waw4-1.cloudferro.com','deafrica-services.s3.af-south-1.amazonaws.com']);
export type RasterWindow={cells:RasterCell[];resolutionM:number;crs:string};
class SafeResponse extends BaseResponse {
  constructor(private response:Response,private budget:{bytes:number}){super();}
  get ok(){return this.response.ok;} get status(){return this.response.status;}
  getHeader(name:string){return this.response.headers.get(name)??undefined;}
  async getData(){
    const length=Number(this.response.headers.get('content-length')??0);
    if(length>4000000)throw new Error('Bloc raster trop volumineux.');
    const reader=this.response.body?.getReader();if(!reader)throw new Error('Raster vide.');
    const chunks:Uint8Array[]=[];let n=0;
    while(true){const r=await reader.read();if(r.done)break;n+=r.value.length;this.budget.bytes+=r.value.length;if(n>4000000||this.budget.bytes>16000000){await reader.cancel();throw new Error('Budget de lecture raster dépassé : découpez le contour.');}chunks.push(r.value);}
    const result=new Uint8Array(n);let at=0;for(const c of chunks){result.set(c,at);at+=c.length;}return result.buffer;
  }
}
class RangeClient extends BaseClient {
  private budget={bytes:0};private requests=0;
  constructor(url:string,private fetcher:typeof fetch,private deadline:AbortSignal){super(url);if(!ALLOWED_HOSTS.has(new URL(url).hostname)||new URL(url).protocol!=='https:')throw new Error('Hôte raster non autorisé.');}
  async request(options:RequestInit={}){
    if(++this.requests>80)throw new Error('Trop de blocs raster pour ce contour.');
    const response=await this.fetcher(this.url,{...options,redirect:'error',signal:AbortSignal.any([this.deadline,...(options.signal?[options.signal]:[])])});
    if(response.status!==206){await response.body?.cancel();throw new Error(`Lecture partielle indisponible (${response.status}).`);}
    return new SafeResponse(response,this.budget);
  }
}
function transformFor(epsg:number){
  if(epsg===4326)return (p:Position)=>p;
  if(epsg===6933)proj4.defs('EPSG:6933','+proj=cea +lat_ts=30 +lon_0=0 +datum=WGS84 +units=m +no_defs');
  else if(epsg>=32601&&epsg<=32660)proj4.defs(`EPSG:${epsg}`,`+proj=utm +zone=${epsg-32600} +datum=WGS84 +units=m +no_defs`);
  else if(epsg>=32701&&epsg<=32760)proj4.defs(`EPSG:${epsg}`,`+proj=utm +zone=${epsg-32700} +south +datum=WGS84 +units=m +no_defs`);
  else throw new Error(`Projection raster non prise en charge : EPSG:${epsg}.`);
  return (p:Position)=>proj4(`EPSG:${epsg}`,'EPSG:4326',p) as Position;
}

/** Native pixels only. No overview or RGB values used for the classification. */
export async function readRasterWindow(url:string,shape:ParcelPolygon,fetcher:typeof fetch=fetch,signal=AbortSignal.timeout(50000),samples=[0]):Promise<RasterWindow>{
  const options={allowFullFile:false,maxRanges:0,blockSize:65536,cacheSize:32};
  const tiff=await fromCustomClient(new RangeClient(url,fetcher,signal),options,signal);
  try{
    const image=await tiff.getImage(0),keys=image.getGeoKeys();
    const epsg=keys?.ProjectedCSTypeGeoKey??keys?.GeographicTypeGeoKey;
    if(typeof epsg!=='number')throw new Error('Projection raster absente.');
    const toLonLat=transformFor(epsg),toNative=(p:Position)=>epsg===4326?p:proj4('EPSG:4326',`EPSG:${epsg}`,p) as Position;
    const origin=image.getOrigin(),res=image.getResolution();
    if(!res[0]||!res[1]||!Number.isFinite(res[0]+res[1]))throw new Error('Résolution raster absente.');
    const native=shape.coordinates.flat().map(toNative),xs=native.map(p=>(p[0]-origin[0])/res[0]),ys=native.map(p=>(p[1]-origin[1])/res[1]);
    const x0=Math.max(0,Math.floor(Math.min(...xs))-1),y0=Math.max(0,Math.floor(Math.min(...ys))-1),x1=Math.min(image.getWidth(),Math.ceil(Math.max(...xs))+1),y1=Math.min(image.getHeight(),Math.ceil(Math.max(...ys))+1);
    if(x1<=x0||y1<=y0)return {cells:[],resolutionM:epsg===4326?Math.abs(res[0])*111320:Math.abs(res[0]),crs:`EPSG:${epsg}`};
    if((x1-x0)*(y1-y0)>10000)throw new Error('Plus de 10 000 pixels natifs : découpez la parcelle en secteurs.');
    const values=await image.readRasters({window:[x0,y0,x1,y1],samples,interleave:true,signal});
    const noData=image.getGDALNoData(),cells:RasterCell[]=[],bounds=bbox(shape),w=x1-x0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]].map(([px,py])=>toLonLat([origin[0]+px*res[0],origin[1]+py*res[1]]));
      const b=bbox({type:'Polygon',coordinates:[corners]});if(b[2]<bounds[0]||b[0]>bounds[2]||b[3]<bounds[1]||b[1]>bounds[3])continue;
      const offset=((y-y0)*w+x-x0)*samples.length,v=Number(values[offset]);
      cells.push({id:`${x}:${y}`,geometry:{type:'Polygon',coordinates:[corners]},value:!Number.isFinite(v)||v===noData?null:v,...(samples.length>1?{bands:samples.map((_,i)=>Number(values[offset+i]))}:{})});
    }
    return {cells,resolutionM:epsg===4326?Math.abs(res[0])*111320:Math.abs(res[0]),crs:`EPSG:${epsg}`};
  }finally{await tiff.close();}
}
