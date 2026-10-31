import {COUNTRIES} from './types.ts';
import {YIELD_VERSION,SEASONAL_KY} from './yield.ts';
import {NASA_VERSION} from './nasa.ts';
import {SALINITY_VERSION} from './salinity.ts';
import {historicalContext} from './historical-context.ts';
import {encodeCampaignValue,decodeCampaignValue} from './storage.ts';
export function seasonalHealth(){
 const reference=Object.keys(COUNTRIES).map(c=>historicalContext(c as keyof typeof COUNTRIES,'maize',new Date().toISOString().slice(0,10)));
 if(reference.some(r=>r.status!=='context_only'||!r.rows.length))throw new Error('Référence nationale saisonnière absente.');
 const sample='probe'.repeat(25000),packed=encodeCampaignValue({sample});
 if(decodeCampaignValue(packed).sample!==sample)throw new Error('Codec de sauvegarde saisonnière indisponible.');
 return {version:'source-models-2026-10-31',yield:YIELD_VERSION,nasa:NASA_VERSION,salinity:SALINITY_VERSION,kyCrops:Object.keys(SEASONAL_KY).length,nationalCountries:reference.length,nationalVersion:reference[0].version,nationalArchiveSha256:reference[0].archiveSha256,storage:'ok'};
}
