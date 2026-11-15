import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const campaign=readFileSync('app/campaign-workspace.css','utf8');
const home=readFileSync('components/agri/welcome.css','utf8');

test('campaign workspace and saved campaigns stay inside desktop and mobile gutters',()=>{
 assert.match(campaign,/\.campaign-shell \.seasonal-tool\.is-campaign-workspace\s*\{[^}]*width:\s*calc\(100%\s*-\s*40px\)[^}]*max-width:\s*1560px[^}]*margin:\s*18px auto/s);
 assert.match(campaign,/\.campaign-shell \.farmer-app-bar\s*\{[^}]*margin:\s*12px 14px 0[^}]*border-radius:\s*14px/s);
 assert.match(campaign,/\.campaign-shell \.recent-campaigns,[\s\S]*?width:min\(1120px,calc\(100% - 48px\)\)/);
 assert.match(campaign,/@media\(max-width:700px\)\s*\{[\s\S]*?width:calc\(100% - 20px\)[\s\S]*?\.campaign-shell \.recent-campaigns,[\s\S]*?width:calc\(100% - 28px\)/);
 assert.match(campaign,/\.seasonal-tool\.is-campaign-workspace:has\(\.recent-campaigns\) \.farmer-start-card\{margin-bottom:22px\}/);
});

test('field home centers saved parcels on a responsive two-pane map workspace',()=>{
 assert.match(home,/\.welcome-page\.field-home\.home-workspace\s*\{[^}]*height:calc\(100dvh - 160px\)[^}]*min-height:540px/s);
 assert.match(home,/\.home-workbench\{display:grid;grid-template-columns:minmax\(300px,352px\) minmax\(0,1fr\)[^}]*overflow:hidden/);
 assert.match(home,/\.field-overview-map-wrap\{position:absolute;inset:0\}/);
 assert.match(home,/\.field-map-layer-switch\{[^}]*position:absolute/);
 assert.match(home,/@media\(max-width:760px\)\{[\s\S]*?\.home-view-switch\{display:grid[\s\S]*?\.home-fields-panel\.mobile-hidden,\.home-map-panel\.mobile-hidden\{display:none\}/);
 assert.match(home,/@media\(max-width:760px\)\{[\s\S]*?\.home-map-mobile-card\{[^}]*display:flex/);
 assert.doesNotMatch(home,/home-coverage-map|west-africa-coverage/);
});
