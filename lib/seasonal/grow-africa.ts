import source from '../../data/seasonal/grow-africa-regional.json' with {type:'json'};
import type {Country} from './types.ts';

type GrowRow={country:string;region_id:string;admin_level:1|2;admin_1:string;admin_2:string;crop:string;app_crop_ids:string[];harvest_year:number;yield_t_ha:number;yield_qc_flag:string;source:string};
type Snapshot={dataset:string;doi:string;paper_doi:string;version:string;license:string;acquired_on:string;archive_md5:string;archive_sha256:string;source_file:string;source_rows_selected:number;runtime_rows_latest_five_years_per_region_crop:number;records:GrowRow[]};
const data=source as Snapshot;
const countryName:Record<Country,string>={TGO:'Togo',BEN:'Benin',BFA:'Burkina Faso',GHA:'Ghana',CIV:'Cote dIvoire',SEN:'Senegal'};
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const sharedLimits=[
 'Statistique régionale rapportée, non mesure de cette parcelle et non prévision de récolte.',
 'La table ne fournit pas une définition harmonisée du produit récolté, de son humidité ou du dénominateur de surface.',
 'Aucune donnée météo, sol, satellite ou conduite n’est jointe ici ; aucun effet causal de l’eau ou des engrais n’est estimé.',
 'Le territoire est rapproché par nom déclaré exact. Il n’est pas déterminé par intersection avec le contour GPS.',
];

/** Exact name match only. The result is historical context and is never a Ym input. */
export function growAfricaRegionalContext(country:Country,cropId:string,territory:string,asOfDate:string){
 const base={dataset:data.dataset,doi:data.doi,paperDoi:data.paper_doi,version:data.version,license:data.license,acquiredOn:data.acquired_on,archiveSha256:data.archive_sha256,scope:'administrative_regional' as const,country,countryName:countryName[country],cropId,requestedTerritory:territory,usedForPrediction:false,usedAsIndependentYm:false,limits:sharedLimits};
 if(data.acquired_on>asOfDate)return {...base,status:'not_available_as_of' as const,matchedTerritory:null,adminLevel:null,rows:[],missing:'Cette source a été acquise après la date de référence ; elle ne peut pas compléter cette reconstitution.'};
 const key=normalize(territory);
 if(!key)return {...base,status:'unavailable' as const,matchedTerritory:null,adminLevel:null,rows:[],missing:'Aucun territoire administratif n’est renseigné. Ajoutez son nom exact dans la campagne pour consulter un repère régional.'};
 const countryRows=data.records.filter(r=>r.country===countryName[country]&&r.app_crop_ids.includes(cropId));
 const matchesAt=(level:1|2)=>{
  const ids=new Map<string,GrowRow[]>();
  for(const r of countryRows){
   const candidate=level===2?r.admin_2:r.admin_1;
   if(normalize(candidate)!==key)continue;
   const rows=ids.get(r.region_id)??[];rows.push(r);ids.set(r.region_id,rows);
  }
  return [...ids.entries()];
 };
 const admin2=matchesAt(2);
 const admin1=matchesAt(1);
 const matches=admin2.length?admin2:admin1;
 if(matches.length>1||(admin2.length>0&&admin1.length>0))return {...base,status:'ambiguous_territory' as const,matchedTerritory:null,adminLevel:null,rows:[],missing:'Ce nom correspond à plusieurs unités ou niveaux administratifs pour cette culture. Précisez un nom administratif non ambigu.'};
 if(!matches.length){
  const anyCountry=data.records.some(r=>r.country===countryName[country]);
  const missing=anyCountry
   ?'Aucune série régionale qualifiée ne correspond exactement au territoire et à cette culture. Vérifiez le nom administratif ; aucune valeur nationale ou voisine n’est substituée.'
   :'Aucune série régionale GROW-Africa admissible n’est disponible pour ce pays. Les statistiques nationales et les mesures de terrain restent des sources distinctes.';
  return {...base,status:'unavailable' as const,matchedTerritory:null,adminLevel:null,rows:[],missing};
 }
 const [regionId,raw]=matches[0],level=admin2.length?2:1;
 const rows=raw.filter(r=>r.harvest_year<=Number(asOfDate.slice(0,4))).sort((a,b)=>a.harvest_year-b.harvest_year).map(r=>({
  year:r.harvest_year,yieldTHa:r.yield_t_ha,source:r.source,qualityFlag:r.yield_qc_flag,
 }));
 const first=raw[0];
 if(!rows.length)return {...base,status:'unavailable' as const,matchedTerritory:level===2?first.admin_2:first.admin_1,adminLevel:level,regionId,rows,missing:'La série disponible est postérieure à la date de référence.'};
 const riceLimit=cropId==='rice-upland'||cropId==='rice-flooded'?['Le produit statistique regroupe le riz sans séparer systèmes pluvial et submergé.']:[];
 const scopeNote=level===2?'Unité administrative GROW-Africa niveau 2':'Unité administrative GROW-Africa niveau 1';
 return {...base,status:'context_only' as const,matchedTerritory:level===2?first.admin_2:first.admin_1,adminLevel:level,regionId,scopeNote,rows,missing:null,limits:[...sharedLimits,...riceLimit]};
}
