import {BaseClient,BaseResponse,BaseDecoder,addDecoder,fromCustomClient} from 'geotiff';
import {decompress} from 'fzstd';
import proj4 from 'proj4';
import {bbox,type RasterCell} from './land.ts';
import type {ParcelPolygon,Position} from './parcel.ts';

const ALLOWED_HOSTS=new Set(['esa-worldcover.s3.eu-central-1.amazonaws.com','s3.waw4-1.cloudferro.com','deafrica-services.s3.af-south-1.amazonaws.com']);
// Bound total geometry work separately from each decoder window.
export const MAX_NATIVE_PIXELS=16000000;
const WINDOW_SIDE=100;
export function rasterWindows(x0:number,y0:number,x1:number,y1:number):[number,number,number,number][]{
  if((x1-x0)*(y1-y0)>MAX_NATIVE_PIXELS)throw new Error('Contour trop étendu pour une analyse native complète (16 millions de pixels) : découpez-le en secteurs.');
  const windows:[number,number,number,number][]=[];
  for(let y=y0;y<y1;y+=WINDOW_SIDE)for(let x=x0;x<x1;x+=WINDOW_SIDE)windows.push([x,y,Math.min(x+WINDOW_SIDE,x1),Math.min(y+WINDOW_SIDE,y1)]);
  return windows;
}
export type RasterWindow={cells:RasterCell[];resolutionM:number;crs:string};
// JRC seasonality uses Zstandard. The default GeoTIFF decoder compiles Wasm
// bytes at runtime, which Workers forbids. Keep GeoTIFF's predictor handling
// while replacing only the block decompressor with a pure JavaScript decoder.
class JavaScriptZstdDecoder extends BaseDecoder {
  decodeBlock(buffer:ArrayBufferLike):ArrayBuffer{
    const p=this.parameters,bits=typeof p.bitsPerSample==='number'?[p.bitsPerSample]:Array.from(p.bitsPerSample);
    const expected=p.tileWidth*p.tileHeight*bits.reduce((n,b)=>n+b,0)/8;
    if(!Number.isFinite(expected)||expected<=0||expected>16000000)throw new Error('Bloc Zstandard décompressé trop volumineux.');
    const decoded=decompress(new Uint8Array(buffer));
    if(decoded.byteLength>16000000)throw new Error('Bloc Zstandard décompressé trop volumineux.');
    return new Uint8Array(decoded).buffer;
  }
}
addDecoder(50000,async()=>JavaScriptZstdDecoder,undefined,false);
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
    if(++this.requests>256)throw new Error('Trop de blocs raster pour ce contour.');
    // Workers rejects redirect:'error' before sending the request. Manual mode
    // preserves the host allowlist: a redirect is rejected by the 206 check.
    // Call the native function without the RangeClient as its receiver.
    // Workers' fetch rejects that receiver with Illegal invocation; Node accepts it.
    const fetcher=this.fetcher;
    const response=await fetcher(this.url,{...options,redirect:'manual',signal:AbortSignal.any([this.deadline,...(options.signal?[options.signal]:[])])});
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
export async function readRasterWindow(url:string,shape:ParcelPolygon,fetcher:typeof fetch=fetch,signal=AbortSignal.timeout(50000),samples=[0],compact=false):Promise<RasterWindow>{
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
    const windows=rasterWindows(x0,y0,x1,y1);
    const noData=image.getGDALNoData(),cells:RasterCell[]=[],bounds=bbox(shape);
    // Sequential bounded windows preserve every native pixel, without resampling
    // or concurrent decoder allocations on the Worker.
    for(const window of windows){
      const [left,top,right,bottom]=window,w=right-left;
      const values=await image.readRasters({window,samples,interleave:true,signal});
      if(compact){
        // Exact native-grid rectangles: merge equal adjacent pixels, never
        // interpolate or turn an overview/RGB sample into a land class.
        type Run={left:number;right:number;top:number;bottom:number;raw:number[]};
        const runs:Run[]=[],last=new Map<string,Run>();
        for(let y=top;y<bottom;y++){
          let x=left;
          while(x<right){
            const start=x,offset=((y-top)*w+x-left)*samples.length;
            const raw=samples.map((_,i)=>Number(values[offset+i]));x++;
            while(x<right&&raw.every((v,i)=>Object.is(v,Number(values[((y-top)*w+x-left)*samples.length+i]))))x++;
            const key=JSON.stringify([start,x,raw]),previous=last.get(key);
            if(previous?.bottom===y)previous.bottom=y+1;
            else {const run={left:start,right:x,top:y,bottom:y+1,raw};runs.push(run);last.set(key,run);}
            if(runs.length+cells.length>24000)throw new Error('Occupation du sol trop fragmentée pour une analyse synchrone complète : découpez le contour.');
          }
        }
        for(const r of runs){
          const corners=[[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom],[r.left,r.top]].map(([px,py])=>toLonLat([origin[0]+px*res[0],origin[1]+py*res[1]]));
          const b=bbox({type:'Polygon',coordinates:[corners]});if(b[2]<bounds[0]||b[0]>bounds[2]||b[3]<bounds[1]||b[1]>bounds[3])continue;
          cells.push({id:`${r.left}:${r.top}:${r.right}:${r.bottom}`,geometry:{type:'Polygon',coordinates:[corners]},value:!Number.isFinite(r.raw[0])||r.raw[0]===noData?null:r.raw[0],...(samples.length>1?{bands:r.raw}:{})});
        }
        continue;
      }
      for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
        const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]].map(([px,py])=>toLonLat([origin[0]+px*res[0],origin[1]+py*res[1]]));
        const b=bbox({type:'Polygon',coordinates:[corners]});if(b[2]<bounds[0]||b[0]>bounds[2]||b[3]<bounds[1]||b[1]>bounds[3])continue;
        const offset=((y-top)*w+x-left)*samples.length,v=Number(values[offset]);
        cells.push({id:`${x}:${y}`,geometry:{type:'Polygon',coordinates:[corners]},value:!Number.isFinite(v)||v===noData?null:v,...(samples.length>1?{bands:samples.map((_,i)=>Number(values[offset+i]))}:{})});
      }
    }
    return {cells,resolutionM:epsg===4326?Math.abs(res[0])*111320:Math.abs(res[0]),crs:`EPSG:${epsg}`};
  }finally{await tiff.close();}
}
