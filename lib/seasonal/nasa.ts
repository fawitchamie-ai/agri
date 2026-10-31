import {isoDate,InputError,addDays} from './validation.ts';
import {scopeId,valueEvidence,reconcileInputs} from './provenance.ts';
import type {SeasonalConfig,WeatherDay} from './types.ts';
export const NASA_VERSION='POWER-daily-FAO56-1';
/** FAO56 equations 6, 11, 13, 21, 23, 25, 37–40; daily G=0, grass albedo 0.23. */
export function referenceEt0(p:{date:string;latitude:number;elevationM:number;tmin:number;tmax:number;tmean:number;dewpoint:number;wind2m:number;solarMj:number;pressureKpa:number}):number|null{
 const {tmin,tmax,tmean,dewpoint,wind2m,solarMj,pressureKpa,latitude,elevationM}=p;
 if(!Object.values(p).filter(v=>typeof v==='number').every(Number.isFinite)||tmin>tmax||tmin< -60||tmax>60||tmean<tmin||tmean>tmax||dewpoint>tmax||wind2m<0||wind2m>60||solarMj<0||solarMj>60||pressureKpa<40||pressureKpa>110||Math.abs(latitude)>60||elevationM< -500||elevationM>6000)return null;
 isoDate(p.date);const j=Math.floor((Date.parse(p.date)-Date.parse(p.date.slice(0,4)+'-01-01'))/86400000)+1,phi=latitude*Math.PI/180,dr=1+.033*Math.cos(2*Math.PI*j/365),decl=.409*Math.sin(2*Math.PI*j/365-1.39),sunset=Math.acos(Math.max(-1,Math.min(1,-Math.tan(phi)*Math.tan(decl))));
 const ra=24*60/Math.PI*.0820*dr*(sunset*Math.sin(phi)*Math.sin(decl)+Math.cos(phi)*Math.cos(decl)*Math.sin(sunset)),rso=(.75+2e-5*elevationM)*ra;
 if(rso<=0)return null;const vap=(t:number)=>.6108*Math.exp(17.27*t/(t+237.3)),ea=vap(dewpoint),es=(vap(tmin)+vap(tmax))/2,delta=4098*vap(tmean)/(tmean+237.3)**2,gamma=.000665*pressureKpa;
 const longwave=4.903e-9*((tmax+273.16)**4+(tmin+273.16)**4)/2*(.34-.14*Math.sqrt(ea))*(1.35*Math.max(.3,Math.min(1,solarMj/rso))-.35),rn=.77*solarMj-longwave;
 const et=(.408*delta*rn+gamma*900/(tmean+273)*wind2m*Math.max(0,es-ea))/(delta+gamma*(1+.34*wind2m));return Number.isFinite(et)&&et<=30?Math.max(0,et):null;
}
const cache=new Map<string,{until:number;data:any;acquiredAt:string}>();
export async function loadNasaHistory(latitude:number,longitude:number,start:string,end:string,asOf:string,fetcher:typeof fetch=fetch,now=new Date().toISOString()){
 isoDate(start);isoDate(end);isoDate(asOf);const duration=(Date.parse(end)-Date.parse(start))/86400000+1;
 if(!Number.isFinite(latitude)||Math.abs(latitude)>60||!Number.isFinite(longitude)||Math.abs(longitude)>180||duration<1||duration>366||end>asOf||asOf!==now.slice(0,10))throw new InputError('NASA : période historique de 1 à 366 jours, conseil daté d’aujourd’hui et coordonnées valides requis.');
 // Shared public-cell cache. Query point is not claimed to be a measured parcel location.
 const lat=Math.round(latitude*2)/2,lon=Math.round(longitude*2)/2,key=JSON.stringify([lat,lon,start,end]),found=fetcher===fetch?cache.get(key):undefined;
 const hit=found&&found.until>Date.now()?found:undefined;let d:any=hit?.data??null;const acquiredAt=hit?.acquiredAt??now;
 if(!d){const url=new URL('https://power.larc.nasa.gov/api/temporal/daily/point');url.search=new URLSearchParams({parameters:'T2M,T2M_MIN,T2M_MAX,T2MDEW,RH2M,WS2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,PS',community:'AG',latitude:String(lat),longitude:String(lon),start:start.replaceAll('-',''),end:end.replaceAll('-',''),format:'JSON','time-standard':'UTC'}).toString();const r=await fetcher(url,{signal:AbortSignal.timeout(25000),redirect:'manual'});if(!r.ok)throw new InputError('NASA POWER indisponible (HTTP '+r.status+'). Aucune donnée remplacée.');d=await r.json();if(fetcher===fetch){if(cache.size>=24)cache.delete(cache.keys().next().value!);cache.set(key,{until:Date.now()+3600000,data:d,acquiredAt});}}
 const units:Record<string,string>={T2M:'C',T2M_MIN:'C',T2M_MAX:'C',T2MDEW:'C',RH2M:'%',WS2M:'m/s',PRECTOTCORR:'mm/day',ALLSKY_SFC_SW_DWN:'MJ/m^2/day',PS:'kPa'};
 if(d.header?.time_standard!=='UTC'||!d.properties?.parameter)throw new InputError('Contrat temporel NASA non reconnu.');
 for(const [k,unit] of Object.entries(units))if(d.parameters?.[k]?.units!==unit)throw new InputError('Unité NASA non reconnue : '+k);
 const read=(k:string,date:string,min:number,max:number)=>{const n=d.properties.parameter[k]?.[date.replaceAll('-','')];return typeof n==='number'&&Number.isFinite(n)&&n!==d.header.fill_value&&n>=min&&n<=max?n:null;};
 const weather:WeatherDay[]=[];
 for(let i=0;i<duration;i++){const date=addDays(start,i),tmean=read('T2M',date,-60,60),tmin=read('T2M_MIN',date,-60,60),tmax=read('T2M_MAX',date,-60,60),dewpoint=read('T2MDEW',date,-80,60),wind2m=read('WS2M',date,0,60),solar=read('ALLSKY_SFC_SW_DWN',date,0,60),pressure=read('PS',date,40,110),rainMm=read('PRECTOTCORR',date,0,2000),height=d.geometry?.coordinates?.[2];
  const et0Mm=[tmean,tmin,tmax,dewpoint,wind2m,solar,pressure,height].every(v=>typeof v==='number'&&Number.isFinite(v))?referenceEt0({date,latitude:lat,elevationM:height,tmin:tmin!,tmax:tmax!,tmean:tmean!,dewpoint:dewpoint!,wind2m:wind2m!,solarMj:solar!,pressureKpa:pressure!}):null;
  const evidence=(value:number|null,unit:string,method:string)=>valueEvidence(value,unit,scopeId(null,[lon,lat]),{origin:'automatic',status:value===null?'missing':'estimated',provider:'NASA POWER',product:'Daily API, '+(d.header.sources??[]).join('/'),productVersion:d.header.api?.version??null,method,acquiredAt,interval:{from:date,to:date},spatial:{point:[lon,lat],cell:`POWER query ${lon},${lat}; native cell footprint not returned`,resolutionM:null,crs:'EPSG:4326'},replacementReason:'Estimation de maille, pas mesure sur la parcelle ; requête arrondie à 0,5 degré, résolution native exacte non déduite.'});
  if(rainMm!==null||et0Mm!==null)weather.push({date,rainMm,et0Mm,temperatureMeanC:tmean,temperatureMinC:tmin,temperatureMaxC:tmax,humidityPercent:read('RH2M',date,0,100),wind2mMs:wind2m,radiationMj:solar,status:'estimated',source:'NASA POWER '+(d.header.api?.version??'')+' ; ET0 calculée FAO56, G=0 ; données historiques modélisées, pas une prévision saisonnière',availableAt:acquiredAt,provenance:{rainMm:evidence(rainMm,'mm','PRECTOTCORR en mm/jour UTC'),et0Mm:{...evidence(et0Mm,'mm','Penman-Monteith FAO56, équations 6,11,13,21,23,25,37–40 ; G=0, albédo 0,23'),rawValue:et0Mm===null?null:[tmin!,tmax!,tmean!,dewpoint!,wind2m!,solar!,pressure!,height,lat],rawUnit:'Tmin Tmax Tmean Tdew °C; u2 m/s; Rs MJ/m²/j; P kPa; z m; lat °',model:NASA_VERSION,runAt:acquiredAt},temperatureMeanC:evidence(tmean,'°C','T2M'),temperatureMinC:evidence(tmin,'°C','T2M_MIN'),temperatureMaxC:evidence(tmax,'°C','T2M_MAX'),humidityPercent:evidence(read('RH2M',date,0,100),'%','RH2M'),wind2mMs:evidence(wind2m,'m/s','WS2M, moyenne à 2 m'),radiationMj:evidence(solar,'MJ/m²/j','ALLSKY_SFC_SW_DWN')}});
 }
 return {version:NASA_VERSION,weather,requestedDays:duration,availableDays:weather.length,point:[lon,lat],limits:['Historique modélisé révisable ; aucune observation au champ déduite.','Les jours récents peuvent être indisponibles.','ET0 dérivée de données agrégées de maille ; validation locale non réalisée.']};
}
export function mergeNasa(c:SeasonalConfig,rows:WeatherDay[]):SeasonalConfig{
 const weather=new Map(c.weather.map(w=>[w.date,w])),end=addDays(c.sowingDate,c.stages.reduce((n,s)=>n+s.days,0)-1);
 for(const n of rows){if(n.date<c.sowingDate||n.date>end||n.date>c.asOfDate||n.availableAt.slice(0,10)>c.asOfDate)continue;const old=weather.get(n.date);if(!old){weather.set(n.date,n);continue;}
  const merged={...old,provenance:{...old.provenance}};for(const key of ['rainMm','et0Mm','temperatureMeanC','temperatureMinC','temperatureMaxC','humidityPercent','wind2mMs','radiationMj'] as const){const local=c.inputs?.values[`weather.${n.date}.${key}`];if(local?.origin==='manual'||local?.status==='measured'||old.status==='observed')continue;if(n[key]!=null&&(old[key]==null||old.status==='scenario')){merged[key]=n[key];if(n.provenance?.[key])merged.provenance[key]=n.provenance[key];}}
  if(old.status==='scenario'){merged.status='estimated';merged.source=n.source;merged.availableAt=n.availableAt;}weather.set(n.date,merged);
 }
 return reconcileInputs(c,{...c,weather:[...weather.values()].sort((a,b)=>a.date.localeCompare(b.date))});
}
