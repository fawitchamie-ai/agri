import assert from 'node:assert/strict';
import test from 'node:test';
import {redirectLegacyWebInterface} from '../worker/web-routes.ts';

test('root and legacy tools route to the web field workspace', () => {
  for (const path of ['/', '/outils', '/outils/', '/outils?entry=seasonal', '/outils/seasonal?entry=dashboard']) {
    const response = redirectLegacyWebInterface(new Request('https://agri.test' + path));
    assert.equal(response.status, 302, path);
    assert.equal(new URL(response.headers.get('Location')).pathname, '/field-workspace/');
    assert.equal(new URL(response.headers.get('Location')).search, '');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  }
});

test('old shared asset route maps to the web-only copy without losing asset paths', () => {
  const response = redirectLegacyWebInterface(new Request('https://agri.test/champs/js/carte.js?v=1'));
  const target = new URL(response.headers.get('Location'));
  assert.equal(target.pathname, '/field-workspace/js/carte.js');
  assert.equal(target.search, '?v=1');
  assert.equal(response.headers.get('X-Agri-Interface'), 'web-field-workspace');
});

test('API and new interface asset requests do not redirect', () => {
  for (const path of ['/api/seasonal', '/api/workspace', '/field-workspace/', '/field-workspace/js/carte.js']) {
    assert.equal(redirectLegacyWebInterface(new Request('https://agri.test' + path)), null, path);
  }
});

test('mutations cannot reach hidden legacy page handlers', () => {
  for (const path of ['/', '/outils', '/champs/js/carte.js']) {
    const response = redirectLegacyWebInterface(new Request('https://agri.test' + path, {method: 'POST'}));
    assert.equal(response.status, 405, path);
    assert.equal(response.headers.get('Allow'), 'GET, HEAD');
  }
});
