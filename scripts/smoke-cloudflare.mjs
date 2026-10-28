import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXPECTED_NOTEBOOK = '0834a25e6a8da5f1daa075f0f0fdef26c16b6d810139aaefc511a3cd81693428';
const EXPECTED_PREDICTIONS = 'aaa4c8f734322ad21a1ef781b7ac10322915441a3e2f06f64633ecc01fa4e71d';

export function healthEndpoint(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('APP_URL doit être l’URL HTTPS réelle du Worker publié.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('APP_URL doit être une origine HTTPS, sans identifiant, chemin, requête ou fragment.');
  return new URL('/api/health', url).href;
}

export async function smokeCloudflare({ env = process.env, fetchImpl = fetch } = {}) {
  const id = env.CF_ACCESS_CLIENT_ID?.trim();
  const secret = env.CF_ACCESS_CLIENT_SECRET?.trim();
  if (!id && !secret) return { status: 'SKIPPED', reason: 'Secrets Access de service absents : la santé du déploiement n’a pas été vérifiée automatiquement. Vérifiez le parcours avec un compte humain autorisé.' };
  if (!id || !secret) throw new Error('CF_ACCESS_CLIENT_ID et CF_ACCESS_CLIENT_SECRET doivent être configurés ensemble.');
  const endpoint = healthEndpoint(env.APP_URL);
  const response = await fetchImpl(endpoint, {
    headers: { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret, Accept: 'application/json' },
    redirect: 'manual', signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Contrôle de santé refusé ou inaccessible (HTTP ${response.status}). Une redirection de connexion n’est pas un test réussi.`);
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Le serveur n’a pas retourné de JSON : une page de connexion ne valide pas le déploiement.');
  const health = await response.json();
  if (health.status !== 'ok' || health.database !== 'ok' || health.scientific?.forecastCount !== 1092 || health.scientific?.notebookSha256 !== EXPECTED_NOTEBOOK || health.scientific?.predictionCsvSha256 !== EXPECTED_PREDICTIONS) throw new Error('La santé, la base D1 ou la référence scientifique v24 ne concorde pas avec le déploiement attendu.');
  return { status: 'PASS', scope: 'Réponse JSON authentifiée de /api/health : runtime, base D1 et identifiants scientifiques v24. Aucun parcours utilisateur humain n’est simulé.' };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  smokeCloudflare().then(async result => {
    const message = result.status === 'PASS' ? `Contrôle de santé réussi. ${result.scope}` : result.reason;
    if (result.status === 'SKIPPED') console.warn(`::warning::${message}`);
    else console.log(message);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n### Vérification après publication : ${result.status}\n${message}\n`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
