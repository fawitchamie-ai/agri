import evidence from '../../docs/calibration/EVIDENCE.json' with {type:'json'};
import {COUNTRIES,type Country} from './types.ts';
import {cropById} from './catalog.ts';
import {InputError} from './validation.ts';
/** Acquisition metadata only. Never supplies fitted coefficients or simulated yield labels. */
export function calibrationEvidence(country:Country,cropId?:string){
 if(!Object.hasOwn(COUNTRIES,country))throw new InputError('Pays non pris en charge pour cet inventaire.');
 if(cropId&&!evidence.cropIds.includes(cropId))throw new InputError('Culture inconnue dans cet inventaire.');
 const coverage=evidence.matrix.filter(r=>(!cropId||r.crop===cropId)).map(r=>({...r,countryName:COUNTRIES[r.country as Country].name,cropName:cropById(r.crop)?.name??({carrot:'Carotte',lettuce:'Laitue',cotton:'Coton',rice:'Riz · système non qualifié'} as Record<string,string>)[r.crop]??r.crop}));
 return {version:evidence.version,checkedOn:evidence.checkedOn,sourceManifestSha256:evidence.sourceManifestSha256,country:COUNTRIES[country].name,countryCode:country,cropId:cropId??null,calibrated:false,usedForPrediction:false,privateCampaignDataUsed:false,availability:coverage.filter(r=>r.country===country),coverage,soilContext:evidence.soilContext.find(r=>r.country===country),pilot:evidence.pilot,sources:evidence.sources.filter(s=>s.countries.includes(country)&&(!cropId||!s.crops.length||s.crops.includes(cropId))),limits:evidence.limits};
}
