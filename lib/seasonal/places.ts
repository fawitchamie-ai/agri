import { InputError } from './validation.ts';
import gazetteer from './africa-places.json' with {type:'json'};
export type Place={name:string;region:string;country:string;latitude:number;longitude:number};
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const local=(gazetteer as [string,string,string,number,number,number][]).map(([name,ascii,country,latitude,longitude,population])=>({name,country,latitude,longitude,population,keys:[normalize(name),normalize(ascii)]}));
/** Explicit submitted search. 4,051 African cities searched locally first;
 * a bounded external request complements places absent from that gazetteer. */
export async function searchPlaces(query:unknown,fetcher:typeof fetch=fetch):Promise<Place[]>{
 if(typeof query!=='string'||query.trim().length<3||query.length>120)throw new InputError('Saisissez au moins 3 caractères pour chercher un lieu.');
 const q=normalize(query);if(q.length<2)throw new InputError('Précisez le nom du lieu.');
 const matches=local.filter(p=>p.keys.some(k=>k.includes(q))).sort((a,b)=>{
  const rank=(p:typeof a)=>p.keys.some(k=>k===q)?0:p.keys.some(k=>k.startsWith(q))?1:2;
  return rank(a)-rank(b)||b.population-a.population;
 });
 if(matches.length)return matches.slice(0,6).map(({name,country,latitude,longitude})=>({name,country,latitude,longitude,region:''}));
 const url=new URL('https://geocoding-api.open-meteo.com/v1/search');url.search=new URLSearchParams({name:query.trim(),count:'6',language:'fr',format:'json'}).toString();
 try{
  const r=await fetcher(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error();
  const data=await r.json() as {results?:Record<string,unknown>[]};
  if(!Array.isArray(data.results))return [];
  return data.results.slice(0,6).filter(p=>typeof p.latitude==='number'&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=85&&typeof p.longitude==='number'&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180).map(p=>({name:String(p.name??'Lieu').slice(0,120),region:String(p.admin1??'').slice(0,120),country:String(p.country??'').slice(0,120),latitude:p.latitude as number,longitude:p.longitude as number}));
 }catch{throw new InputError('Ce lieu n’est pas dans le répertoire local et la recherche complémentaire est indisponible. Essayez une ville voisine, ou placez vos points GPS.');}
}
