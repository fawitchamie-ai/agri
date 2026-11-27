import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const connectionSource=readFileSync(new URL('../public/field-workspace/js/connexion.js',import.meta.url),'utf8');
const workspaceHtml=readFileSync(new URL('../public/field-workspace/index.html',import.meta.url),'utf8');
const workspaceCampaigns=readFileSync(new URL('../public/field-workspace/js/worker-campagnes.js',import.meta.url),'utf8');
const workspaceMap=readFileSync(new URL('../public/field-workspace/js/worker-edition.js',import.meta.url),'utf8');
const workspaceViews=readFileSync(new URL('../public/field-workspace/js/champs.js',import.meta.url),'utf8');
const workspaceMapSource=readFileSync(new URL('../public/field-workspace/js/carte.js',import.meta.url),'utf8');
const startupSource=readFileSync(new URL('../public/field-workspace/js/demarrage.js',import.meta.url),'utf8');
const returnBootstrap=startupSource.split('\nelement("worker-login-close")')[0];
const geometryStart=workspaceMap.indexOf('function workerEditorGeometry(form) {');
const geometryEnd=workspaceMap.indexOf('\nfunction workerGeometryPoint',geometryStart);
const geometryValidator=workspaceMap.slice(geometryStart,geometryEnd)+'\nglobalThis.__validateGeometry=workerEditorGeometry;';

function geometryValidatorInVm(){
  const context={globalThis:null};context.globalThis=context;
  vm.runInNewContext(geometryValidator,context);
  return context.__validateGeometry;
}

function client(fetchImpl,pathname='/field-workspace/',search='?view=zones',hash='#campaign'){
  const failures=[];
  const storage=new Map();
  const location={pathname,search,hash,assign(){}};
  const window={agriActiveWorkspace:null,agriHandleSessionFailure:error=>failures.push(error),sessionStorage:{
    getItem:key=>storage.get(key)??null,
    setItem:(key,value)=>storage.set(key,String(value)),
    removeItem:key=>storage.delete(key)
  }};
  const context={window,location,URLSearchParams,URL,Response,fetch:fetchImpl,globalThis:null};
  context.globalThis=context;
  vm.runInNewContext(connectionSource+'\nglobalThis.__workerInvoke=workerInvoke;globalThis.__safeReturn=workerSafeReturnPath;',context);
  return {context,failures,storage};
}

test('le client web vérifie la session protégée avec cookie same-origin et en-tête Access AJAX',async()=>{
  let request;
  const {context}=client(async(url,options)=>{
    request={url,options};
    return Response.json({session:{userId:'person-1',coopId:'coop-1',demo:false}});
  });
  const result=await context.__workerInvoke('worker_session');
  assert.equal(result.status,200);
  assert.equal(request.url,'/api/session');
  assert.equal(request.options.credentials,'same-origin');
  assert.equal(request.options.redirect,'manual');
  assert.equal(request.options.headers['X-Requested-With'],'XMLHttpRequest');
  assert.match(request.options.headers.Accept,/application\/json/);
  assert.equal(request.options.headers.Authorization,undefined,'aucun JWT n’est copié dans JavaScript');
});

test('401, 403, 503, redirection Access et panne réseau gardent des états distincts et effacent le contexte',async()=>{
  for(const [status,code] of [[401,'SESSION_EXPIRED'],[403,'FORBIDDEN'],[503,'SERVICE_UNAVAILABLE']]){
    const {context,failures}=client(async()=>Response.json({error:'réponse Worker'}, {status}));
    const response=await context.__workerInvoke('worker_session');
    assert.equal(response.data.code,code);
    assert.equal(failures.at(-1)?.code,code);
    if(status===401)assert.match(response.data.error,/Session Cloudflare Access absente ou expirée/);
    if(status===403)assert.match(response.data.error,/Accès interdit/);
    if(status===503)assert.match(response.data.error,/configuration d’accès indisponible/);
  }
  const redirected=client(async()=>new Response(null,{status:302,headers:{Location:'/cdn-cgi/access/login'}}));
  assert.equal((await redirected.context.__workerInvoke('worker_session')).data.code,'ACCESS_REDIRECT');
  assert.equal(redirected.failures.at(-1)?.code,'ACCESS_REDIRECT');
  const offline=client(async()=>{throw new TypeError('network down');});
  await assert.rejects(offline.context.__workerInvoke('worker_session'),error=>error.code==='NETWORK');
  assert.equal(offline.failures.at(-1)?.code,'NETWORK');
});

test('après une vérification anonyme, le badge revient à Connexion requise',()=>{
  const start=workspaceCampaigns.indexOf('async function refreshWorkerFields(');
  const end=workspaceCampaigns.indexOf('\nasync function openWorkerCampaign',start);
  const refreshSource=workspaceCampaigns.slice(start,end);
  const finallyBlock=refreshSource.match(/finally\s*\{\s*workerBusyState\(false\);([\s\S]*?)\n\s*\}/)?.[1]||'';
  assert.match(finallyBlock,/renderWorkerIdentity\(workerSession\)/);
  assert.doesNotMatch(finallyBlock,/if\s*\(workerSession\)/);
});

test('le retour Access garde l’écran et la campagne, restaure uniquement ce contexte local, puis reste sur le site',()=>{
  const {context,storage}=client(async()=>Response.json({}));
  context.window.agriReturnContext={view:'zones',campaignId:'campaign_42'};
  assert.equal(context.__safeReturn(),'/field-workspace/?view=zones#campaign');
  assert.deepEqual(JSON.parse(storage.get('agriprevision.return-context')),{view:'zones',campaignId:'campaign_42'});
  const restoredWindow={sessionStorage:context.window.sessionStorage};
  const restored={window:restoredWindow};
  vm.runInNewContext(returnBootstrap,restored);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.window.agriPendingReturnContext)),{view:'zones',campaignId:'campaign_42'});
  assert.equal(storage.has('agriprevision.return-context'),false);
  context.window.agriReturnContext={view:'zones',campaignId:'https://attacker.test/'};
  context.__safeReturn();
  assert.deepEqual(JSON.parse(storage.get('agriprevision.return-context')),{view:'zones'});
  context.location.pathname='https://attacker.test/';
  context.location.search='?steal=1';
  context.location.hash='#external';
  assert.equal(context.__safeReturn(),'/field-workspace/?steal=1#external');
  assert.equal(new URL(context.__safeReturn(),'https://agri.test').origin,'https://agri.test');
});

test('l’espace vide connecté utilise la carte réelle et ne préremplit aucune campagne de démonstration',()=>{
  assert.match(workspaceHtml,/map-empty-picker-slot/);
  assert.match(workspaceHtml,/worker-place-remove/);
  assert.match(workspaceHtml,/<dialog class="decision-dialog worker-editor" id="worker-editor"/);
  assert.doesNotMatch(workspaceHtml,/campaign-wizard|campaign-stepper|data-wizard-panel/);
  assert.match(workspaceHtml,/name="country" required><option value="">Choisir un pays/);
  assert.match(workspaceHtml,/name="crop" required><option value="">/);
  assert.doesNotMatch(workspaceHtml,/Parcelle de démonstration|Localité fictive|Contour GeoJSON \(Polygon\)/);
  assert.match(workspaceCampaigns,/Compte connecté · aucune campagne enregistrée/);
  assert.match(workspaceCampaigns,/function clearRemoteContext/);
  assert.match(workspaceCampaigns,/workerSessionReady = false/);
  assert.match(workspaceMap,/brouillon local non envoyé/);
  assert.match(workspaceMap,/Esri World Imagery/);
  assert.match(workspaceMap,/worker-place-remove/);
  assert.match(workspaceViews,/Aucune campagne enregistrée/);
  assert.match(workspaceViews,/mountWorkerEmptyPicker/);
  assert.match(workspaceMapSource,/const fields = \[\];/);
  assert.doesNotMatch(workspaceMapSource,/Parcelle de démonstration|Localité fictive|NDVI\s*=\s*0\.[0-9]/);
  assert.match(workspaceMap,/sessionStorage\.setItem\(workerParcelDraftStorageKey/);
  assert.match(workspaceMap,/window\.agriBeforeAccessLogin=saveWorkerParcelDraft/);
  assert.match(workspaceMap,/window\.agriClearSensitiveUi=clearWorkerSensitiveUi/);
  assert.match(workspaceCampaigns,/agriClearSensitiveUi\?\.\(\{preserveParcelDraft:true\}\)/);
  assert.match(workspaceCampaigns,/agriClearSensitiveUi\?\.\(\{discardDrafts:true\}\)/);
  assert.match(workspaceMap,/element\("worker-editor"\)\.showModal\(\)/);
  assert.match(workspaceMap,/Relancez l’analyse réelle du contour, du sol et de la météo/);
  assert.doesNotMatch(workspaceMap,/workerEditorStep|campaign-stepper|data-wizard-panel/);
});

test('une campagne n’envoie au Worker que les paramètres et données analysés pour ce contour',async()=>{
  const start=workspaceMap.indexOf('async function newWorkerConfig(form) {');
  const end=workspaceMap.indexOf('\nfunction openWorkerEditor',start);
  const source=workspaceMap.slice(start,end)+'\nglobalThis.__createConfig=newWorkerConfig;';
  const geometry={type:'Polygon',coordinates:[[[1,8],[1.01,8],[1.01,8.01],[1,8.01],[1,8]]]};
  let posted;
  const context={workerSoilSample:{geometryText:JSON.stringify(geometry),country:'TGO',crop:'maize',sowingDate:'2026-11-01',
      weather:[{date:'2026-11-01',status:'observed',rainMm:0,et0Mm:1}],source:'ISRIC SoilGrids',layers:[{thicknessM:.3,thetaFC:.2,thetaWP:.1}]},
    workerEditorGeometry:()=>geometry,workerPost:async body=>{posted=body;return {config:body.config};},globalThis:null};context.globalThis=context;
  vm.runInNewContext(source,context);
  const form={elements:{country:{value:'TGO'},crop:{value:'maize'},sowingDate:{value:'2026-11-01'},name:{value:'Champ réel'},
    territory:{value:'Lomé'},variety:{value:''},outlineConsent:{checked:true}}};
  const config=await context.__createConfig(form);
  assert.equal(config.country,'TGO');
  assert.equal(config.parcelGeometry.type,'Polygon');
  assert.equal(config.weather[0].status,'observed');
  assert.equal(posted.action,'campaign-draft');
  assert.equal(posted.cropId,'maize');
  form.elements.country.value='GHA';
  await assert.rejects(context.__createConfig(form),/ne correspondent plus aux paramètres actuels/);
});

test('à la perte de session les formulaires et dialogues sont vidés, le brouillon neuf reste local',()=>{
  const start=workspaceMap.indexOf('function clearWorkerSensitiveUi(');
  const end=workspaceMap.indexOf('\nwindow.agriClearSensitiveUi=',start);
  const functionSource=workspaceMap.slice(start,end)+'\nglobalThis.__clear=clearWorkerSensitiveUi;';
  const dialogs=new Map(['worker-editor','note-dialog','worker-event-dialog','decision-preview','decision-history-dialog'].map(id=>[id,{open:true,closed:false,close(){this.closed=true;}}]));
  const forms=new Map(['worker-editor-form','note-form','worker-event-form','decision-form'].map(id=>[id,{resetCount:0,reset(){this.resetCount++;}}]));
  const elements=new Map([
    ...dialogs,
    ...forms,
    ['decision-body',{cleared:false,replaceChildren(){this.cleared=true;}}],
    ['decision-error',{textContent:'previous error'}],
    ['decision-preview-list',{cleared:false,replaceChildren(){this.cleared=true;}}],
    ['decision-preview-field',{textContent:'previous field'}],
    ['decision-history-items',{cleared:false,replaceChildren(){this.cleared=true;}}],
    ['note-body',{textContent:'private note',hidden:false}]
  ]);
  let saved=0,discarded=0;
  const context={window:{},state:{noteId:7},editedWorkerField:null,workerPlaceDraftRestorePending:false,
    saveWorkerParcelDraft(){saved++;},clearWorkerLocalParcelDrafts(){discarded++;},
    element:id=>elements.get(id),putText:(id,text)=>{elements.get(id).textContent=text;},globalThis:null};
  context.globalThis=context;
  vm.runInNewContext(functionSource,context);
  context.__clear({preserveParcelDraft:true});
  assert.equal(saved,1);
  assert.equal(context.workerPlaceDraftRestorePending,true);
  assert.ok([...dialogs.values()].every(dialog=>dialog.closed));
  assert.ok([...forms.values()].every(form=>form.resetCount===1));
  assert.equal(context.state.noteId,null);
  assert.equal(elements.get('decision-body').cleared,true);
  assert.equal(elements.get('note-body').textContent,'');
  assert.equal(discarded,0);
  context.__clear({discardDrafts:true});
  assert.equal(discarded,1);
});

test('le traceur accepte un vrai Polygon fermé et refuse une géométrie incomplète, ouverte ou croisée',()=>{
  const validate=geometryValidatorInVm();
  const form=geometry=>({elements:{geometry:{value:JSON.stringify(geometry)}}});
  const valid={type:'Polygon',coordinates:[[[1,8],[1.01,8],[1.01,8.01],[1,8.01],[1,8]]]};
  assert.deepEqual(JSON.parse(JSON.stringify(validate(form(valid)))),valid);
  assert.throws(()=>validate(form({type:'Polygon',coordinates:[[[1,8],[1.01,8],[1,8.01],[1,8.02]]]})),/fermé/);
  assert.throws(()=>validate(form({type:'Polygon',coordinates:[[[1,8],[1.01,8],[1,8],[1,8]]]})),/distincts/);
  assert.throws(()=>validate(form({type:'Polygon',coordinates:[[[1,8],[1.01,8.01],[1,8.01],[1.01,8],[1,8]]]})),/nulle|croise/);
});
