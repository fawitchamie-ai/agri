import {COUNTRIES,type Country,type WeatherDay,type SoilLayer} from './types.ts';
import {scopeId,valueEvidence,type InputValue} from './provenance.ts';
import type {Position,ParcelPolygon} from './parcel.ts';
import type {LandAssessment} from './land.ts';
import {addDays,InputError,isoDate} from './validation.ts';

export type SoilEstimate = {provenance?:Record<string,InputValue>;hydraulicLayers?:SoilLayer[];ph:number|null;organicC:number|null;totalN:number|null;cec:number|null;sand:number|null;clay:number|null;source:string;depth:string;resolutionM:number;retrievedAt:string};
export type Environment = {context?:string;scope?:{id:string;geometry:ParcelPolygon|null};landAssessment?:LandAssessment;soil:SoilEstimate;weather:WeatherDay[];temperatures:{date:string;value:number;status:'forecast'|'estimated'|'scenario'}[];warnings:string[];retrievedAt:string;historicalYears:string};
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
// One bounded retry for provider throttling, transient failure or a timeout.
// Invalid units and explicit no-data stay missing instead of becoming defaults.
async function providerRead<T>(url:URL,fetcher:typeof fetch,timeout:number,parse:(response:Response)=>Promise<T>,budget?:AbortSignal):Promise<T>{
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await fetcher(url,{signal:budget?AbortSignal.any([budget,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout)});
   if(!response.ok){await response.body?.cancel();if(attempt===0&&(response.status===429||response.status>=500)){await new Promise(r=>setTimeout(r,200));continue;}throw Object.assign(new Error(`Source indisponible (HTTP ${response.status})`),{retryable:response.status===429||response.status>=500});}
   return await parse(response);
  }catch(e){if(budget?.aborted||attempt===1||(e as {retryable?:boolean}).retryable===false)throw e;await new Promise(r=>setTimeout(r,200));}
 }
 throw new Error('Source indisponible');
}
async function soilValue(property:string,depth:string,latitude:number,longitude:number,fetcher:typeof fetch,statistic='mean',budget?:AbortSignal):Promise<number|null>{
 const url=new URL('https://maps.isric.org/mapserv');
 url.search=new URLSearchParams({map:`/map/${property}.map`,SERVICE:'WCS',VERSION:'1.0.0',REQUEST:'GetCoverage',COVERAGE:`${property}_${depth}cm_${statistic}`,CRS:'EPSG:4326',BBOX:`${longitude-.0001},${latitude-.0001},${longitude+.0001},${latitude+.0001}`,WIDTH:'1',HEIGHT:'1',FORMAT:'GEOTIFF_INT16'}).toString();
 try{return await providerRead(url,fetcher,15000,async response=>readSoilPixel(await response.arrayBuffer()),budget);}catch{return null;}
}
const soilCache=new Map<string,{until:number;value:SoilEstimate}>();
export async function loadSoil(latitude:number,longitude:number,fetcher:typeof fetch=fetch,now=new Date().toISOString(),budgetMs=30000):Promise<SoilEstimate>{
 const cacheKey=JSON.stringify(['SoilGrids-2.0-WCS',latitude,longitude]),cached=fetcher===fetch?soilCache.get(cacheKey):undefined;
 if(cached&&cached.until>Date.now())return structuredClone(cached.value);
 // Keep whole reads (including bodies/retries) bounded. Forecast/history use two other connections.
 const budget=AbortSignal.timeout(budgetMs);
 let active=0;const queue:(()=>void)[]=[];
 async function limited<T>(work:()=>Promise<T>):Promise<T>{if(active>=4)await new Promise<void>(resolve=>queue.push(resolve));active++;try{return await work();}finally{active--;queue.shift()?.();}}
 const read=(property:string,depth:string,statistic='mean')=>limited(()=>budget.aborted?Promise.resolve(null):soilValue(property,depth,latitude,longitude,fetcher,statistic,budget));
 const specs=[['ph','phh2o',10,0,14],['organicC','soc',10,0,1000],['totalN','nitrogen',100,0,1000],['cec','cec',10,0,1000],['sand','sand',10,0,100],['clay','clay',10,0,100]] as const;
 const result:SoilEstimate={ph:null,organicC:null,totalN:null,cec:null,sand:null,clay:null,source:'ISRIC SoilGrids 2.0 — prédiction cartographique au point représentatif, CC BY 4.0',depth:'5–15 cm',resolutionM:250,retrievedAt:now,provenance:{}};
 const id=scopeId(null,[longitude,latitude]);
 const ev=(value:number|null,raw:number|null,unit:string,rawUnit:string,method:string,depth:[number,number])=>valueEvidence(value,unit,id,{rawValue:raw,rawUnit,method,depthCm:depth,provider:'ISRIC',product:'SoilGrids',productVersion:'2.0',acquiredAt:now,observedAt:null,status:value===null?'missing':'estimated',origin:'automatic',spatial:{point:[longitude,latitude],cell:`WCS query at ${longitude},${latitude}; native cell id not supplied`,resolutionM:250,crs:'EPSG:4326'},replacementReason:value===null?'Source inaccessible ou pixel sans donnée.':'Date de mesure du profil inconnue ; prédiction cartographique.'});
 const depths=[[0,5],[5,15],[15,30],[30,60],[60,100],[100,200]];
 const [hydraulics]=await Promise.all([
  Promise.allSettled(depths.map(async([top,bottom])=>{
   const [fc,wp]=await Promise.all([read('wv0033',`${top}-${bottom}`),read('wv1500',`${top}-${bottom}`)]);
   const idx=depths.findIndex(d=>d[0]===top);
   result.provenance![`layers.${idx}.thetaFC`]=ev(fc===null?null:fc/1000,fc,'m³/m³','10^-3 cm³/cm³','Rétention modélisée à 33 kPa',[top,bottom]);
   result.provenance![`layers.${idx}.thetaWP`]=ev(wp===null?null:wp/1000,wp,'m³/m³','10^-3 cm³/cm³','Rétention modélisée à 1500 kPa',[top,bottom]);
   result.provenance![`layers.${idx}.thicknessM`]=ev((bottom-top)/100,bottom-top,'m','cm','Bornes des horizons du produit',[top,bottom]);
   if(fc===null||wp===null||fc<=wp||fc>800||wp<0||wp>700)throw new Error('Rétention inconnue');
   result.provenance![`layers.${idx}.initialTheta`]=valueEvidence(wp/1000+.6*(fc-wp)/1000,'m³/m³',id,{origin:'default',status:'assumed',method:'WP + 0,60 × (FC − WP)',depthCm:[top,bottom],acquiredAt:now,replacementReason:'Réserve initiale supposée à 60 %, non mesurée.'});
   return {thicknessM:(bottom-top)/100,thetaFC:fc/1000,thetaWP:wp/1000,initialTheta:wp/1000+.6*(fc-wp)/1000};
  })),
  Promise.allSettled(specs.map(async([key,property,div,min,max])=>{
   const [pixel,low,high]=await Promise.all([read(property,'5-15'),read(property,'5-15','Q0.05'),read(property,'5-15','Q0.95')]);
   if(pixel!==null)result[key]=finite(pixel/div,min,max);
   const units={ph:'pH',organicC:'g/kg',totalN:'g/kg',cec:'cmol(+)/kg',sand:'%',clay:'%'};
   result.provenance![key]=ev(result[key],pixel,units[key],`encoded ${property} / ${div}`,property==='phh2o'?'pH eau, prédiction':'Prédiction cartographique moyenne',[5,15]);
   if(low!==null&&high!==null&&low<=high&&finite(low/div,min,max)!==null&&finite(high/div,min,max)!==null)result.provenance![key].uncertainty={lower:low/div,upper:high/div,level:.9,method:'Intervalle prédictif SoilGrids Q0.05–Q0.95'};
   else result.provenance![key].replacementReason+=' Incertitude non récupérée.';
  })),
 ]);
 // Do not splice missing horizons together or apply topsoil values to the subsoil.
 if(hydraulics.every(h=>h.status==='fulfilled'))result.hydraulicLayers=hydraulics.map(h=>(h as PromiseFulfilledResult<SoilLayer>).value);

 if(fetcher===fetch&&result.hydraulicLayers&&specs.every(([key])=>result[key]!==null)){if(soilCache.size>=16)soilCache.delete(soilCache.keys().next().value!);soilCache.set(cacheKey,{until:Date.now()+86400000,value:structuredClone(result)});}
 return result;
}
async function weatherJson(url:URL,fetcher:typeof fetch){
 const d=await providerRead(url,fetcher,15000,async r=>r.json()) as any,keys=['precipitation_sum','et0_fao_evapotranspiration','temperature_2m_mean'];
 const dates=d?.daily?.time;
 if(!Array.isArray(dates)||!dates.length||dates.length>1200||d.daily_units?.precipitation_sum!=='mm'||d.daily_units?.et0_fao_evapotranspiration!=='mm'||d.daily_units?.temperature_2m_mean!=='°C'||keys.some(k=>!Array.isArray(d.daily[k])||d.daily[k].length!==dates.length))throw new Error('Format ou unités météo non reconnus');
 if(dates.some(date=>typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)||new Set(dates).size!==dates.length)throw new Error('Calendrier météo invalide');
 const from=url.searchParams.get('start_date'),to=url.searchParams.get('end_date');
 if(from&&to&&dates.some(date=>date<from||date>to))throw new Error('Historique météo hors période demandée');
 return {...d.daily,_metadata:{latitude:d.latitude,longitude:d.longitude,timezone:d.timezone}};
}
async function acquireEnvironment(latitude:number,longitude:number,country:Country,start:string,days:number,fetcher:typeof fetch=fetch,now=new Date().toISOString(),soilPoint?:Position|null):Promise<Environment>{
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>85||Math.abs(longitude)>180||!Object.hasOwn(COUNTRIES,country))throw new InputError('Localisation invalide.');
 isoDate(start,'Date du semis');if(!Number.isInteger(days)||days<1||days>366)throw new InputError('Cycle invalide.');
 const year=Number(now.slice(0,4)),common={latitude:String(latitude),longitude:String(longitude),timezone:COUNTRIES[country].timezone,daily:'precipitation_sum,et0_fao_evapotranspiration,temperature_2m_mean'};
 const forecastUrl=new URL('https://api.open-meteo.com/v1/forecast');forecastUrl.search=new URLSearchParams({...common,forecast_days:'16',past_days:'92'}).toString();
 const historyUrl=new URL('https://archive-api.open-meteo.com/v1/archive');historyUrl.search=new URLSearchParams({...common,start_date:`${year-3}-01-01`,end_date:`${year-1}-12-31`}).toString();
 const [soil,forecast,history]=await Promise.allSettled([soilPoint===null?Promise.resolve({ph:null,organicC:null,totalN:null,cec:null,sand:null,clay:null,source:'Aucun point terrestre cartographié disponible',depth:'5–15 cm',resolutionM:250,retrievedAt:now} as SoilEstimate):loadSoil(soilPoint?.[1]??latitude,soilPoint?.[0]??longitude,fetcher,now),weatherJson(forecastUrl,fetcher),weatherJson(historyUrl,fetcher)]);
 const empty:SoilEstimate={ph:null,organicC:null,totalN:null,cec:null,sand:null,clay:null,source:'Sol indisponible',depth:'5–15 cm',resolutionM:250,retrievedAt:now};
 const s=soil.status==='fulfilled'?soil.value:empty,warnings:string[]=[],weather:WeatherDay[]=[],temperatures:Environment['temperatures']=[];
 if(soilPoint===null)warnings.push('Sol non interrogé : aucune partie terrestre cartographiée exploitable.');
 if(soilPoint)warnings.push('Sol estimé sur un point de la partie terrestre cartographiée ; maille de 250 m susceptible de mêler terre et eau, sans moyenne du contour.');
 if(s.ph===null)warnings.push('pH non récupéré : aucune valeur inventée.');
 if(forecast.status==='rejected')warnings.push('Prévisions météo indisponibles ; repère historique seulement si disponible.');
 if(history.status==='rejected')warnings.push('Historique météo indisponible : le cycle peut rester incomplet.');
 const recent=new Map<string,number>();if(forecast.status==='fulfilled')forecast.value.time.forEach((d:string,i:number)=>recent.set(d,i));
 // Index the historical calendar once, rather than scanning three years for every value/day.
 const calendar=new Map<string,number[]>();if(history.status==='fulfilled')history.value.time.forEach((d:string,j:number)=>{const key=d.slice(5);const indices=calendar.get(key)??[];indices.push(j);calendar.set(key,indices);});
 for(let i=0;i<days;i++){
  const date=addDays(start,i),idx=recent.get(date),f=forecast.status==='fulfilled'?forecast.value:null;
  const historicalIndices=calendar.get(date.slice(5)==='02-29'?'02-28':date.slice(5))??[];
  let rain:number|null=null,et:number|null=null,temp:number|null=null,status:'forecast'|'estimated'|'scenario'='scenario',source=`Open-Meteo / Best Match — moyenne du même jour sur ${year-3}–${year-1} ; scénario historique, pas prévision saisonnière`;
  if(idx!==undefined&&f){rain=finite(f.precipitation_sum[idx],0,2000);et=finite(f.et0_fao_evapotranspiration[idx],0,30);temp=finite(f.temperature_2m_mean[idx],-60,60);status=date<now.slice(0,10)?'estimated':'forecast';source=date<now.slice(0,10)?'Open-Meteo — historique récent de modèles, pas mesure au champ':'Open-Meteo — prévision de modèles, pas mesure au champ';}
  if((rain===null||et===null)&&history.status==='fulfilled'){
   const h=history.value,indices=historicalIndices;
   const mean=(key:string,min:number,max:number)=>{const values=indices.map(j=>finite(h[key]?.[j],min,max)).filter((x):x is number=>x!==null);return values.length===3?values.reduce((a,b)=>a+b,0)/values.length:null;};
   rain=mean('precipitation_sum',0,2000);et=mean('et0_fao_evapotranspiration',0,30);temp=mean('temperature_2m_mean',-60,60);status='scenario';source=`Open-Meteo / Best Match — moyenne du même jour sur ${year-3}–${year-1} ; scénario historique, pas prévision saisonnière`;
  }
  const meta=status!=='scenario'?f?._metadata:history.status==='fulfilled'?history.value._metadata:null;
  const props=[['rainMm',rain,'precipitation_sum','mm'],['et0Mm',et,'et0_fao_evapotranspiration','mm'],['temperatureMeanC',temp,'temperature_2m_mean','°C']] as const;
  const provenance:Record<string,InputValue>={};
  for(const [key,val,property,unit] of props)provenance[key]=valueEvidence(val,unit,scopeId(null,[longitude,latitude]),{rawValue:status==='scenario'&&history.status==='fulfilled'?historicalIndices.map(j=>history.value[property]?.[j]).filter((v:unknown)=>typeof v==='number'&&Number.isFinite(v)):val,rawUnit:unit,origin:'automatic',status:val===null?'missing':status==='scenario'?'scenario':date<now.slice(0,10)?'estimated':'forecast',provider:'Open-Meteo',product:status==='scenario'?'Historical Weather API':'Forecast API',productVersion:null,method:status==='scenario'?'Moyenne du même jour sur trois années, scénario historique':property==='et0_fao_evapotranspiration'?'ET0 FAO':'Sortie de modèle',interval:{from:date,to:date},referencePeriod:status==='scenario'?{from:`${year-3}-01-01`,to:`${year-1}-12-31`}:null,acquiredAt:now,observedAt:null,model:null,runAt:null,spatial:{point:meta&&Number.isFinite(meta.longitude)&&Number.isFinite(meta.latitude)?[meta.longitude,meta.latitude]:null,cell:meta?`returned:${meta.longitude},${meta.latitude}`:null,resolutionM:null,crs:'EPSG:4326'},replacementReason:'Best Match : modèle, run et résolution effective non exposés par cette réponse ; pas une mesure de terrain.'});
  if(rain!==null||et!==null)weather.push({date,rainMm:rain,et0Mm:et,temperatureMeanC:temp,status,source,availableAt:now,provenance});
  if(temp!==null)temperatures.push({date,value:temp,status});
 }
 return {soil:s,weather,temperatures,warnings,retrievedAt:now,historicalYears:`${year-3}–${year-1}`};
}

// Public gridded estimates only, no account identifiers. Bounded per-isolate cache.
const environmentCache=new Map<string,{until:number;value:Environment}>();
export async function loadEnvironment(latitude:number,longitude:number,country:Country,start:string,days:number,fetcher:typeof fetch=fetch,now=new Date().toISOString(),geometry?:ParcelPolygon,refresh=false,soilPoint?:Position|null):Promise<Environment>{
 const key=JSON.stringify([geometry??null,latitude,longitude,country,start,days,now.slice(0,10),soilPoint]);
 const cached=fetcher===fetch?environmentCache.get(key):undefined;
 if(!refresh&&cached&&cached.until>Date.now())return {...structuredClone(cached.value),scope:{id:scopeId(geometry,[longitude,latitude]),geometry:geometry??null},context:JSON.stringify([geometry??null,country,start,days])};
 const value=await acquireEnvironment(latitude,longitude,country,start,days,fetcher,now,soilPoint);
 if(fetcher===fetch&&value.weather.length===days&&value.soil.ph!==null&&value.soil.hydraulicLayers){
  if(environmentCache.size>=24)environmentCache.delete(environmentCache.keys().next().value!);
  environmentCache.set(key,{until:Date.now()+3600000,value});
 }
 return {...structuredClone(value),scope:{id:scopeId(geometry,[longitude,latitude]),geometry:geometry??null},context:JSON.stringify([geometry??null,country,start,days])};
}
