import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function buildConfig(input,root=process.cwd()){
 const required=name=>{const value=(input[name]||'').trim();if(!value)throw new Error(`Configuration manquante : ${name}`);return value;};
 const id=required('CLOUDFLARE_DATABASE_ID');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||id==='00000000-0000-4000-8000-000000000000')throw new Error('CLOUDFLARE_DATABASE_ID doit être le véritable UUID de votre base D1.');
 const issuer=required('CF_ACCESS_TEAM_DOMAIN').replace(/\/$/,'');const u=new URL(issuer);if(u.protocol!=='https:'||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(issuer)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('CF_ACCESS_TEAM_DOMAIN attendu : https://votre-equipe.cloudflareaccess.com');
 const aud=required('CF_ACCESS_AUD');if(!/^[a-f0-9]{64}$/i.test(aud))throw new Error('CF_ACCESS_AUD attendu : Application Audience Tag Access (64 caractères hexadécimaux).');
 const adminEmails=(input.ADMIN_EMAILS||'').trim();if(adminEmails&&adminEmails.split(',').some(e=>!/^\S+@\S+\.\S+$/.test(e.trim())))throw new Error('ADMIN_EMAILS doit contenir une liste d’adresses séparées par des virgules.');
 const c=JSON.parse(readFileSync(resolve(root,'wrangler.jsonc'),'utf8'));c.main=resolve(root,c.main);c.d1_databases[0].database_id=id;c.d1_databases[0].migrations_dir=resolve(root,'drizzle');c.vars={...c.vars,CF_ACCESS_TEAM_DOMAIN:issuer,CF_ACCESS_AUD:aud,AUTH_DEMO_ONLY:'false',ADMIN_EMAILS:adminEmails};return c;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 try{const config=buildConfig(process.env);mkdirSync('.cloudflare',{recursive:true});writeFileSync('.cloudflare/wrangler.json',JSON.stringify(config,null,2)+'\n',{mode:0o600});console.log('Configuration Cloudflare validée et générée. Aucun secret enregistré.');}catch(e){console.error(e.message);process.exitCode=1;}
}
