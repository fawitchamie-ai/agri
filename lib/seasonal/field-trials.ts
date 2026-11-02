import {InputError,isoDate} from './validation.ts';
import {geometryIdentity} from './provenance.ts';
import type {SeasonalConfig} from './types.ts';

export type TrialApplication={date:string;product:string;kgHa:number;source:string};
export type TrialPlot={id:string;block:string;position:number;arm:'control'|'usual'|'alternative';areaM2:number|null;
 applications:TrialApplication[];harvest:{date:string;kg:number;moisturePercent:number;source:string}|null};
export type FieldTrial={version:'field-trial-1';id:string;geometryId:string;cropId:string;createdOn:string;
 question:string;protocol:string;agronomicReview:string|null;buffers:string;assignment:'randomized';seed:number;
 arms:{control:string;usual?:string;alternative:string};plots:TrialPlot[];correction?:{id:string;reason:string}};
const str=(v:unknown,label:string,max=1200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new InputError(label+' requis.');return v.trim();};
const number=(v:unknown,min:number,max:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new InputError('Mesure d’essai invalide.');return v;};

/** Stable random permutation within user-defined blocks; dimensioning is external. */
export function createTrialLayout(blocks:number,includeUsual:boolean,seed:number):TrialPlot[]{
 if(!Number.isInteger(blocks)||blocks<1||blocks>50||!Number.isInteger(seed)||seed<1||seed>0xffffffff)throw new InputError('Blocs et graine de tirage invalides.');
 let state=seed>>>0;
 const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
 return Array.from({length:blocks},(_,b)=>{
  const arms:TrialPlot['arm'][]=includeUsual?['control','usual','alternative']:['control','alternative'];
  for(let i=arms.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[arms[i],arms[j]]=[arms[j],arms[i]];}
  return arms.map((arm,i)=>({id:`b${b+1}-p${i+1}`,block:`b${b+1}`,position:i+1,arm,areaM2:null,applications:[],harvest:null}));
 }).flat();
}

export function parseFieldTrials(value:unknown,c:SeasonalConfig):FieldTrial[]|undefined{
 if(value===undefined)return undefined;
 if(!Array.isArray(value)||value.length>12)throw new InputError('Au plus 12 essais par campagne.');
 const trials=value.map((v):FieldTrial=>{
  if(!v||v.version!=='field-trial-1'||v.assignment!=='randomized')throw new InputError('Protocole d’essai invalide.');
  if(!c.parcelGeometry||v.geometryId!==geometryIdentity(c.parcelGeometry)||v.cropId!==c.cropProfile?.id)throw new InputError('Essai lié à un autre contour ou à une autre culture ; conservez-le dans sa campagne originale.');
  const createdOn=isoDate(v.createdOn);if(createdOn>c.asOfDate)throw new InputError('Date de création future.');
  const id=str(v.id,'Identifiant',100),question=str(v.question,'Question étudiée'),protocol=str(v.protocol,'Protocole',4000),buffers=str(v.buffers,'Zones tampons');
  if(!v.arms||!Array.isArray(v.plots)||!v.plots.length||v.plots.length>150)throw new InputError('Parcelles élémentaires requises.');
  const arms={control:str(v.arms.control,'Témoin sans le complément étudié'),alternative:str(v.arms.alternative,'Alternative'),...(v.arms.usual?{usual:str(v.arms.usual,'Pratique habituelle')}:{})};
  const blocks=[...new Set(v.plots.map((p:TrialPlot)=>p.block))];
  if(blocks.some((b,i)=>b!==`b${i+1}`))throw new InputError('Ordre des blocs invalide.');
  const layout=createTrialLayout(blocks.length,!!arms.usual,v.seed);
  if(JSON.stringify(layout.map(p=>[p.id,p.block,p.position,p.arm]))!==JSON.stringify(v.plots.map((p:TrialPlot)=>[p.id,p.block,p.position,p.arm])))throw new InputError('Le dispositif ne correspond plus au tirage enregistré.');
  const plots:TrialPlot[]=v.plots.map((p:TrialPlot):TrialPlot=>{
   const areaM2=p.areaM2==null?null:number(p.areaM2,.001,1e9);
   if(!Array.isArray(p.applications)||p.applications.length>30)throw new InputError('Liste d’apports de l’essai invalide.');
   const applications=p.applications.map(a=>{const date=isoDate(a.date);if(date<createdOn||date>c.asOfDate)throw new InputError('Apport d’essai antérieur au protocole ou futur.');return {date,product:str(a.product,'Produit',200),kgHa:number(a.kgHa,0,1e6),source:str(a.source,'Source de la dose',600)};});
   let harvest:TrialPlot['harvest']=null;
   if(p.harvest){const h=p.harvest,date=isoDate(h.date);if(areaM2===null||date<createdOn||date>c.asOfDate||applications.some(a=>a.date>date))throw new InputError('Surface mesurée et dates d’apport/récolte cohérentes requises.');harvest={date,kg:number(h.kg,0,1e9),moisturePercent:number(h.moisturePercent,0,99),source:str(h.source,'Source de pesée/humidité',600)};}
   return {id:p.id,block:p.block,position:p.position,arm:p.arm,areaM2,applications,harvest};
  });
  if(c.areaM2!=null&&plots.reduce((n,p)=>n+(p.areaM2??0),0)>c.areaM2+.01)throw new InputError('Les surfaces nettes d’essai dépassent le contour.');
  const maximum=c.landAssessment?.candidateAreaM2;
  if(maximum!=null&&plots.reduce((n,p)=>n+(p.areaM2??0),0)>maximum+.01)throw new InputError('Les surfaces d’essai dépassent la terre potentielle.');
  const correction=v.correction?{id:str(v.correction.id,'Correction',100),reason:str(v.correction.reason,'Motif de correction',600)}:undefined;
  return {version:'field-trial-1',id,geometryId:v.geometryId,cropId:v.cropId,createdOn,question,protocol,buffers,assignment:'randomized',seed:v.seed,arms,plots,agronomicReview:v.agronomicReview==null?null:str(v.agronomicReview,'Référence de revue',600),...(correction?{correction}:{})};
 });
 if(new Set(trials.map(t=>t.id)).size!==trials.length)throw new InputError('Essai dupliqué.');
 return trials;
}

export function protectFieldTrials(old:SeasonalConfig,next:SeasonalConfig){
 for(const prior of old.fieldTrials??[]){
  if(!prior.plots.some(p=>p.harvest||p.applications.length))continue;
  const trial=next.fieldTrials?.find(t=>t.id===prior.id);
  if(!trial)throw new InputError('Un essai observé doit être conservé avec son historique.');
  if(JSON.stringify([prior.geometryId,prior.cropId,prior.createdOn,prior.seed,prior.arms,prior.protocol,prior.question,prior.buffers])!==JSON.stringify([trial.geometryId,trial.cropId,trial.createdOn,trial.seed,trial.arms,trial.protocol,trial.question,trial.buffers]))throw new InputError('Le protocole et le tirage d’un essai observé sont figés.');
  const changed=prior.plots.some((p,i)=>(p.harvest||p.applications.length)&&JSON.stringify(p)!==JSON.stringify(trial.plots[i]));
  if(changed&&(!trial.correction||trial.correction.id===prior.correction?.id))throw new InputError('Correction explicite et motivée requise pour une observation d’essai.');
 }
}

export function summarizeTrial(trial:FieldTrial){
 const blocks=[...new Set(trial.plots.map(p=>p.block))],contrasts=[];
 const dryYield=(p:TrialPlot)=>p.harvest&&p.areaM2? p.harvest.kg*(1-p.harvest.moisturePercent/100)*10000/p.areaM2:null;
 for(const block of blocks){const plots=trial.plots.filter(p=>p.block===block),control=plots.find(p=>p.arm==='control')!,y0=dryYield(control);
  for(const arm of ['usual','alternative'] as const){const p=plots.find(p=>p.arm===arm),y=p?dryYield(p):null;if(y0!==null&&y!==null)contrasts.push({block,arm,deltaDryKgHa:y-y0});}
 }
 return {status:'declared_observations',validated:false,autoTraining:false,contrasts,completeBlocks:blocks.filter(b=>trial.plots.filter(p=>p.block===b).every(p=>p.harvest)).length,
  limitations:['Rendement en matière sèche : masse pesée × (1 − humidité/100) / surface nette récoltée.',
   'Humidité, pesées, apports et protocole déclarés ; contrôle qualité et revue agronomique nécessaires. Aucune promotion automatique du modèle.',
   'Un seul bloc ne permet pas d’estimer la variabilité entre blocs. Le dispositif doit être dimensionné selon le terrain.',
   'Le témoin est sans le complément étudié ; son sol peut avoir reçu des apports antérieurs.']};
}
