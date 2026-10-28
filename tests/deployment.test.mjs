import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateDeployment, getRecoveryCheckpoint, deployCloudflare } from '../scripts/deploy-cloudflare.mjs';
import { healthEndpoint, smokeCloudflare } from '../scripts/smoke-cloudflare.mjs';

const databaseId = '12345678-1234-4123-8123-123456789abc';
const env = { CLOUDFLARE_API_TOKEN: 'test-only-token', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_DATABASE_ID: databaseId, CF_ACCESS_TEAM_DOMAIN: 'https://test.cloudflareaccess.com', CF_ACCESS_AUD: 'test-audience' };
const config = () => ({ name: 'agriprevision-togo', vars: { CF_ACCESS_TEAM_DOMAIN: env.CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD: env.CF_ACCESS_AUD }, d1_databases: [{ binding: 'DB', database_id: databaseId }] });
const goodHealth = { status: 'ok', database: 'ok', scientific: { forecastCount: 1092, notebookSha256: '0834a25e6a8da5f1daa075f0f0fdef26c16b6d810139aaefc511a3cd81693428', predictionCsvSha256: 'aaa4c8f734322ad21a1ef781b7ac10322915441a3e2f06f64633ecc01fa4e71d' } };
const access = { APP_URL: 'https://agri.example.workers.dev', CF_ACCESS_CLIENT_ID: 'test-client', CF_ACCESS_CLIENT_SECRET: 'test-secret' };

test('Publication : configuration réelle, base compilée et paramètres Access doivent concorder', () => {
  assert.equal(validateDeployment(env, config(), config()).databaseId, databaseId);
  assert.throws(() => validateDeployment({ ...env, CLOUDFLARE_API_TOKEN: '' }, config(), config()), /secret/);
  const placeholder = config(); placeholder.d1_databases[0].database_id = '00000000-0000-4000-8000-000000000000';
  assert.throws(() => validateDeployment(env, placeholder, placeholder), /identifiant réel/);
  const different = config(); different.d1_databases[0].database_id = '23456789-1234-4123-8123-123456789abc';
  assert.throws(() => validateDeployment(env, config(), different), /base compilée/);
  const demo = config(); demo.vars.AUTH_DEMO_ONLY = 'true';
  assert.throws(() => validateDeployment(env, demo, demo), /production/);
  const badAudience = config(); badAudience.vars.CF_ACCESS_AUD = 'other';
  assert.throws(() => validateDeployment(env, config(), badAudience), /CF_ACCESS_AUD/);
});

test('Restauration : point distant obligatoire avant toute mutation, aucun jeton dans les erreurs', async () => {
  let seen;
  const bookmark = await getRecoveryCheckpoint(env, databaseId, async (url, options) => { seen = { url, options }; return Response.json({ success: true, result: { bookmark: 'test-checkpoint' } }); });
  assert.equal(bookmark, 'test-checkpoint');
  assert.match(seen.url, /time_travel\/bookmark$/);
  assert.equal(seen.options.headers.Authorization, 'Bearer test-only-token');
  await assert.rejects(() => getRecoveryCheckpoint(env, databaseId, async () => new Response('private error text', { status: 403 })), error => !error.message.includes(env.CLOUDFLARE_API_TOKEN) && /Aucune migration/.test(error.message));
  await assert.rejects(() => getRecoveryCheckpoint(env, databaseId, async () => Response.json({ success: true, result: {} })), /sans point/);
});

async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'agri-deploy-'));
  await mkdir(join(root, '.cloudflare'));
  await mkdir(join(root, 'dist/server'), { recursive: true });
  for (const file of ['.cloudflare/wrangler.json', 'dist/server/wrangler.json']) await writeFile(join(root, file), JSON.stringify(config()));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test('Publication : ordre checkpoint → migrations → déploiement et fichier sans données personnelles', async () => {
  await fixture(async root => {
    const calls = [];
    const result = await deployCloudflare({ root, env, now: () => new Date('2026-10-28T12:00:00Z'), fetchImpl: async () => { calls.push('checkpoint'); return Response.json({ success: true, result: { bookmark: 'test-checkpoint' } }); }, run: async args => calls.push(args[0]) });
    assert.deepEqual(calls, ['checkpoint', 'd1', 'deploy']);
    assert.equal(result.status, 'deployed');
    const saved = await readFile(join(root, '.cloudflare/predeploy-bookmark.json'), 'utf8');
    assert.ok(saved.includes('test-checkpoint'));
    assert.ok(!saved.includes(env.CLOUDFLARE_API_TOKEN));
  });
});

test('Publication : échec checkpoint ou migration bloque la publication', async () => {
  await fixture(async root => {
    const calls = [];
    await assert.rejects(() => deployCloudflare({ root, env, fetchImpl: async () => new Response('', { status: 403 }), run: async args => calls.push(args[0]) }));
    assert.deepEqual(calls, []);
    await assert.rejects(() => deployCloudflare({ root, env, fetchImpl: async () => Response.json({ success: true, result: { bookmark: 'test' } }), run: async args => { calls.push(args[0]); throw new Error('migration test failed'); } }), /migration test failed/);
    assert.deepEqual(calls, ['d1']);
  });
});

test('Smoke : absence de secrets = SKIPPED explicite, pas un succès fictif', async () => {
  let called = false;
  assert.equal((await smokeCloudflare({ env: {}, fetchImpl: async () => { called = true; } })).status, 'SKIPPED');
  assert.equal(called, false);
  await assert.rejects(() => smokeCloudflare({ env: { CF_ACCESS_CLIENT_ID: 'only-one' } }), /ensemble/);
});

test('Smoke : cible HTTPS sans identifiant ni URL détournée', () => {
  assert.equal(healthEndpoint(access.APP_URL), 'https://agri.example.workers.dev/api/health');
  for (const url of ['http://agri.test', 'https://name:secret@agri.test', 'https://agri.test/path', 'https://agri.test/?token=private']) assert.throws(() => healthEndpoint(url));
});

test('Smoke : une connexion HTML, une redirection et une référence différente échouent', async () => {
  for (const response of [new Response('', { status: 302 }), new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }), Response.json({ ...goodHealth, database: 'error' }), Response.json({ ...goodHealth, scientific: { ...goodHealth.scientific, forecastCount: 1 } })]) await assert.rejects(() => smokeCloudflare({ env: access, fetchImpl: async () => response }));
});

test('Smoke : preuve JSON v24 et D1 vérifiée, service limité au contrôle de santé', async () => {
  const result = await smokeCloudflare({ env: access, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://agri.example.workers.dev/api/health');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers['CF-Access-Client-Secret'], 'test-secret');
    return Response.json(goodHealth);
  } });
  assert.equal(result.status, 'PASS');
  assert.match(result.scope, /Aucun parcours utilisateur humain/);
});
