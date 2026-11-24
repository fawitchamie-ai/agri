import type {ParcelPolygon} from './parcel.ts';
import {geometryIdentity} from './provenance.ts';
import type {readSatelliteVisual} from './satellite-visual.ts';

export type NativeSatelliteLayer='rgb'|'classification'|'ndvi'|'contrast';
export type NativeSatelliteImageData=Awaited<ReturnType<typeof readSatelliteVisual>>;
export type NativeSatelliteImageRequest={layer:NativeSatelliteLayer;date:string;bounds:number[];geometry:ParcelPolygon;itemId?:string};

const MAX_IMAGES=4;
const MAX_CACHED_PIXELS=40_000;
const cache=new Map<string,NativeSatelliteImageData>();
let cachedPixels=0;

/** NDVI pixels are computed from the whole field, so zoom does not change the raster. */
export function nativeSatelliteImageCacheKey(request:NativeSatelliteImageRequest){
 const fieldLayer=request.layer==='ndvi'||request.layer==='contrast';
 return JSON.stringify([request.layer,request.date,request.itemId??'',geometryIdentity(request.geometry),fieldLayer?'field':request.bounds.join(',')]);
}

export function getCachedNativeSatelliteImage(request:NativeSatelliteImageRequest){
 const key=nativeSatelliteImageCacheKey(request),image=cache.get(key);
 if(!image)return undefined;
 cache.delete(key);cache.set(key,image);
 return image;
}

export function hasCachedNativeSatelliteImage(request:NativeSatelliteImageRequest){
 return cache.has(nativeSatelliteImageCacheKey(request));
}

/** Keep only successful, non-empty reads in a small, pixel-bounded LRU cache. */
export function cacheNativeSatelliteImage(request:NativeSatelliteImageRequest,image:NativeSatelliteImageData){
 const pixelCount=image.pixels.length;
 if(!pixelCount||pixelCount>MAX_CACHED_PIXELS)return false;
 const key=nativeSatelliteImageCacheKey(request),previous=cache.get(key);
 if(previous){cachedPixels-=previous.pixels.length;cache.delete(key);}
 while(cache.size>=MAX_IMAGES||cachedPixels+pixelCount>MAX_CACHED_PIXELS){
  const oldest=cache.keys().next().value as string|undefined;
  if(!oldest)break;
  const removed=cache.get(oldest);if(removed)cachedPixels-=removed.pixels.length;
  cache.delete(oldest);
 }
 cache.set(key,image);cachedPixels+=pixelCount;
 return true;
}
