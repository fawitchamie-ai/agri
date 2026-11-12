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

test('home screen panels are framed with a responsive page gutter',()=>{
 assert.match(home,/\.welcome-page\.field-home\.home-workspace\s*\{[^}]*padding:clamp\(10px,1\.3vw,20px\)[^}]*gap:12px[^}]*overflow-x:hidden/s);
 assert.match(home,/\.home-topbar,[\s\S]*?\.home-workbench,[\s\S]*?\.home-footer\s*\{[^}]*width:min\(100%,1520px\)[^}]*margin-inline:auto[^}]*border-radius:14px/s);
 assert.doesNotMatch(home,/\.home-workbench\{[^}]*overflow:hidden/);
 assert.match(home,/@media\(max-width:700px\)\s*\{[\s\S]*?padding:9px[\s\S]*?\.home-topbar,[\s\S]*?border-radius:11px/s);
 assert.match(home,/@media\(max-width:380px\)\s*\{[\s\S]*?padding:7px/);
});
