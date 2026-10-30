import type {SeasonalConfig} from './types.ts';
import type {Environment} from './environment.ts';
import {applyCropProfile,cropById,CATALOG_VERSION} from './catalog.ts';

/** Explicit starting assumptions keep the first calculation usable, never measured. */
export function automaticCampaign(c:SeasonalConfig,cropId=c.cropProfile?.id??'maize',date=c.sowingDate):SeasonalConfig{
 const next={...c,name:c.name.trim()||'Mon champ',territory:c.territory.trim()||'Parcelle GPS',sowingDate:date,asOfDate:new Date().toISOString().slice(0,10),
 soil:{...c.soil,source:c.soil.layers.some(l=>l.initialTheta===null)?'Hypothèse hydrique modifiable : capacité 0,30, flétrissement 0,15 et réserve initiale à 60 % ; non mesurée':c.soil.source,layers:c.soil.layers.map(l=>({...l,initialTheta:l.initialTheta??l.thetaWP+.6*(l.thetaFC-l.thetaWP)}))},
 system:{...c.system,name:'Arrosage simulé',source:'Hypothèses modifiables : efficacité 75 %, transport sans perte ; disponibilité non vérifiée',applicationEfficiency:c.system.applicationEfficiency??.75,transportEfficiency:c.system.transportEfficiency??1},fallback:null};
 const profile=cropById(cropId);
 if(profile?.water?.durationIssue)return {...next,crop:profile.name,cropProfile:{id:cropId,version:CATALOG_VERSION,mode:'reference'},stages:[],nutritionReference:undefined,parameterSource:'Durées spécifiques à compléter avec une référence locale'};
 return applyCropProfile(next,cropId);
}
export function mergeEnvironment(c:SeasonalConfig,e:Environment):SeasonalConfig{
 const s=e.soil,date=e.retrievedAt.slice(0,10);
 const specs=[['pH',s.ph,'pH','water'],['organicC',s.organicC,'g/kg','SoilGrids'],['totalN',s.totalN,'g/kg','SoilGrids'],['CEC',s.cec,'cmol(+)/kg','SoilGrids']] as const;
 const measurements=specs.filter((x):x is typeof x & {1:number}=>x[1]!==null).map(([parameter,value,unit,method])=>({parameter,value:value!,unit,method}));
 const manual=(c.soilAnalyses??[]).filter(a=>!a.source.startsWith('ISRIC SoilGrids'));
 const manualParameters=new Set(manual.flatMap(a=>a.measurements.map(m=>m.parameter)));
 const retained=(c.soilAnalyses??[]).filter(a=>a.source.startsWith('ISRIC SoilGrids')).flatMap(a=>a.measurements).filter(m=>!measurements.some(n=>n.parameter===m.parameter));
 const automatic=[...measurements,...retained].filter(m=>!manualParameters.has(m.parameter));
 const end=Date.parse(c.sowingDate)+(c.stages.reduce((s,l)=>s+l.days,0)-1)*86400000;
 const weather=new Map(c.weather.filter(w=>w.date>=c.sowingDate&&Date.parse(w.date)<=end).map(w=>[w.date,w]));
 for(const w of e.weather)weather.set(w.date,w);
 for(const w of c.weather)if(w.status==='observed'||w.source.startsWith('Ajustement utilisateur'))weather.set(w.date,w);
 const soil=s.hydraulicLayers&&c.soil.source.startsWith('Hypothèse hydrique')?{...c.soil,source:'ISRIC SoilGrids : rétention estimée à 33 et 1500 kPa, 6 horizons 0–200 cm ; réserve initiale hypothétique à 60 %, infiltration hypothétique',layers:s.hydraulicLayers}:c.soil;
 return {...c,soil,asOfDate:date,weather:[...weather.values()].sort((a,b)=>a.date.localeCompare(b.date)),soilAnalyses:[...manual,...(automatic.length?[{source:s.source,date,availableOn:date,topCm:5,bottomCm:15,status:'estimated' as const,measurements:automatic}]:[])]};
}
export function phSuitability(ph:number|null,optimal:number[]|null|undefined,absolute:number[]|null|undefined):number|null{
 if(ph===null||!optimal||!absolute)return null;
 if(ph>=optimal[0]&&ph<=optimal[1])return 100;
 if(ph<=absolute[0]||ph>=absolute[1])return 0;
 return Math.round(ph<optimal[0]?100*(ph-absolute[0])/(optimal[0]-absolute[0]):100*(absolute[1]-ph)/(absolute[1]-optimal[1]));
}
