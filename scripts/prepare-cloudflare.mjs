import {appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const NAME = 'agriprevision-db';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Creates only the named D1 database if absent. Never deletes or migrates data. */
export async function prepareDatabase({env=process.env,fetchImpl=fetch}={}) {
  const token=env.CLOUDFLARE_API_TOKEN?.trim(), account=env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if(!token||!account||!/^[0-9a-f]{32}$/i.test(account)) throw new Error('Configurer les secrets GitHub CLOUDFLARE_API_TOKEN et CLOUDFLARE_ACCOUNT_ID.');
  const base=`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database`;
  async function request(url,method='GET',body) {
    let response;
    try {response=await fetchImpl(url,{method,redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30_000)});}
    catch {throw new Error('Connexion API Cloudflare interrompue. Vérifier le résultat dans Cloudflare avant de relancer.');}
    if(!response.ok)throw new Error(`API Cloudflare HTTP ${response.status}. Vérifier le compte et la permission D1 Edit du jeton. Aucune suppression exécutée.`);
    let data;try {data=await response.json();}catch {throw new Error('Réponse Cloudflare non JSON.');}
    if(data.success!==true)throw new Error('Cloudflare a refusé la préparation D1. Vérifier le jeton et ses permissions.');
    return data.result;
  }
  const matches=[];let complete=false;
  for(let page=1;page<=20;page++) {
    const rows=await request(`${base}?name=${NAME}&page=${page}&per_page=100`);
    if(!Array.isArray(rows))throw new Error('Liste D1 invalide. Aucune création exécutée.');
    matches.push(...rows.filter(row=>row.name===NAME));
    if(rows.length<100){complete=true;break;}
  }
  if(!complete||matches.length>1)throw new Error('Recherche D1 incomplète ou ambiguë. Aucune création exécutée.');
  const existed=matches.length===1;
  const database=existed?matches[0]:await request(base,'POST',{name:NAME,primary_location_hint:'weur'});
  if(database.name!==NAME||!UUID.test(database.uuid||''))throw new Error('Identifiant D1 inattendu. Vérifier le tableau de bord avant de relancer.');
  return {databaseId:database.uuid,status:existed?'existing':'created'};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  prepareDatabase().then(async result=>{
    console.log(`Base ${NAME} : ${result.status==='created'?'créée':'existante, conservée'}.`);
    console.log(`CLOUDFLARE_DATABASE_ID=${result.databaseId}`);
    if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`\n## Base D1 prête\n\nBase agriprevision-db : ${result.status}.\n\nVariable de dépôt à ajouter :\n\n\`CLOUDFLARE_DATABASE_ID=${result.databaseId}\`\n\nAucune migration, suppression ou publication exécutée. Cloudflare Access reste à configurer avant publication.\n`);
  }).catch(error=>{console.error(error.message);process.exitCode=1;});
}
