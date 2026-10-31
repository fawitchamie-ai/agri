// Server-only, backward-compatible storage of large immutable campaign snapshots.
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {Buffer} from 'node:buffer';
import {InputError} from './validation.ts';
const FORMAT='agri-deflate-json-1';
export function encodeCampaignValue(value:unknown):string{
 const plain=JSON.stringify(value);
 if(Buffer.byteLength(plain)<100000)return plain;
 return JSON.stringify({encoding:FORMAT,data:deflateRawSync(plain).toString('base64')});
}
export function decodeCampaignValue(text:string):any{
 const value=JSON.parse(text);
 if(value?.encoding!==FORMAT)return value;
 if(typeof value.data!=='string'||value.data.length>2000000)throw new Error('Archive de campagne invalide.');
 return JSON.parse(inflateRawSync(Buffer.from(value.data,'base64'),{maxOutputLength:16000000}).toString('utf8'));
}
export function encodeCampaignSnapshot(config:unknown,events:unknown,plan:unknown){
 const packed={config:encodeCampaignValue(config),events:encodeCampaignValue(events),plan:encodeCampaignValue(plan)};
 // D1 limits a complete table row to 2 MB; leave room for keys, dates and reason.
 if(Object.values(packed).reduce((n,v)=>n+Buffer.byteLength(v),0)>1800000)throw new InputError('Campagne trop volumineuse pour une révision : réduisez les données hors cycle ou séparez les secteurs. Aucune sauvegarde partielle effectuée.');
 return packed;
}
