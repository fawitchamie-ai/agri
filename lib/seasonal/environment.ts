import {COUNTRIES,type Country,type WeatherDay,type SoilLayer} from './types.ts';
import {addDays,InputError,isoDate} from './validation.ts';

export type SoilEstimate = {hydraulicLayers?:SoilLayer[];ph:number|null;organicC:number|null;totalN:number|null;cec:number|null;sand:number|null;clay:number|null;source:string;depth:string;resolutionM:number;retrievedAt:string};
export type Environment = {soil:SoilEstimate;weather:WeatherDay[];temperatures:{date:string;value:number;status:'forecast'|'scenario'}[];warnings:string[];retrievedAt:string;historicalYears:string};
const finite=(v:unknown,min:number,max:number):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:null;

/** Only the explicitly requested one-pixel, single-band integer TIFF (plain or Deflate, one pixel).
 * Reject other encodings, no-data and malformed offsets rather than invent a value. */
export async function readSoilPixel(buffer:ArrayBuffer):Promise<number|null> {
 if(buffer.byteLength<8||buffer.byteLength>65536)return null;
 const v=new DataView(buffer),le=v.getUint16(0)===0x4949;
 if(!le&&v.getUint16(0)!==0x4d4d||v.getUint16(2,le)!==42)return null;
 const offset=v.getUint32(4,le);if(offset+2>v.byteLength)return null;
 const n=v.getUint16(offset,le);if(n>100||offset+2+n*12>v.byteLength)return null;
 const tags=new Map<number,number>();let nodata:number|null=null;
 for(let i=0;i<n;i++) {const at=offset+2+i*12,id=v.getUint16(at,le),type=v.getUint16(at+2,le),count=v.getUint32(at+4,le);
  if(id===42113&&type===2&&count<50){const p=count<=4?at+8:v.getUint32(at+8,le);if(p+count<=v.byteLength){const s=new TextDecoder().decode(buffer.slice(p,p+count)).replace(/\0/g,'').trim();if(s!==''&&Number.isFinite(Number(s)))nodata=Number(s);}}
  if(count===1&&(type===3||type===4))tags.set(id,type===3?v.getUint16(at+8,le):v.getUint32(at+8,le));
 }
 if(tags.get(256)!==1||tags.get(257)!==1||![1,8,32946].includes(tags.get(259)??1)||(tags.get(277)??1)!==1||tags.get(258)!==16||![1,2].includes(tags.get(339)??1))return null;
 const tiled=tags.has(324);if(tiled&&((tags.get(322)??0)>256||(tags.get(323)??0)>256))return null;
 const p=tags.get(273)??tags.get(324);if(p===undefined||p+2>v.byteLength)return null;
 let pixels=v;let at=p;
 if(tags.get(259)!==undefined&&tags.get(259)!==1){const bytes=tags.get(279)??tags.get(325);if(!bytes||p+bytes>v.byteLength)return null;try{const stream=new Blob([buffer.slice(p,p+bytes)]).stream().pipeThrough(new DecompressionStream('deflate'));const reader=stream.getReader();const chunks:Uint8Array[]=[];let length=0;while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>131072){await reader.cancel();return null;}chunks.push(r.value);}const decodedBytes=new Uint8Array(length);let position=0;for(const chunk of chunks){decodedBytes.set(chunk,position);position+=chunk.length;}const decoded=decodedBytes.buffer;if(decoded.byteLength!==(tiled?(tags.get(322)??0)*(tags.get(323)??0)*2:2))return null;pixels=new DataView(decoded);at=0;}catch{return null;}}
 const raw=tags.get(339)===2?pixels.getInt16(at,le):pixels.getUint16(at,le);
 return raw===nodata||raw<0||raw===65535?null:raw;
}
async function soilValue(property:string,depth:string,latitude:number,longitude:number,fetcher:typeof fetch):Promise<number|null>{
 const url=new URL('https://maps.isric.org/mapserv');
 url.search=new URLSearchParams({map:`/map/${property}.map`,SERVICE:'WCS',VERSION:'1.0.0',REQUEST:'GetCoverage',COVERAGE:`${property}_${depth}cm_mean`,CRS:'EPSG:4326',BBOX:`${longitude-.0001},${latitude-.0001},${longitude+.0001},${latitude+.0001}`,WIDTH:'1',HEIGHT:'1',FORMAT:'GEOTIFF_INT16'}).toString();
 const response=await fetcher(url,{signal:AbortSignal.timeout(10000)});
 return response.ok?readSoilPixel(await response.arrayBuffer()):null;
}
export async function loadSoil(latitude:number,longitude:number,fetcher:typeof fetch=fetch,now=new Date().toISOString()):Promise<SoilEstimate>{
 const specs=[['ph','phh2o',10,0,14],['organicC','soc',10,0,1000],['totalN','nitrogen',100,0,1000],['cec','cec',10,0,1000],['sand','sand',10,0,100],['clay','clay',10,0,100]] as const;
 const result:SoilEstimate={ph:null,organicC:null,totalN:null,cec:null,sand:null,clay:null,source:'ISRIC SoilGrids 2.0 — prédiction cartographique au point représentatif, CC BY 4.0',depth:'5–15 cm',resolutionM:250,retrievedAt:now};
 const depths=[[0,5],[5,15],[15,30],[30,60],[60,100],[100,200]];
 const [hydraulics]=await Promise.all([
  Promise.allSettled(depths.map(async([top,bottom])=>{
   const [fc,wp]=await Promise.all([soilValue('wv0033',`${top}-${bottom}`,latitude,longitude,fetcher),soilValue('wv1500',`${top}-${bottom}`,latitude,longitude,fetcher)]);
   if(fc===null||wp===null||fc<=wp||fc>800||wp<0||wp>700)throw new Error('Rétention inconnue');
   return {thicknessM:(bottom-top)/100,thetaFC:fc/1000,thetaWP:wp/1000,initialTheta:wp/1000+.6*(fc-wp)/1000};
  })),
  Promise.allSettled(specs.map(async([key,property,div,min,max])=>{
   const pixel=await soilValue(property,'5-15',latitude,longitude,fetcher);
   if(pixel!==null)result[key]=finite(pixel/div,min,max);
  })),
 ]);
 // Do not splice missing horizons together or apply topsoil values to the subsoil.
 if(hydraulics.every(h=>h.status==='fulfilled'))result.hydraulicLayers=hydraulics.map(h=>(h as PromiseFulfilledResult<SoilLayer>).value);

 return result;
}
async function weatherJson(url:URL,fetcher:typeof fetch){const r=await fetcher(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('Météo indisponible');const d=await r.json() as any;if(!Array.isArray(d?.daily?.time)||d.daily.time.length>1200||d.daily_units?.precipitation_sum!=='mm'||d.daily_units?.et0_fao_evapotranspiration!=='mm'||d.daily_units?.temperature_2m_mean!=='°C')throw new Error('Unités météo inconnues');return d.daily;}
async function acquireEnvironment(latitude:number,longitude:number,country:Country,start:string,days:number,fetcher:typeof fetch=fetch,now=new Date().toISOString()):Promise<Environment>{
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>85||Math.abs(longitude)>180||!Object.hasOwn(COUNTRIES,country))throw new InputError('Localisation invalide.');
 isoDate(start,'Date du semis');if(!Number.isInteger(days)||days<1||days>366)throw new InputError('Cycle invalide.');
 const year=Number(now.slice(0,4)),common={latitude:String(latitude),longitude:String(longitude),timezone:COUNTRIES[country].timezone,daily:'precipitation_sum,et0_fao_evapotranspiration,temperature_2m_mean'};
 const forecastUrl=new URL('https://api.open-meteo.com/v1/forecast');forecastUrl.search=new URLSearchParams({...common,forecast_days:'16',past_days:'92'}).toString();
 const historyUrl=new URL('https://archive-api.open-meteo.com/v1/archive');historyUrl.search=new URLSearchParams({...common,start_date:`${year-3}-01-01`,end_date:`${year-1}-12-31`}).toString();
 const [soil,forecast,history]=await Promise.allSettled([loadSoil(latitude,longitude,fetcher,now),weatherJson(forecastUrl,fetcher),weatherJson(historyUrl,fetcher)]);
 const empty:SoilEstimate={ph:null,organicC:null,totalN:null,cec:null,sand:null,clay:null,source:'Sol indisponible',depth:'5–15 cm',resolutionM:250,retrievedAt:now};
 const s=soil.status==='fulfilled'?soil.value:empty,warnings:string[]=[],weather:WeatherDay[]=[],temperatures:Environment['temperatures']=[];
 if(s.ph===null)warnings.push('pH non récupéré : aucune valeur inventée.');
 if(forecast.status==='rejected')warnings.push('Prévisions météo indisponibles ; repère historique seulement si disponible.');
 if(history.status==='rejected')warnings.push('Historique météo indisponible : le cycle peut rester incomplet.');
 const recent=new Map<string,number>();if(forecast.status==='fulfilled')forecast.value.time.forEach((d:string,i:number)=>recent.set(d,i));
 for(let i=0;i<days;i++){
  const date=addDays(start,i),idx=recent.get(date),f=forecast.status==='fulfilled'?forecast.value:null;
  let rain:number|null=null,et:number|null=null,temp:number|null=null,status:'forecast'|'scenario'='scenario',source=`Open-Meteo / ERA5 — moyenne du même jour sur ${year-3}–${year-1} ; scénario historique, pas prévision saisonnière`;
  if(idx!==undefined&&f){rain=finite(f.precipitation_sum[idx],0,2000);et=finite(f.et0_fao_evapotranspiration[idx],0,30);temp=finite(f.temperature_2m_mean[idx],-60,60);status='forecast';source=date<now.slice(0,10)?'Open-Meteo — historique récent de modèles, pas mesure au champ':'Open-Meteo — prévision de modèles, pas mesure au champ';}
  if((rain===null||et===null)&&history.status==='fulfilled'){
   const h=history.value,indices:number[]=[];h.time.forEach((d:string,j:number)=>{if(d.slice(5)===(date.slice(5)==='02-29'?'02-28':date.slice(5)))indices.push(j);});
   const mean=(key:string,min:number,max:number)=>{const values=indices.map(j=>finite(h[key]?.[j],min,max)).filter((x):x is number=>x!==null);return values.length===3?values.reduce((a,b)=>a+b,0)/values.length:null;};
   rain=mean('precipitation_sum',0,2000);et=mean('et0_fao_evapotranspiration',0,30);temp=mean('temperature_2m_mean',-60,60);status='scenario';source=`Open-Meteo / ERA5 — moyenne du même jour sur ${year-3}–${year-1} ; scénario historique, pas prévision saisonnière`;
  }
  if(rain!==null||et!==null)weather.push({date,rainMm:rain,et0Mm:et,temperatureMeanC:temp,status,source,availableAt:now});
  if(temp!==null)temperatures.push({date,value:temp,status});
 }
 return {soil:s,weather,temperatures,warnings,retrievedAt:now,historicalYears:`${year-3}–${year-1}`};
}

// Public gridded estimates only, no account identifiers. Bounded per-isolate cache.
const environmentCache=new Map<string,{until:number;value:Environment}>();
export async function loadEnvironment(latitude:number,longitude:number,country:Country,start:string,days:number,fetcher:typeof fetch=fetch,now=new Date().toISOString()):Promise<Environment>{
 const key=JSON.stringify([latitude,longitude,country,start,days,now.slice(0,10)]);
 const cached=fetcher===fetch?environmentCache.get(key):undefined;
 if(cached&&cached.until>Date.now())return structuredClone(cached.value);
 const value=await acquireEnvironment(latitude,longitude,country,start,days,fetcher,now);
 if(fetcher===fetch&&value.weather.length===days&&value.soil.ph!==null&&value.soil.hydraulicLayers){
  if(environmentCache.size>=24)environmentCache.delete(environmentCache.keys().next().value!);
  environmentCache.set(key,{until:Date.now()+3600000,value});
 }
 return structuredClone(value);
}
