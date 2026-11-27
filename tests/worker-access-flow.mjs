import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { unstable_splitSqlQuery } from 'wrangler';

// Run the built production Worker in workerd, with an isolated D1 database
// and a local signing key in place of the remote Cloudflare Access issuer.
const require = createRequire(import.meta.resolve('wrangler'));
const { Miniflare, createFetchMock } = require('miniflare');
const root = fileURLToPath(new URL('../', import.meta.url));
const server = join(root, 'dist/server');
const config = JSON.parse(await readFile(join(server, 'wrangler.json'), 'utf8'));
const issuer = 'https://agri-test.cloudflareaccess.com';
const audience = 'agri-test-audience';
const { privateKey, publicKey } = await generateKeyPair('RS256');
const key = { ...await exportJWK(publicKey), kid: 'test-access-key', alg: 'RS256' };
const fetchMock = createFetchMock();
fetchMock.disableNetConnect();
fetchMock.get(issuer).intercept({ method: 'GET', path: '/cdn-cgi/access/certs' })
  .reply(200, { keys: [key] }, { headers: { 'content-type': 'application/json' } });

const modules = (await readdir(server, { recursive: true }))
  .filter(path => path.endsWith('.js') && !path.startsWith('.'))
  .filter(path => path !== config.main);
const worker = new Miniflare({
  modules: [config.main, ...modules].map(path => ({ type: 'ESModule', path: join(server, path) })),
  modulesRoot: server,
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  bindings: { CF_ACCESS_TEAM_DOMAIN: issuer, CF_ACCESS_AUD: audience, AUTH_PUBLIC_DEMO: 'true' },
  d1Databases: ['DB'],
  assets: {
    directory: join(server, config.assets.directory),
    binding: 'ASSETS',
    routerConfig: { has_user_worker: true, static_routing: { user_worker: config.assets.run_worker_first } },
  },
  fetchMock,
});

const origin = 'https://agri.example.test';
const destination = '/field-workspace/?entry=seasonal&library=1#seasonal?section=images';
const loginPath = '/api/auth/login?' + new URLSearchParams({ returnTo: destination });
async function accessToken(subject, expiresIn = '5m') {
  return new SignJWT({ email: subject + '@example.test' })
    .setIssuer(issuer).setAudience(audience).setSubject(subject).setIssuedAt().setExpirationTime(expiresIn)
    .setProtectedHeader({ alg: 'RS256', kid: key.kid }).sign(privateKey);
}
function request(path, cookie, options = {}) {
  return worker.dispatchFetch(new URL(path, origin), {
    ...options,
    redirect: 'manual',
    headers: { ...(cookie ? { cookie } : {}), ...options.headers },
  });
}
function post(path, cookie, body) {
  return request(path, cookie, {
    method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body),
  });
}

try {
  const db = await worker.getD1Database('DB');
  for (const name of (await readdir(join(root, 'drizzle'))).filter(name => name.endsWith('.sql')).sort()) {
    const sql = await readFile(join(root, 'drizzle', name), 'utf8');
    await db.batch(unstable_splitSqlQuery(sql).map(statement => db.prepare(statement)));
  }

  const emptyLogin = await request(loginPath);
  const emptyLoginBody = await emptyLogin.text();
  assert.equal(emptyLogin.status, 503, emptyLoginBody.slice(0, 200));
  assert.match(emptyLoginBody, /La connexion n’a pas abouti/);
  assert.equal((await request('/api/workspace')).status, 401);

  const user = await accessToken('farm-owner');
  const sessionCookie = 'CF_Authorization=' + user;
  const authorizedReturn = await request(loginPath, sessionCookie);
  assert.equal(authorizedReturn.status, 302);
  assert.equal(authorizedReturn.headers.get('location'), destination);
  assert.match(authorizedReturn.headers.get('cache-control'), /no-store/);
  const signedByEdge = await request(loginPath, null, { headers: { 'cf-access-jwt-assertion': user } });
  assert.equal(signedByEdge.status, 302);
  const workspace = await request(destination, sessionCookie);
  assert.equal(workspace.status, 200);
  assert.match(await workspace.text(), /Mes champs/);
  const oldWorkspace = await request('/champs/', sessionCookie);
  assert.equal(oldWorkspace.status, 302);
  assert.equal(oldWorkspace.headers.get('location'), origin + '/field-workspace/');
  const oldTools = await request('/outils?entry=seasonal', sessionCookie);
  assert.equal(oldTools.status, 302);
  assert.equal(oldTools.headers.get('location'), origin + '/field-workspace/');
  const homepage = await request('/', sessionCookie);
  assert.equal(homepage.status, 302);
  assert.equal(homepage.headers.get('location'), origin + '/field-workspace/');

  const session = await request('/api/workspace', sessionCookie + '; agri_demo=stale');
  assert.equal(session.status, 200);
  assert.match(session.headers.get('set-cookie'), /agri_demo=;.*Max-Age=0/);
  assert.equal((await session.json()).session.demo, false);
  const campaigns = await request('/api/seasonal', sessionCookie);
  assert.equal(campaigns.status, 200);
  assert.deepEqual((await campaigns.json()).campaigns, []);

  const draft = await post('/api/seasonal', sessionCookie, {
    action: 'campaign-draft', cropId: 'millet', config: {
      name: 'Campagne de test', territory: 'Togo', country: 'TGO', sowingDate: new Date().toISOString().slice(0, 10),
      parcelGeometry: { type: 'Polygon', coordinates: [[[1.2, 9.5], [1.2004, 9.5], [1.2004, 9.5004], [1.2, 9.5004], [1.2, 9.5]]] },
      soil: { source: 'Test local', layers: [{ thicknessM: 1, thetaFC: 0.3, thetaWP: 0.12, initialTheta: null }] },
    },
  });
  const draftData = await draft.json();
  assert.equal(draft.status, 200, draftData.error);
  const created = await post('/api/seasonal', sessionCookie, { action: 'save', id: 'auth-qa', expectedRevision: 0, config: draftData.config });
  const createdData = await created.json();
  assert.equal(created.status, 201, createdData.error);
  const listed = await (await request('/api/seasonal', sessionCookie)).json();
  assert.ok(listed.campaigns.some(campaign => campaign.id === 'auth-qa'));

  const response = await post('/api/workspace', sessionCookie, {
    kind: 'member', data: { name: 'Membre de test', locality: 'Localité de test' },
  });
  assert.equal(response.status, 201);
  const { record } = await response.json();
  const reload = await (await request('/api/workspace', sessionCookie)).json();
  assert.ok(reload.records.some(item => item.id === record.id));
  const outsider = 'CF_Authorization=' + await accessToken('other-account');
  const otherWorkspace = await (await request('/api/workspace', outsider)).json();
  assert.ok(!otherWorkspace.records.some(item => item.id === record.id));
  assert.equal((await request('/api/seasonal?id=auth-qa', outsider)).status, 404);

  const expired = 'CF_Authorization=' + await accessToken('farm-owner', '-1m');
  assert.equal((await request('/api/seasonal', expired)).status, 401);
  assert.equal((await request(loginPath, expired)).status, 503);
  console.log('Worker compilé : retour Access, outils, APIs, écriture D1, isolation et expiration vérifiés.');
} finally {
  await worker.dispose();
}
