import {InputError,validateConfig,validateEvents} from './validation.ts';

// Exports may include the computed plan as well as the inputs. The API sends
// only config/events and enforces its separate request limit at that boundary.
export const CAMPAIGN_FILE_MAX_BYTES=32_000_000;
export function parseCampaignFile(text:string){
 if(new TextEncoder().encode(text).byteLength>CAMPAIGN_FILE_MAX_BYTES)throw new InputError('Fichier de campagne trop volumineux (32 Mo maximum).');
 let data:unknown;
 try{data=JSON.parse(text);}catch{throw new InputError('Fichier de campagne JSON illisible.');}
 if(!data||typeof data!=='object'||Array.isArray(data)||!('config' in data))throw new InputError('Ce fichier ne contient pas les paramètres d’une campagne AgriPrévision.');
 const input=data as {config:unknown;events?:unknown};
 const config=validateConfig(input.config,{allowUnparametrisedCycle:true});
 const events=validateEvents(input.events??[],config);
 // A file's old or forged plan is never adopted as a fresh calculation.
 return {config,events};
}
