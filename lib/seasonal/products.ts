import {InputError,isoDate} from './validation.ts';

export const PRODUCT_VERSION='product-composition-1';
export const PRODUCT_CATALOG_VERSION='fertilizers-2026-11-01';
/** Rounded stoichiometric mass ratios. Oxide equivalents are label conventions. */
export const P_FROM_P2O5=0.4364;
export const K_FROM_K2O=0.8301;
export type ProductKind='mineral'|'organic'|'lime'|'gypsum'|'biochar'|'biostimulant'|'pesticide'|'other';
export type ProductComposition={
 version:typeof PRODUCT_VERSION;id:string;kind:ProductKind;name:string;manufacturer:string|null;
 source:string;lot:string|null;analysisDate:string|null;
 evidence:'analysis'|'label'|'declared'|'reference_scenario';scenario:string|null;
 convention:'N-P2O5-K2O'|'N-P-K';basis:'fresh'|'dry';
 percent:[number|null,number|null,number|null];
 nForms:{urea:number|null;ammonium:number|null;nitrate:number|null;organic:number|null};
 moisturePercent:number|null;densityKgL:number|null;
 organic:{carbonPercent:number|null;cnRatio:number|null;maturity:string|null;storage:string|null}|null;
 chemicalForms?:{phosphorus:string|null;potassium:string|null};
 otherGuarantees?:{label:string;value:number|null;unit:'% mass';form:string|null}[];
 uncertainty:string;
};
const kinds:ProductKind[]=['mineral','organic','lime','gypsum','biochar','biostimulant','pesticide','other'];
function str(v:unknown,label:string,max=1200){if(typeof v!=='string'||!v.trim()||v.length>max)throw new InputError(label+' requis.');return v.trim();}
function nullable(v:unknown,label:string,max=1200):string|null{return v===null?null:str(v,label,max);}
function num(v:unknown,max:number,label:string):number|null{if(v===null)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)throw new InputError(label+' invalide.');return v;}
export function parseComposition(input:unknown):ProductComposition{
 const p=input as ProductComposition;
 if(!p||p.version!==PRODUCT_VERSION||!kinds.includes(p.kind)||!['analysis','label','declared','reference_scenario'].includes(p.evidence)||!['N-P2O5-K2O','N-P-K'].includes(p.convention)||!['fresh','dry'].includes(p.basis)||!Array.isArray(p.percent)||p.percent.length!==3||!p.nForms)throw new InputError('Profil et convention du produit invalides.');
 const percent=p.percent.map(n=>num(n,100,'Teneur massique')) as ProductComposition['percent'];
 const nForms={urea:num(p.nForms.urea,100,'N uréique'),ammonium:num(p.nForms.ammonium,100,'N ammoniacal'),nitrate:num(p.nForms.nitrate,100,'N nitrique'),organic:num(p.nForms.organic,100,'N organique')};
 if(p.kind==='pesticide'&&(percent.some(n=>n!==null)||Object.values(nForms).some(n=>n!==null)))throw new InputError('Les pesticides ne sont pas des nutriments.');
 const sum=Object.values(nForms).reduce<number>((s,n)=>s+(n??0),0);
 if(sum>100+1e-8||percent[0]!==null&&sum>percent[0]+1e-8)throw new InputError('Les formes de N sont incluses dans N total ; leur somme ne doit pas le dépasser.');
 const elemental=[percent[0],percent[1]===null?null:percent[1]*(p.convention==='N-P2O5-K2O'?P_FROM_P2O5:1),percent[2]===null?null:percent[2]*(p.convention==='N-P2O5-K2O'?K_FROM_K2O:1)];
 if(elemental.reduce<number>((s,n)=>s+(n??0),0)>100+1e-8)throw new InputError('Somme des masses élémentaires supérieure à la masse de produit.');
 const scenario=nullable(p.scenario,'Nom du scénario');
 if(p.evidence==='reference_scenario'&&!scenario)throw new InputError('Un profil estimé exige un scénario nommé et une incertitude.');
 const densityKgL=num(p.densityKgL,10,'Masse volumique kg/L');if(densityKgL===0)throw new InputError('La masse volumique doit être positive.');
 const organic=p.organic===null?null:{carbonPercent:num(p.organic?.carbonPercent,100,'Carbone %'),cnRatio:num(p.organic?.cnRatio,10000,'Rapport C/N'),maturity:nullable(p.organic?.maturity,'Maturité'),storage:nullable(p.organic?.storage,'Stockage')};
 if(organic?.cnRatio===0)throw new InputError('C/N doit être positif ou inconnu.');
 if(p.kind==='organic'&&!organic)throw new InputError('Caractérisation organique requise ; les inconnues doivent rester null.');
 if(p.kind!=='organic'&&nForms.organic!==null&&nForms.organic>0)throw new InputError('N organique exige un composant organique distinct.');
 if(p.chemicalForms!==undefined&&(!p.chemicalForms||typeof p.chemicalForms!=='object'))throw new InputError('Formes chimiques invalides.');
 const chemicalForms=p.chemicalForms===undefined?undefined:{phosphorus:nullable(p.chemicalForms.phosphorus,'Forme P',200),potassium:nullable(p.chemicalForms.potassium,'Forme K',200)};
 if(p.otherGuarantees!==undefined&&(!Array.isArray(p.otherGuarantees)||p.otherGuarantees.length>20))throw new InputError('Garanties additionnelles invalides.');
 const otherGuarantees=p.otherGuarantees?.map(g=>{if(!g||g.unit!=='% mass')throw new InputError('Garantie massique attendue.');return {label:str(g.label,'Élément et convention',100),value:num(g.value,100,'Teneur garantie'),unit:'% mass' as const,form:nullable(g.form,'Forme chimique',200)};});
 if(otherGuarantees&&new Set(otherGuarantees.map(g=>g.label)).size!==otherGuarantees.length)throw new InputError('Garantie additionnelle dupliquée.');
 return {version:PRODUCT_VERSION,id:str(p.id,'Identifiant',100),kind:p.kind,name:str(p.name,'Produit',160),manufacturer:nullable(p.manufacturer,'Fabricant',200),source:str(p.source,'Source'),lot:nullable(p.lot,'Lot',200),analysisDate:p.analysisDate===null?null:isoDate(p.analysisDate,'Date analytique'),evidence:p.evidence,scenario,convention:p.convention,basis:p.basis,percent,nForms,moisturePercent:num(p.moisturePercent,100,'Humidité massique'),densityKgL,organic,uncertainty:str(p.uncertainty,'Limites / incertitude'),...(chemicalForms?{chemicalForms}:{}),...(otherGuarantees?{otherGuarantees}:{})};
}
export type NutrientApplication={id:string;date:string;dose:number;unit:'kg/ha'|'L/ha';status:'planned'|'declared';mode:string;composition:ProductComposition};
export function parseNutrientApplication(v:unknown):NutrientApplication{
 const a=v as NutrientApplication;
 if(!a||!['kg/ha','L/ha'].includes(a.unit)||!['planned','declared'].includes(a.status)||typeof a.dose!=='number'||!Number.isFinite(a.dose)||a.dose<0||a.dose>1000000)throw new InputError('Dose, unité ou statut de produit invalide.');
 return {id:str(a.id,'Identifiant',100),date:isoDate(a.date,'Date de l’apport'),dose:a.dose,unit:a.unit,status:a.status,mode:str(a.mode,'Mode d’application',200),composition:parseComposition(a.composition)};
}
export function convertApplication(input:NutrientApplication){
 const a=parseNutrientApplication(input),p=a.composition,missing:string[]=[];
 // Application dose always means product as applied, including moisture.
 let freshKgHa:number|null=a.unit==='kg/ha'?a.dose:p.densityKgL===null?null:a.dose*p.densityKgL;
 if(freshKgHa===null)missing.push('Masse volumique kg/L requise pour convertir L/ha.');
 const dryKgHa=freshKgHa===null||p.moisturePercent===null?null:freshKgHa*(1-p.moisturePercent/100);
 const analyticalMass=p.basis==='fresh'?freshKgHa:dryKgHa;
 if(p.basis==='dry'&&p.moisturePercent===null)missing.push('Humidité requise : dose fraîche et analyse sur matière sèche.');
 const mass=(n:number|null)=>n===null||analyticalMass===null?null:analyticalMass*n/100;
 const label=p.percent.map(mass) as [number|null,number|null,number|null];
 const elementalKgHa={N:label[0],P:label[1]===null?null:label[1]*(p.convention==='N-P2O5-K2O'?P_FROM_P2O5:1),K:label[2]===null?null:label[2]*(p.convention==='N-P2O5-K2O'?K_FROM_K2O:1)};
 const oxideKgHa={N:label[0],P2O5:label[1]===null?null:label[1]/(p.convention==='N-P-K'?P_FROM_P2O5:1),K2O:label[2]===null?null:label[2]/(p.convention==='N-P-K'?K_FROM_K2O:1)};
 if(p.kind==='pesticide'&&p.percent.some(n=>n!==null))throw new InputError('Les pesticides ne sont pas des nutriments.');
 return {id:a.id,date:a.date,status:a.status,mode:a.mode,product:p,freshKgHa,dryKgHa,oxideKgHa,elementalKgHa,nFormsKgHa:{urea:mass(p.nForms.urea),ammonium:mass(p.nForms.ammonium),nitrate:mass(p.nForms.nitrate),organic:mass(p.nForms.organic)},availableDuringCycleKgHa:null,mineralization:{status:'not_modelled',reason:'Libération et immobilisation exigent un module compatible, ses paramètres et le forçage journalier ; aucun coefficient universel.'},yieldEffect:'not_modelled',missing};
}
export function nutrientBalance(input:unknown){
 if(!Array.isArray(input)||input.length>200)throw new InputError('Liste de 200 composantes maximum attendue.');
 const rows=input.map(a=>convertApplication(a));
 if(new Set(rows.map(a=>a.id)).size!==rows.length)throw new InputError('Une même composante ne peut pas être comptée deux fois.');
 const total=(rs:typeof rows,key:'N'|'P'|'K')=>rs.some(r=>r.elementalKgHa[key]===null)?null:rs.reduce((s,r)=>s+r.elementalKgHa[key]!,0);
 const totals=(rs:typeof rows)=>({N:total(rs,'N'),P:total(rs,'P'),K:total(rs,'K')});
 return {version:PRODUCT_CATALOG_VERSION,unit:'kg élémentaire/ha de la même unité semée',rows,totals:totals(rows),realized:totals(rows.filter(r=>r.status==='declared')),planned:totals(rows.filter(r=>r.status==='planned')),availableDuringCycleKgHa:null,limits:['Bilans de masses apportées, pas de disponibilité ou prescription.','Mélange : saisir chaque composante une fois ; ne pas ajouter simultanément le mélange et ses ingrédients.','Les inconnues restent null et rendent le total correspondant inconnu. Aucune fraction minérale n’est ajoutée une seconde fois au N total.','Chaux, gypse, biochar et biostimulants ne reçoivent aucun gain de rendement ni changement instantané du sol.']};
}

/** Native SNOMIN adapter: all masses relative to fresh material, never total N
 * plus mineral fractions. Model-specific organic characterization is mandatory. */
export function snominApplication(input:unknown,parameters:unknown){
 const a=parseNutrientApplication(input),r=convertApplication(a),p=parameters as {depthCm:number;topLayerCm:number;profileDepthCm:number;initialAgeYears:number;organicMatterPercentFresh:number;organicCnRatio:number|null;source:string};
 if(!p||![p.depthCm,p.topLayerCm,p.profileDepthCm,p.initialAgeYears,p.organicMatterPercentFresh].every(Number.isFinite)||p.topLayerCm<=0||p.depthCm<p.topLayerCm||p.depthCm>p.profileDepthCm||p.initialAgeYears<0||p.organicMatterPercentFresh<0||p.organicMatterPercentFresh>100||!p.source?.trim())throw new InputError('Paramètres SNOMIN explicites requis ; profondeur au moins égale au premier horizon.');
 if(!['mineral','organic'].includes(a.composition.kind))throw new InputError('Produit hors du domaine nutritif SNOMIN.');
 const f=r.nFormsKgHa;
 if(r.freshKgHa===null||Object.values(f).some(x=>x===null)||r.elementalKgHa.N===null)throw new InputError('Masse et toutes les formes de N doivent être connues pour SNOMIN.');
 if(f.urea!==0)throw new InputError('Hydrolyse de l’urée non représentée ; aucune conversion silencieuse en ammonium.');
 if(Math.abs(f.ammonium!+f.nitrate!+f.organic!-r.elementalKgHa.N)>1e-6)throw new InputError('Les formes N doivent fermer le bilan de N total.');
 const organicMatterKgHa=r.freshKgHa*p.organicMatterPercentFresh/100,carbonKgHa=.58*organicMatterKgHa;
 if(organicMatterKgHa>0){
  if(typeof p.organicCnRatio!=='number'||!Number.isFinite(p.organicCnRatio)||p.organicCnRatio<=0||a.composition.organic?.carbonPercent===null||a.composition.organic?.carbonPercent===undefined)throw new InputError('C/N de la fraction organique et carbone documentés requis.');
  const carbonMass=(a.composition.basis==='fresh'?r.freshKgHa:r.dryKgHa)!*a.composition.organic.carbonPercent/100;
  if(Math.abs(carbonMass-carbonKgHa)>Math.max(1e-6,carbonKgHa*1e-6)||Math.abs(carbonKgHa/p.organicCnRatio-f.organic!)>1e-6)throw new InputError('Profil organique incompatible avec C/MO=0,58 fixé par SNOMIN ou avec le bilan N organique. Aucun ajustement automatique.');
 }else if(f.organic!==0)throw new InputError('N organique sans matière organique caractérisée.');
 if(f.ammonium!+f.nitrate!+organicMatterKgHa>r.freshKgHa+1e-6)throw new InputError('Matière organique et N minéral dépassent la masse du produit.');
 return {id:a.id,date:a.date,status:a.status,amountKgHa:r.freshKgHa,nh4KgHa:f.ammonium!,no3KgHa:f.nitrate!,organicNKgHa:f.organic!,organicMatterKgHa,carbonKgHa,ureaNkgHa:0,depthCm:p.depthCm,initialAgeYears:p.initialAgeYears,source:a.composition.source+' ; '+p.source,composition:a.composition,mode:a.mode,assumptions:['P et K comptabilisés en apports uniquement, non simulés par SNOMIN.','C/MO=0,58 est une contrainte de ce module, pas une composition universelle des produits.']};
}

/** Catalog entries are specifications/templates, never analyses of an actual bag or local manure. */
export function productCatalog(){return {version:PRODUCT_CATALOG_VERSION,source:'https://www.fao.org/agriculture/crops/thematic-sitemap/theme/spi/plantnutrition/fertspecs/en/',checkedOn:'2026-11-01',entries:[
 {id:'npk-15-15-15',kind:'mineral',name:'NPK 15–15–15',status:'label_required',convention:'N-P2O5-K2O',examplePercent:[15,15,15],basis:null,nForms:null,source:'FAO, spécification NPK complex 15-15-15',required:['Étiquette réelle et fabricant/lot','Base analytique des garanties','Formes de N si dynamique requise'],note:'Exemple de conversion ; aucune dose recommandée. La base sèche de certaines garanties FAO ne décrit pas automatiquement le sac réel.'},
 {id:'urea',kind:'mineral',name:'Urée',status:'label_required',convention:'N-P2O5-K2O',examplePercent:null,basis:null,nForms:null,source:'FAO, spécification UREA',required:['Garantie N réelle et base fraîche/sèche','Pureté/formulation et humidité si nécessaires'],note:'Ne pas remplacer la formulation du produit par celle de la molécule pure.'},
 ...(['manure','compost','poultry-manure','residue','green-manure'] as const).map(id=>({id,kind:'organic',name:({manure:'Fumier',compost:'Compost','poultry-manure':'Fientes',residue:'Résidus','green-manure':'Engrais verts'})[id],status:'analysis_or_named_scenario_required',examplePercent:null,required:['Dose fraîche kg/ha','Base analytique et humidité si conversion nécessaire','Teneurs totales N, P/P₂O₅, K/K₂O et formes N connues','C/N, maturité, stockage et profondeur pour un module de libération compatible'],note:'Aucune composition universelle ni disponibilité par défaut.'})),
 ...(['lime','gypsum','biochar','biostimulant','pesticide'] as const).map(id=>({id,kind:id,status:'separate_effect_not_modelled',examplePercent:null,required:id==='lime'?['Méthode de besoin en chaux','Pouvoir neutralisant, finesse, profondeur et tampon du sol']:id==='pesticide'?['Diagnostic','Pression et contrôle documentés','Homologation pays/culture/usage/date']:['Caractérisation et mécanisme documenté'],note:'Aucun bonus automatique.'}))
 ],minimumApplication:['Identifiant composante distinct','Date, dose de produit, unité, mode, statut','Source, fabricant ou source analytique, lot si connu','Convention et base analytique explicites'],prescription:false};}
