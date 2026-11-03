import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// Render the public, identity-free loading shell once, using the actual built
// application. Only the child LOCAL runtime overrides Access; production config
// and API authentication remain untouched. No database or personal data fetched.
const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const state=await mkdtemp(join(tmpdir(),'agri-shell-'));
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--ip','127.0.0.1','--port',String(port),'--inspector-port','0','--persist-to',state,'--var','AUTH_DEMO_ONLY:true'],{stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
let output='';child.stdout.on('data',b=>{output=(output+b).slice(-6000);});child.stderr.on('data',b=>{output=(output+b).slice(-6000);});
try{
 let html;
 for(let i=0;i<120;i++){
  if(child.exitCode!==null)throw new Error('Local renderer stopped: '+output);
  try{const r=await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(2000)});if(r.ok){html=await r.text();break;}}catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 if(!html||!html.includes('Chargement des données agricoles')||!html.includes('<script')||!html.includes('</html>'))throw new Error('Incomplete loading shell: '+output);
 if(html.includes('cf-access-jwt-assertion'))throw new Error('Unexpected authentication data in shell');
 await mkdir('dist/client/_shell',{recursive:true});await writeFile('dist/client/_shell/index.html',html);
 console.log(`Accueil précompilé : ${Buffer.byteLength(html)} octets ; rendu React retiré des GET /.`);
}finally{child.kill('SIGTERM');await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);setTimeout(()=>{child.kill('SIGKILL');r();},3000).unref();});await rm(state,{recursive:true,force:true});}
