import bundled from './scientific-data.json';
import type { Forecast, Science, Session } from './contracts';
import { database } from './server-db';
export function bundledScience(): Science { return bundled as unknown as Science; }
export async function scienceFor(s: Session): Promise<Science> { const science = bundledScience(); const imports = await database().prepare('SELECT data FROM scientific_forecasts WHERE coop_id=? ORDER BY created_at').bind(s.coopId).all<{
    data: string;
}>(); return { ...science, forecasts: [...science.forecasts, ...imports.results.map(r => JSON.parse(r.data) as Forecast)] }; }
