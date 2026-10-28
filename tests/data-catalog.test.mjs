import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const base=new URL('../public/',import.meta.url),catalog=JSON.parse(readFileSync(new URL('./data/catalog.json',base)));
test('catalogue: chaque fichier source est téléchargeable et son empreinte est exacte',()=>{
 for(const d of catalog.datasets){const bytes=gunzipSync(readFileSync(new URL('.'+d.download,base)));assert.equal(createHash('sha256').update(bytes).digest('hex'),d.sha256,d.filename);assert.equal(bytes.length,d.bytes);}
});
test('catalogue: pagination complète, lignes exclues et modèles candidats conservés',()=>{
 for(const d of catalog.datasets){let count=0;for(const part of d.parts){const rows=JSON.parse(readFileSync(new URL(`./data/${d.id}/${part}`,base)));assert.ok(rows.length<=500);count+=rows.length;}assert.equal(count,d.rows,d.filename)}
 for(const name of ['canonical_panel.csv','source_candidates.csv','source_exclusions.csv','candidates_all_forecasts.csv','forecast_input_lineage.csv','hvstat_africa_data_v1.2.csv','crop_data.csv'])assert.ok(catalog.datasets.some(d=>d.filename===name),name);
 assert.equal(catalog.datasets.find(d=>d.filename==='predictions_2016_2027.csv').sha256,catalog.referenceForecastSha256);
});
