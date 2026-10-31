import {seasonalHealth} from '@/lib/seasonal/health';
import {database,json,failure} from '@/lib/server-db';
import {bundledScience} from '@/lib/server-science';
export async function GET(){try{await database().prepare('SELECT 1 AS ready').first();const science=bundledScience();return json({status:'ok',database:'ok',seasonal:seasonalHealth(),scientific:{forecastCount:science.forecasts.length,notebookSha256:science.meta.sha256,predictionCsvSha256:science.meta.forecastCsvSha256}})}catch(e){return failure(e)}}
