import { cropById } from './catalog.ts';
export const SOIL_PARAMETERS = {
 pH:{label:'pH',units:['pH'],methods:['water','water_1:2.5','water_1:5','KCl','CaCl2','other']},
 EC:{label:'Conductivité électrique',units:['dS/m'],methods:['saturated_paste','1:5','1:2.5','other']},
 organicC:{label:'Carbone organique',units:['g/kg','%'],methods:[]},
 organicMatter:{label:'Matière organique',units:['g/kg','%'],methods:[]},
 totalN:{label:'Azote total',units:['g/kg','%'],methods:[]},
 mineralN:{label:'Azote minéral NO3-N + NH4-N',units:['mg/kg'],methods:[]},
 availableP:{label:'Phosphore assimilable (P)',units:['mg/kg'],methods:['Olsen','Olsen-Dabin','Bray-1','Bray-2','Mehlich-3','other']},
 exchangeableK:{label:'Potassium échangeable (K)',units:['mg/kg','cmol(+)/kg'],methods:[]},
 CEC:{label:'Capacité d’échange cationique',units:['cmol(+)/kg'],methods:[]},
 Ca:{label:'Calcium échangeable',units:['mg/kg','cmol(+)/kg'],methods:[]},
 Mg:{label:'Magnésium échangeable',units:['mg/kg','cmol(+)/kg'],methods:[]},
 Na:{label:'Sodium échangeable',units:['mg/kg','cmol(+)/kg'],methods:[]},
 S:{label:'Soufre assimilable (S)',units:['mg/kg'],methods:[]},
 Zn:{label:'Zinc extractible',units:['mg/kg'],methods:[]},
 B:{label:'Bore extractible',units:['mg/kg'],methods:[]},
 Al:{label:'Aluminium échangeable',units:['cmol(+)/kg'],methods:[]},
} as const;
export type SoilParameter=keyof typeof SOIL_PARAMETERS;
export type SoilAnalysis={source:string;date:string|null;availableOn:string;topCm:number;bottomCm:number;status:'measured'|'declared'|'estimated';measurements:{parameter:SoilParameter;value:number;unit:string;method:string}[]};
export function chemistryGuidance(cropId:string|undefined, analyses:SoilAnalysis[]=[]) {
 const p=cropId?cropById(cropId):undefined;
 const messages=[p?.nutrition??'Choisissez la culture et une référence agronomique adaptée.',
 'Une analyse doit préciser date, profondeur, unité et méthode. P Olsen/Olsen-Dabin/Bray et pH eau/KCl ne sont pas fusionnés. Aucun dosage n’est déduit automatiquement des mg/kg.',
 'L’azote total ne mesure pas l’azote immédiatement disponible. La matière organique et le carbone organique restent distincts. Aucun chaulage ne résulte du seul pH.'];
 if(!analyses.length)messages.push('Analyse chimique absente : adaptation au sol de la parcelle non établie.');
 else messages.push('Analyses conservées pour le diagnostic : aucune fonction locale de réponse aux engrais n’est encore calibrée. Leur saisie ne personnalise pas automatiquement les doses ni le rendement.');
 for(const a of analyses){
  const depth=`${a.topCm}–${a.bottomCm} cm`;
  const ec=a.measurements.find(m=>m.parameter==='EC');
  if(ec && ec.method!=='saturated_paste')messages.push(`${depth} : EC mesurée par ${ec.method}, non comparable directement à un seuil ECe de pâte saturée.`);
  if(ec?.method==='saturated_paste' && p?.eceThresholdDsM && ec.value>p.eceThresholdDsM[0])messages.push(`${depth} : ECe ${ec.value} dS/m dépasse la borne basse du repère FAO56 (${p.eceThresholdDsM.join('–')} dS/m). Diagnostic salinité/drainage requis ; le bilan générique ne simule pas le stress salin ni le lessivage.`);
  const ph=a.measurements.find(m=>m.parameter==='pH');
  if(ph && p?.ecology?.phOptimal){messages.push(`${depth} : pH ${ph.value} (${ph.method}). Repère écologique ${p.ecology.phOptimal.join('–')} pour ${p.name}, méthode non précisée par EcoCrop : comparaison indicative, sans diagnostic de carence ni dose de chaux.`);}
  if(a.status!=='measured')messages.push(`${depth} : analyse ${a.status==='estimated'?'estimée':'déclarée'}, à confirmer avec le compte rendu de laboratoire.`);
 }
 return messages;
}
