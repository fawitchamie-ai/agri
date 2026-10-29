import type { WeatherDay } from './types.ts';
import { InputError } from './validation.ts';

/** Fixed endpoint, bounded horizon, no history silently turned into measurements. */
export async function loadForecast(latitude: number, longitude: number, timezone: string, fetcher: typeof fetch = fetch, issuedAt = new Date().toISOString()): Promise<{ weather: WeatherDay[]; attribution: string; retrievedAt: string }> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new InputError('Coordonnées invalides.');
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), timezone, daily: 'precipitation_sum,et0_fao_evapotranspiration', forecast_days: '16' }).toString();
  const res = await fetcher(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error('La météo est temporairement indisponible. Conservez les valeurs saisies ou un scénario explicite.');
  const data = await res.json() as any;
  const dates = data?.daily?.time;
  if (!Array.isArray(dates) || !dates.length || dates.length > 16 || data.daily_units?.precipitation_sum !== 'mm' || data.daily_units?.et0_fao_evapotranspiration !== 'mm') throw new Error('Format ou unités météo non reconnus.');
  const value = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
  return { weather: dates.map((date: string, i: number) => ({ date, rainMm: value(data.daily.precipitation_sum?.[i], 2000), et0Mm: value(data.daily.et0_fao_evapotranspiration?.[i], 30), status: 'forecast', source: 'Open-Meteo — prévisions de modèles, ET0 FAO ; aucune observation de champ', availableAt: issuedAt })),
    attribution: 'Données météo : Open-Meteo (CC BY 4.0), https://open-meteo.com/ . Accès gratuit soumis aux conditions du fournisseur ; usage commercial à vérifier avant activation.', retrievedAt: issuedAt };
}
