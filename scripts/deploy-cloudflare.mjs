import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCOUNT = /^[0-9a-f]{32}$/i;
const PLACEHOLDER = '00000000-0000-4000-8000-000000000000';

export function validateDeployment(env, source, built) {
  if (!env.CLOUDFLARE_API_TOKEN?.trim()) throw new Error('CLOUDFLARE_API_TOKEN est absent. Configurez le secret GitHub, sans le publier.');
  if (!ACCOUNT.test(env.CLOUDFLARE_ACCOUNT_ID || '')) throw new Error('CLOUDFLARE_ACCOUNT_ID est absent ou invalide.');
  const original = source.d1_databases?.find(binding => binding.binding === 'DB');
  const output = built.d1_databases?.find(binding => binding.binding === 'DB');
  const databaseId = original?.database_id;
  if (!UUID.test(databaseId || '') || databaseId === PLACEHOLDER) throw new Error('La base D1 de production doit être configurée avec son identifiant réel.');
  if (databaseId !== env.CLOUDFLARE_DATABASE_ID || output?.database_id !== databaseId) throw new Error('La base compilée ne correspond pas à la base de production configurée.');
  if (!source.name || built.name !== source.name) throw new Error('Le Worker compilé ne correspond pas au Worker configuré.');
  for (const field of ['CF_ACCESS_TEAM_DOMAIN', 'CF_ACCESS_AUD']) {
    if (!source.vars?.[field] || source.vars[field] !== env[field] || built.vars?.[field] !== source.vars[field]) throw new Error(`La configuration ${field} doit correspondre au build publié.`);
  }
  if (String(source.vars?.AUTH_DEMO_ONLY).toLowerCase() === 'true' || String(built.vars?.AUTH_DEMO_ONLY).toLowerCase() === 'true') throw new Error('Le mode local sans identité ne peut pas être publié en production.');
  return { databaseId, workerName: source.name };
}

/** Records a provider recovery point; never exports community rows to Actions artifacts. */
export async function getRecoveryCheckpoint(env, databaseId, fetchImpl = fetch) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/time_travel/bookmark`;
  const response = await fetchImpl(endpoint, {
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Le point de restauration D1 n’a pas été obtenu (HTTP ${response.status}). Aucune migration ni publication exécutée.`);
  const data = await response.json();
  if (data.success !== true || typeof data.result?.bookmark !== 'string' || !data.result.bookmark) throw new Error('Réponse D1 sans point de restauration. Aucune migration ni publication exécutée.');
  return data.result.bookmark;
}

function runWrangler(args, root, env) {
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), ...args], {
      cwd: root, env: { ...env, CI: 'true' }, stdio: 'inherit', shell: false,
    });
    child.once('error', () => reject(new Error('Impossible de lancer Wrangler.')));
    child.once('exit', code => code === 0 ? accept() : reject(new Error(`Wrangler a interrompu l’étape ${args.slice(0, 3).join(' ')} (code ${code}).`)));
  });
}

export async function deployCloudflare({ root = projectRoot, env = process.env, fetchImpl = fetch, run = runWrangler, now = () => new Date() } = {}) {
  const configPath = resolve(root, '.cloudflare/wrangler.json');
  const buildPath = resolve(root, 'dist/server/wrangler.json');
  const source = JSON.parse(await readFile(configPath, 'utf8'));
  const built = JSON.parse(await readFile(buildPath, 'utf8'));
  const { databaseId, workerName } = validateDeployment(env, source, built);
  const bookmark = await getRecoveryCheckpoint(env, databaseId, fetchImpl);
  const before = now().toISOString();
  const metadata = { workerName, databaseId, bookmark, before, commit: env.GITHUB_SHA || null };
  await mkdir(resolve(root, '.cloudflare'), { recursive: true, mode: 0o700 });
  await writeFile(resolve(root, '.cloudflare/predeploy-bookmark.json'), JSON.stringify(metadata, null, 2) + '\n', { mode: 0o600 });
  // The timestamp is sufficient to request a Time Travel restoration within provider retention.
  // No token, bookmark, personal row, or full SQL backup is printed to public repository logs.
  console.log(`Point de restauration D1 vérifié avant migration : ${before}.`);
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, `\n### Déploiement Cloudflare\nPoint de restauration D1 vérifié avant migration : ${before} (UTC).\nAucune donnée communautaire n’est déposée dans les artifacts GitHub.\n`);
  await run(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', configPath], root, env);
  await run(['deploy', '--config', buildPath], root, env);
  await writeFile(resolve(root, '.cloudflare/deployment.json'), JSON.stringify({ ...metadata, status: 'deployed', deployedAt: now().toISOString() }, null, 2) + '\n', { mode: 0o600 });
  console.log('Publication terminée. La vérification authentifiée de santé est une étape distincte.');
  return { status: 'deployed', before, workerName };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  deployCloudflare().catch(error => { console.error(error.message); process.exitCode = 1; });
}
