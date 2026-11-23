import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Window} from 'happy-dom';
import React,{act} from 'react';

const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
const bundle=await build({entryPoints:['components/agri/welcome.tsx'],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',packages:'external',loader:{'.css':'empty'},plugins:[{name:'stub-map',setup(builder){builder.onLoad({filter:/field-overview-map\.tsx$/},()=>({contents:'export default function FieldOverviewMap(){return <div aria-label="Carte de démonstration"/>}',loader:'tsx'}));}}]});
const compiled={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);

test('un visiteur public peut se connecter par e-mail ou lancer une démonstration',async()=>{
 const window=new Window({url:'https://agri.test'}),previous=new Map();
 for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 const {createRoot}=await import('react-dom/client'),host=window.document.createElement('div');window.document.body.append(host);const root=createRoot(host);let opened=0;
 try{
  await act(async()=>root.render(React.createElement(compiled.exports.default,{
   campaigns:[],selectedCampaignId:'',onSelectCampaign:()=>{},campaignsLoaded:false,
   campaignsError:'Connectez-vous avec Cloudflare Access ou ouvrez un espace de démonstration.',
   onRetry:()=>{},onOpenDemo:()=>{opened++},onStart:()=>{},onCampaigns:()=>{},onReferences:()=>{},onOpenCampaign:()=>{},
  })));
  assert.match(host.textContent,/La première connexion autorisée crée votre compte et un espace isolé/);
  const login=host.querySelector('a[href="/api/auth/login?returnTo=%2F"]');
  assert.ok(login,'le lien de connexion par e-mail est visible');
  const open=[...host.querySelectorAll('button')].find(button=>button.textContent.includes('Explorer la démonstration'));
  assert.ok(open,'le bouton de démonstration est visible dans l’état sans compte');
  await act(async()=>open.click());assert.equal(opened,1);
 }finally{
  await act(async()=>root.unmount());await window.happyDOM.close();
  for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
 }
});
