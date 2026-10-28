import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../public/data/',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,root)));
test('observatoire: couverture et exclusions reflètent exactement les fichiers du catalogue',()=>{
 const catalog=read('catalog.json').datasets,info=read('workbench.json');
 const panel=catalog.find(d=>d.filename==='canonical_panel.csv');
 assert.equal(info.coverage.reduce((n,c)=>n+c.rows,0),panel.rows);
 assert.equal(info.quality.selected,panel.rows);
 assert.equal(info.quality.candidates-info.quality.selected,Object.values(info.quality.excluded).reduce((n,v)=>n+v,0));
 const models=read('model-candidates.json'),original=catalog.find(d=>d.filename==='candidates_all_forecasts.csv');
 assert.equal(models.length,original.rows);
 const full=original.parts.flatMap(p=>read(original.id+'/'+p));
 assert.deepEqual(models,full.map(r=>Object.fromEntries(Object.keys(models[0]).map(k=>[k,r[k]]))));
});
test('observatoire: géographies, filiation et archives complémentaires conservent leurs preuves',()=>{
 assert.equal(read('togo-map.geojson').features.length,35);
 const lineage=read('forecast_input_lineage-index.json');assert.ok(lineage.length);assert.ok(lineage.every(r=>Number(r.input_year)<=2015));
 for(const r of read('resources.json')){const bytes=gunzipSync(readFileSync(new URL(r.url.split('/').pop(),root)));assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256);assert.equal(bytes.length,r.bytes);}
 const catalog=read('catalog.json').datasets,profiles=read('profiles.json');assert.equal(Object.keys(profiles).length,catalog.length);
 assert.equal(profiles[catalog.find(d=>d.filename==='canonical_panel.csv').id].crops.length,6);
});
