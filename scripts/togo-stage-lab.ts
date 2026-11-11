import data from '../research-data/togo-fertility/2026-11-11/replay-input.json' with {type:'json'};
import {togoResidualScenario} from '../lib/seasonal/togo-residual-scenario.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {assessLandGeometry} from '../lib/seasonal/land.ts';
import {togoStageReplayInput} from '../lib/seasonal/togo-stage-replay.ts';
import type {SeasonalConfig,WaterEvent} from '../lib/seasonal/types.ts';
declare const __AGRI_BENCH_COMMIT__:string;
const get=(id:string)=>document.getElementById(id)!;
get('served-commit').textContent=__AGRI_BENCH_COMMIT__;
const fmt=(n:number|null,d=3)=>n===null?'Hors domaine':n.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});
let exportRows:string[][]=[];
function calculate(){
 try{
  const scale=[0,1,2,3].map(i=>Number((get('dose-'+i) as HTMLInputElement).value));
  scale.forEach((s,i)=>get('dose-value-'+i).textContent=fmt(s*100,0)+'%');
  const [interval,phase]=((get('calendar') as unknown as HTMLSelectElement).value).split(',').map(Number);
  const residual=(get('model') as unknown as HTMLSelectElement).value==='residual';
  const rows=[];
  for(let index=0;index<3;index++){
   let c=structuredClone(data.config) as unknown as SeasonalConfig,now=new Date().toISOString();
   c.landAssessment=assessLandGeometry(c.parcelGeometry!,[{id:'worldcover',status:'available',provider:'Software fixture only',product:'Synthetic land; no claim about the field outline',version:'togo-lab-1',referencePeriod:null,observedAt:null,acquiredAt:now,resolutionM:null,crs:'EPSG:4326',cells:[{id:'synthetic-land',value:40,geometry:c.parcelGeometry!}],reason:null,assets:[],limitations:['Synthetic demonstration geometry, not the nine experimental plots']}],now);
   c.yieldEstimation=togoStageReplayInput(c);if(residual)c=togoResidualScenario(c);c.yieldScenario='recorded';
   let offset=0;const events:WaterEvent[]=[];
   for(const [j,stage]of c.stages.entries()){
    const offsets=Array.from({length:stage.days},(_,i)=>i).filter(i=>i%interval===(phase||0));
    const amount=data.published.irrigationMm[index][j]*scale[j]/offsets.length;
    for(const k of offsets)events.push({id:`hypothesis-${offset+k}`,date:new Date(Date.parse(c.sowingDate)+(offset+k)*86400000).toISOString().slice(0,10),kind:'irrigation',amount,unit:'mm',point:'field',status:'declared',source:'Public retrospective scenario; NOT measured daily irrigation',recordedAt:'2026-11-10T00:00:00Z',landSelection:c.landSelection});
    offset+=stage.days;
   }
   const p=planSeason(c,events),result=p.yieldEstimation!.scenarios.find(s=>s.id==='recorded')!,previous=p.growth!.scenarios.find(s=>s.id==='recorded')!;
   if(!p.complete||p.days.some(d=>Math.abs(d.balanceResidualMm)>1e-8))throw Error('Bilan d’eau incomplet ou non conservatif.');
   rows.push({treatment:['Complète (FI)','80%FI','60%FI'][index],observed:data.published.observedKgHa[index],previous:previous.yieldKgHa,yield:result.totals?.yieldKgHaSown??null,irrigation:events.reduce((s,e)=>s+e.amount,0),et:p.totals.actualEtMm,phase:result.units[0].stageResponse,missing:result.missing});
  }
  const body=get('results');body.replaceChildren();
  const phases=get('phases');phases.replaceChildren();
  exportRows=[['traitement','grain_observe_essai_kg_ha','ancien_modele_kg_ha','grain_par_stades_kg_ha','irrigation_scenario_mm','ET_calculee_mm','humidite_hypothese_pct','methode','version_commit','profil']];
  for(const r of rows){
   const tr=document.createElement('tr');
   for(const value of [r.treatment,fmt(r.observed/1000),fmt(r.previous/1000),fmt(r.yield===null?null:r.yield/1000),fmt(r.irrigation,1),fmt(r.et,1)]){const td=document.createElement('td');td.textContent=value;tr.appendChild(td);}body.appendChild(tr);
   exportRows.push([r.treatment,String(r.observed),String(r.previous),r.yield===null?'':String(r.yield),String(r.irrigation),String(r.et),'13','FAO33-maize-stage-product-1.0.0',__AGRI_BENCH_COMMIT__,residual?'togo-tzee-residual-2017-v1':'togo-tzee-stage-replay-2017-v1']);
   if(r.phase)for(const p of r.phase.phases){const tr=document.createElement('tr');for(const value of [r.treatment,p.name,`${p.from} → ${p.to}`,fmt(p.ky,1),fmt(p.ratio===null?null:p.ratio*100,1)+'%',fmt(p.factor)]){const td=document.createElement('td');td.textContent=value;tr.appendChild(td);}phases.appendChild(tr);}
  }
  const original=interval===1&&scale.every(s=>s===1),deficits=residual?rows.slice(2):rows.slice(1);
  get('metric-label').textContent=residual?'Erreur absolue sur 60 % réservé dans cet ajustement (une seule moyenne, déjà connue) :':'Erreur RMSE sur 80 % et 60 % (FI utilisé pour la référence) :';
  get('fit-description').textContent=residual?'Candidat local : demande du tableau 4 ; capacité 2,2004 t/ha et efficacité effective 79 % ajustées sur FI + 80 %. Efficacité non mesurée. Sur les cinq calendriers avec paramètres figés, erreur sur 60 % : 0,047–0,185 t/ha. Couvert et biomasse non prédits ; validation agronomique incomplète.':'Référence v1 : NASA, efficacité hypothétique 100 %, capacité ajustée sur FI seul.';
  get('comparison-status').textContent=original?'Configuration principale publiée : dates quotidiennes hypothétiques, cumuls par stade conservés.':'Scénario d’apports modifié : aucune récolte observée correspondante. L’erreur n’est pas calculée pour ce scénario.';
  get('rmse').textContent=original&&deficits.every(r=>r.yield!==null)?fmt(Math.sqrt(deficits.reduce((s,r)=>s+(r.yield!-r.observed)**2,0)/deficits.length)/1000)+' t/ha':'—';
  get('warnings').textContent=[...new Set(rows.flatMap(r=>[...r.missing,...r.phase?.warnings??[]]))].join(' ');
 }catch(e){get('warnings').textContent=(e as Error).message;get('results').replaceChildren();get('phases').replaceChildren();get('rmse').textContent='—';get('comparison-status').textContent='Calcul interrompu ; aucune métrique valide.';exportRows=[];}
}
document.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',calculate));
get('reset').addEventListener('click',()=>{for(let i=0;i<4;i++)(get('dose-'+i) as HTMLInputElement).value='1';(get('calendar') as unknown as HTMLSelectElement).value='1';calculate();});
get('export').addEventListener('click',()=>{if(!exportRows.length)return;const csv=exportRows.map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='togo-rejeu-par-stades.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
calculate();
