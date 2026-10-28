import { session, canSee } from '@/lib/server-auth';
import { database, failure, HttpError } from '@/lib/server-db';
import { bundledScience,scienceFor } from '@/lib/server-science';
import { canonicalLevel } from '@/lib/server-import';
import { csvText } from '@/lib/calculations';
export async function GET(request: Request) {
    try {
        const p = new URL(request.url).searchParams, kind = p.get('kind') || 'forecast';let s:Awaited<ReturnType<typeof session>>|null=null;try{s=await session(request);}catch(error){if(!(error instanceof HttpError&&error.status===401&&['forecast','observation'].includes(kind)))throw error;}
        let rows: Record<string, any>[], columns: string[];
        if (kind === 'forecast' || kind === 'observation') {
            const science = s?await scienceFor(s):bundledScience();
            rows = (kind === 'forecast' ? science.forecasts : science.observations) as unknown as Record<string, any>[];
            columns = kind === 'forecast' ? ['id', 'crop', 'year', 'territory', 'level', 'yield', 'model', 'version', 'issuedAt', 'status', 'source', 'areaDefinition'] : ['id', 'crop', 'year', 'territory', 'level', 'yield', 'source', 'areaDefinition', 'observationStatus', 'comparabilityStatus', 'geographyStatus', 'primaryEvaluation', 'compatibleForMetrics', 'rawFile', 'rawRecord', 'rawSha256'];
        }
        else {
            if(!s)throw new HttpError(401,'Connectez-vous pour exporter les données communautaires.');
            if (!['member', 'simulation', 'collection', 'harvest', 'capacity'].includes(kind))
                throw new HttpError(400, 'Table inconnue.');
            const result = await database().prepare('SELECT * FROM business_records WHERE coop_id=? AND kind=? ORDER BY created_at').bind(s.coopId, kind).all<any>();
            rows = result.results.filter(r => canSee(s, r)).map(r => ({ id: r.id, ...JSON.parse(r.data), createdAt: r.created_at, updatedAt: r.updated_at }));
            columns = ['id', ...new Set(rows.flatMap(r => Object.keys(r)))].filter((v, i, a) => a.indexOf(v) === i && !['forecastSnapshot'].includes(v));
        }
        rows = rows.filter(r => ['crop', 'year', 'territory', 'version'].every(k => !p.get(k) || String(r[k]) === p.get(k))&&(!p.get('level')||canonicalLevel(String(r.level))===canonicalLevel(p.get('level')!)));
        return new Response(csvText(rows, columns), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="agriprevision-${kind}.csv"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    catch (e) {
        return failure(e);
    }
}
