import type { Country, SeasonalConfig } from './types.ts';
import { CATALOG_VERSION, cropById } from './catalog.ts';
import { AGRONOMY_SOURCES } from './sources.ts';
export type NutritionReference = {id:string;cropId:string;country:Country;territories:string[]|null;system:SeasonalConfig['systemDomain'];varieties?:string[];scope:string;sourceId:string;products:{name:string;kgHa:number[];npkPercent:(number|null)[];timing:string}[];notes:string[]};
/** Historical institutional recipes, read as scoped references, not prescriptions. */
export const NUTRITION_REFERENCES:NutritionReference[] = [
  {
    "id": "tgo-kozah-maize",
    "cropId": "maize",
    "country": "TGO",
    "territories": [
      "Kozah"
    ],
    "system": "upland",
    "scope": "Préfecture de la Kozah ; fumure minérale nouvelle du tableau p.6, produits existants, fiche de mars 2021.",
    "sourceId": "fertitogo-kozah",
    "products": [
      {
        "name": "NPK 15-15-15",
        "kgHa": [
          250,
          250
        ],
        "npkPercent": [
          15,
          15,
          15
        ],
        "timing": "10–15 jours après semis."
      },
      {
        "name": "Urée 46 % N — teneur à vérifier sur le sac",
        "kgHa": [
          100,
          100
        ],
        "npkPercent": [
          46,
          0,
          0
        ],
        "timing": "40–45 jours après semis."
      }
    ],
    "notes": [
      "Référence territoriale de 2021, à réexaminer avec un conseiller et le sol actuel. Les formules hypothétiques 14-18-23 ne sont pas retenues.",
      "L’objectif de rendement de la fiche n’est pas une prévision de récolte."
    ]
  },
  {
    "id": "tgo-kozah-sorghum",
    "cropId": "sorghum",
    "country": "TGO",
    "territories": [
      "Kozah"
    ],
    "system": "upland",
    "scope": "Préfecture de la Kozah ; fumure minérale nouvelle du tableau p.6, produits existants, fiche de mars 2021.",
    "sourceId": "fertitogo-kozah",
    "products": [
      {
        "name": "NPK 15-15-15",
        "kgHa": [
          250,
          250
        ],
        "npkPercent": [
          15,
          15,
          15
        ],
        "timing": "Au premier sarclage."
      },
      {
        "name": "Urée 46 % N — teneur à vérifier sur le sac",
        "kgHa": [
          100,
          100
        ],
        "npkPercent": [
          46,
          0,
          0
        ],
        "timing": "Vers 40 jours après semis."
      }
    ],
    "notes": [
      "Référence territoriale de 2021, à réexaminer avec un conseiller et le sol actuel. Les formules hypothétiques 14-18-23 ne sont pas retenues.",
      "L’objectif de rendement de la fiche n’est pas une prévision de récolte."
    ]
  },
  {
    "id": "tgo-kozah-sesame",
    "cropId": "sesame",
    "country": "TGO",
    "territories": [
      "Kozah"
    ],
    "system": "upland",
    "scope": "Kozah, itinéraire d’entretien p.4, mars 2021.",
    "sourceId": "fertitogo-kozah",
    "products": [
      {
        "name": "NPK 15-15-15",
        "kgHa": [
          50,
          100
        ],
        "npkPercent": [
          15,
          15,
          15
        ],
        "timing": "21 jours après semis."
      },
      {
        "name": "Urée 46 % N — teneur à vérifier sur le sac",
        "kgHa": [
          25,
          25
        ],
        "npkPercent": [
          46,
          0,
          0
        ],
        "timing": "40 jours après semis."
      }
    ],
    "notes": [
      "La plage NPK dépend du contexte ; aucune borne n’est choisie automatiquement."
    ]
  },
  {
    "id": "civ-fmb-maize",
    "varieties": ["FMB"],
    "cropId": "maize",
    "country": "CIV",
    "territories": null,
    "system": "upland",
    "scope": "Variété FMB ; maïs pluvial, zones humides et subhumides décrites par la fiche FeSeRWAM.",
    "sourceId": "feserwam-civ-fmb",
    "products": [
      {
        "name": "NPK 15-15-15",
        "kgHa": [
          250,
          250
        ],
        "npkPercent": [
          15,
          15,
          15
        ],
        "timing": "Au semis ou au plus tard deux semaines après."
      },
      {
        "name": "Urée 46 % N — teneur à vérifier sur le sac",
        "kgHa": [
          150,
          150
        ],
        "npkPercent": [
          46,
          0,
          0
        ],
        "timing": "30–35 jours après semis."
      }
    ],
    "notes": [
      "Ne pas transférer cette fiche à toute variété ou tout sol de Côte d’Ivoire.",
      "Variété annoncée 85–90 jours : ce cycle diffère de l’exemple hydrique FAO Nigeria de 125 jours. Renseigner les phases locales avant de combiner les deux références."
    ]
  },
  {
    "id": "gha-maize-23-10-5",
    "cropId": "maize",
    "country": "GHA",
    "territories": null,
    "system": "upland",
    "scope": "Manuel Ghana 2025, tableau 6 p.19 imprimée (PDF p.27) ; contexte de production et sol à confirmer localement.",
    "sourceId": "ghana-maize-2025",
    "products": [
      {
        "name": "NPK 23-10-5 + 2MgO + 3S + 0,3Zn",
        "kgHa": [
          247.10538146716533,
          247.10538146716533
        ],
        "npkPercent": [
          23,
          10,
          5
        ],
        "timing": "Fond à la plantation ou 10–14 jours après, sol humide."
      },
      {
        "name": "Urée 46 % N — teneur à vérifier sur le sac",
        "kgHa": [
          61.77634536679133,
          123.55269073358266
        ],
        "npkPercent": [
          46,
          0,
          0
        ],
        "timing": "35 jours après plantation ; alternative au sulfate d’ammonium, pas un ajout aux deux."
      }
    ],
    "notes": [
      "MgO distinct de Mg ; S et Zn supplémentaires à compter selon étiquette.",
      "Original : deux sacs de 50 kg par acre en fond ; ½ à 1 sac d’urée par acre. Conversion acre international = 4 046,8564224 m².",
      "La plage d’urée ne détermine pas une dose personnalisée."
    ]
  },
  {
    "id": "gha-maize-25-10-10",
    "cropId": "maize",
    "country": "GHA",
    "territories": null,
    "system": "upland",
    "scope": "Manuel Ghana 2025, tableau 6 p.19 imprimée (PDF p.27) ; contexte de production et sol à confirmer localement.",
    "sourceId": "ghana-maize-2025",
    "products": [
      {
        "name": "NPK 25-10-10 + 3S",
        "kgHa": [
          247.10538146716533,
          247.10538146716533
        ],
        "npkPercent": [
          25,
          10,
          10
        ],
        "timing": "Fond à la plantation ou 10–14 jours après, sol humide."
      },
      {
        "name": "Urée 46 % N — teneur à vérifier sur le sac",
        "kgHa": [
          61.77634536679133,
          123.55269073358266
        ],
        "npkPercent": [
          46,
          0,
          0
        ],
        "timing": "35 jours après plantation ; alternative au sulfate d’ammonium, pas un ajout aux deux."
      }
    ],
    "notes": [
      "Ne pas cumuler avec les deux autres engrais de fond alternatifs du tableau.",
      "Original : deux sacs de 50 kg par acre en fond ; ½ à 1 sac d’urée par acre. Conversion acre international = 4 046,8564224 m².",
      "La plage d’urée ne détermine pas une dose personnalisée."
    ]
  },
  {
    "id": "civ-soybean-tsp",
    "cropId": "soybean",
    "country": "CIV",
    "territories": null,
    "system": "upland",
    "scope": "Culture intensive ; rotation soja-riz ou soja-maïs. Fiche CNRA.",
    "sourceId": "cnra-soybean",
    "products": [
      {
        "name": "Triple superphosphate — composition à confirmer",
        "kgHa": [
          100,
          125
        ],
        "npkPercent": [
          null,
          null,
          null
        ],
        "timing": "Au semis."
      }
    ],
    "notes": [
      "Nodulation et inoculation compatibles à vérifier. La composition du TSP n’est pas supposée ; bilan nutritif indéterminé sans étiquette."
    ]
  },
  {
    "id": "civ-okra-short",
    "cropId": "okra",
    "country": "CIV",
    "territories": null,
    "system": "upland",
    "scope": "Gombo cycle court, référence minérale CNRA ; ne couvre pas automatiquement le cycle long.",
    "sourceId": "cnra-okra",
    "products": [
      {
        "name": "NPK 10-18-18",
        "kgHa": [
          250,
          250
        ],
        "npkPercent": [
          10,
          18,
          18
        ],
        "timing": "Avant semis, fumure de fond minérale."
      },
      {
        "name": "Urée 46 % N — teneur à vérifier sur le sac",
        "kgHa": [
          200,
          250
        ],
        "npkPercent": [
          46,
          0,
          0
        ],
        "timing": "30 jours après semis pour les cycles courts ; la fiche indique 60 jours pour les longs."
      }
    ],
    "notes": [
      "La fumure organique de fond est une alternative dans la fiche ; ne pas la cumuler automatiquement.",
      "Dose azotée élevée dans cette référence ancienne : révision agronomique locale nécessaire. Ce n’est pas une instruction immédiate."
    ]
  },
  {
    "id": "civ-rice-upland",
    "cropId": "rice-upland",
    "country": "CIV",
    "territories": null,
    "system": "upland",
    "scope": "Riz pluvial, NERICA1/2 et IDSA85, objectifs et régions variables selon CNRA.",
    "sourceId": "cnra-rice-upland",
    "products": [
      {
        "name": "NPK 12-24-18",
        "kgHa": [
          50,
          200
        ],
        "npkPercent": [
          12,
          24,
          18
        ],
        "timing": "Au semis."
      },
      {
        "name": "Urée 46 % N — teneur à vérifier sur le sac",
        "kgHa": [
          25,
          100
        ],
        "npkPercent": [
          46,
          0,
          0
        ],
        "timing": "Fractionnement et dose à définir ; exemple supérieur à 35 jours après semis."
      }
    ],
    "notes": [
      "Les plages sont des références liées au rendement et à la région ; les deux bornes ne sont pas un choix optimisé.",
      "Les exportations P/K par tonne de paddy ne sont pas des doses d’engrais. Les crédits biologiques illustrés sur la fiche ne sont pas importés automatiquement."
    ]
  }
];
export function nutritionEligibility(ref:NutritionReference,c:SeasonalConfig):string[] {
 const reasons:string[]=[];
 const profile=c.cropProfile?cropById(c.cropProfile.id):undefined;
 if(ref.country!==c.country)reasons.push('Pays différent de la référence.');
 if(ref.cropId!==profile?.id || profile.name!==c.crop || c.cropProfile?.version!==CATALOG_VERSION)reasons.push('Culture différente ou fiche culturale non choisie/obsolète.');
 if(ref.system!==c.systemDomain)reasons.push('Système de production différent.');
 if(ref.territories && !ref.territories.some(t=>t.toLocaleLowerCase('fr')===c.territory.trim().toLocaleLowerCase('fr')))reasons.push(`Territoire requis : ${ref.territories.join(', ')}.`);
 if(ref.varieties && !ref.varieties.some(v=>v.toLocaleLowerCase('fr')===c.variety.trim().toLocaleLowerCase('fr')))reasons.push(`Variété requise : ${ref.varieties.join(', ')}.`);
 return reasons;
}
/** Published product quantities, not a soil-response model. The two ends of a
 * range are arithmetic scenarios, not independent choices or calibrated bounds.
 * Already applied masses cover these exact products only, not all soil supply. */
export function referenceQuantities(id:string,c:SeasonalConfig,contextNote:string,alreadyKgHa:(number|null)[]=[]){
 const r=NUTRITION_REFERENCES.find(r=>r.id===id);
 if(!r)throw new Error('Référence nutritionnelle inconnue.');
 const reasons=nutritionEligibility(r,c);
 if(reasons.length)throw new Error(reasons.join(' '));
 if(typeof contextNote!=='string'||contextNote.trim().length<12||contextNote.length>1200)throw new Error('Précisez le contexte vérifié : zone, variété, sol et usage de cette référence (12 à 1200 caractères).');
 if(c.areaM2!==null && (typeof c.areaM2!=='number'||!Number.isFinite(c.areaM2)||c.areaM2<=0))throw new Error('Surface positive ou inconnue attendue.');
 if(!Array.isArray(alreadyKgHa)||alreadyKgHa.length>r.products.length)throw new Error('Apports réalisés incompatibles avec les produits de la référence.');
 const products=r.products.map((p,i)=>{
  const already=alreadyKgHa[i]??null;
  if(already!==null && (typeof already!=='number'||!Number.isFinite(already)||already<0))throw new Error('Masse déjà appliquée invalide.');
  const remainingKgHa=already===null?null:p.kgHa.map(v=>Math.max(0,v-already));
  return {...p,alreadyKgHa:already,parcelKg:c.areaM2===null?null:p.kgHa.map(v=>v*c.areaM2!/10000),remainingKgHa,remainingParcelKg:c.areaM2===null||remainingKgHa===null?null:remainingKgHa.map(v=>v*c.areaM2!/10000),excessKgHa:already===null?null:Math.max(0,already-p.kgHa[1])};
 });
 const nutrientKgHa=[0,1,2].map(k=>r.products.some(p=>p.npkPercent[k]===null)?null:[0,1].map(bound=>r.products.reduce((s,p)=>s+p.kgHa[bound]*p.npkPercent[k]!/100,0)));
 const source=AGRONOMY_SOURCES.find(s=>s.id===r.sourceId)!;
 return {reference:r,source,catalogVersion:CATALOG_VERSION,products,nutrientKgHa,status:'reference_conditionnelle' as const,personalizedToSoil:false as const,contextNote,
  limitations:['Les analyses chimiques sont conservées, mais aucune réponse sol–culture aux engrais n’est calibrée ici.', 'Les quantités restantes concernent les mêmes produits : les autres engrais, amendements et restitutions ne sont pas déduits automatiquement.', 'Les plages sont des scénarios arithmétiques ; elles ne définissent ni dose optimale ni intervalle prédictif.', 'Le bilan N–P₂O₅–K₂O ne comptabilise pas les autres éléments mentionnés sur le sac (MgO, S, Zn, etc.).']};
}
