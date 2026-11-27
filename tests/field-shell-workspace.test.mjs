import assert from 'node:assert/strict';
import test from 'node:test';
import {localFetch, setIdentity, closeHarness} from './support/local-route-harness.mjs';
import {testParcel} from './support/land-fixtures.mjs';

const origin = 'http://agri.test';
const date = new Date().toISOString().slice(0, 10);
const id = 'field-shell-real';
function request(body) {
  return localFetch(origin + '/api/seasonal', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin}, body: JSON.stringify(body)});
}

test('shared field workspace prepares reference campaigns and applies notebook revisions for the signed-in account', async () => {
  try {
    setIdentity({userId: 'field-shell-owner', displayName: 'Exploitante', email: 'owner@example.test'});
    const catalog = await (await request({action: 'campaign-crops'})).json();
    assert.ok(catalog.crops.some(crop => crop.id === 'millet' && crop.days > 0));
    const draft = await request({action: 'campaign-draft', cropId: 'millet', config: {
      name: 'Champ', territory: 'Togo', country: 'TGO', sowingDate: date, parcelGeometry: testParcel,
      soil: {source: 'Profil de test', layers: [{thicknessM: 1, thetaFC: .3, thetaWP: .12, initialTheta: null}]}
    }});
    const {config, error} = await draft.json();
    assert.equal(draft.status, 200, error);
    assert.equal(config.cropProfile.id, 'millet');
    assert.equal(config.soil.layers[0].initialTheta, null);
    assert.equal(config.system.sourceFlowM3h, null);
    assert.equal(config.fallback, null);
    const created = await request({action: 'save', id, expectedRevision: 0, config});
    const campaign = await created.json();
    assert.equal(created.status, 201, campaign.error);
    assert.equal(campaign.campaign.demo, false);
    const reopened=await (await localFetch(origin+'/api/seasonal?id='+encodeURIComponent(id))).json();
    assert.deepEqual(reopened.campaign.config.parcelGeometry,testParcel,'le GeoJSON WGS84 réel est relu depuis la révision Worker enregistrée');
    assert.ok(Number.isFinite(reopened.campaign.config.areaM2)&&reopened.campaign.config.areaM2>0,'la surface vient du calcul serveur de la géométrie');
    const listed = await (await localFetch(origin + '/api/seasonal')).json();
    assert.equal(listed.demo, false);
    assert.match(listed.decisionScope, /^[a-f0-9]{64}$/);
    const note = {action: 'field-note', id, expectedRevision: 1, note: {parameter: 'Levée', date, note: 'Comptage à poursuivre'}};
    const saved = await request(note);
    const savedData = await saved.json();
    assert.equal(saved.status, 200, savedData.error);
    assert.equal(savedData.campaign.revision, 2);
    assert.equal(savedData.campaign.config.agronomic.observations[0].source, 'Exploitante');
    assert.equal((await request(note)).status, 409);
    assert.equal((await request({action: 'field-index-image', id, date})).status, 400);
    setIdentity({userId: 'unrelated', displayName: 'Autre compte', email: 'other@example.test'});
    assert.equal((await request({...note, expectedRevision: 2})).status, 404);
    const other = await (await localFetch(origin + '/api/seasonal')).json();
    assert.notEqual(other.decisionScope, listed.decisionScope);
    assert.equal((await request({action: 'field-index-image', id, date, consent: true})).status, 404);
  } finally { closeHarness(); }
});
