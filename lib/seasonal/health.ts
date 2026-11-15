import {COUNTRIES} from './types.ts';
import {YIELD_VERSION,SEASONAL_KY} from './yield.ts';
import {NASA_VERSION} from './nasa.ts';
import {SALINITY_VERSION} from './salinity.ts';
import {historicalContext,NATIONAL_CONTEXT_COUNTRIES} from './historical-context.ts';
import {encodeCampaignValue,decodeCampaignValue} from './storage.ts';
import {numericalProbe} from './numerical-probe.ts';
export {numericalProbe} from './numerical-probe.ts';
export function seasonalHealth(){
 const reference=NATIONAL_CONTEXT_COUNTRIES.map(c=>historicalContext(c,'maize',new Date().toISOString().slice(0,10)));
 if(reference.some(r=>r.status!=='context_only'||!r.rows.length))throw new Error('Référence nationale saisonnière absente.');
 const sample='probe'.repeat(25000),packed=encodeCampaignValue({sample});
 if(decodeCampaignValue(packed).sample!==sample)throw new Error('Codec de sauvegarde saisonnière indisponible.');
 return {version:'source-models-2026-10-31',numericalProbe:numericalProbe(),yield:YIELD_VERSION,nasa:NASA_VERSION,salinity:SALINITY_VERSION,kyCrops:Object.keys(SEASONAL_KY).length,nationalCountries:reference.length,monitoringCountries:Object.keys(COUNTRIES).length,missingNationalCountries:Object.keys(COUNTRIES).filter(c=>!NATIONAL_CONTEXT_COUNTRIES.includes(c as keyof typeof COUNTRIES)),nationalVersion:reference[0].version,nationalArchiveSha256:reference[0].archiveSha256,storage:'ok'};
}
