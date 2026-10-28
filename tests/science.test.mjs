import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseCSV} from '../lib/server-import.ts';
const science=JSON.parse(readFileSync(new URL('../public/scientific-data.json',import.meta.url),'utf8'));
const csvBytes=readFileSync(new URL('../public/scientific/predictions_2016_2027.csv',import.meta.url));
const readCSV=path=>{const [header,...rows]=parseCSV(readFileSync(new URL(path,import.meta.url),'utf8'));return rows.map(row=>Object.fromEntries(header.map((h,i)=>[h,row[i]])));};
const source=readCSV('../public/scientific/predictions_2016_2027.csv');
const lineage=readCSV('../public/scientific/forecast_input_lineage.csv');
const key=r=>`${r.crop}|${r.territory}|${r.level}|${r.year}`;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);

test('science v24: CSV identique à l’empreinte de la sortie exécutée du notebook',()=>{
 const expected='aaa4c8f734322ad21a1ef781b7ac10322915441a3e2f06f64633ecc01fa4e71d';
 assert.equal(createHash('sha256').update(csvBytes).digest('hex'),expected);assert.equal(science.meta.forecastCsvSha256,expected);assert.equal(science.meta.sourceNotebookPredictionSha256,expected);assert.match(science.meta.notebook,/v24/);
});
test('science v24: 1092 prévisions, 91 séries, 4 cultures et années 2016–2027',()=>{
 assert.equal(science.forecasts.length,1092);assert.equal(science.observations.length,2116);assert.equal(new Set(science.forecasts.map(key)).size,1092);assert.equal(new Set(science.forecasts.map(r=>`${r.crop}|${r.territory}|${r.level}`)).size,91);
 assert.deepEqual([...new Set(science.forecasts.map(r=>r.crop))].sort(),['Maize','Millet','Rice','Sorghum']);
 assert.deepEqual([...new Set(science.forecasts.map(r=>r.year))].sort((a,b)=>a-b),Array.from({length:12},(_,i)=>2016+i));
 assert.equal(science.meta.isDemo,false);assert.equal(science.meta.operationallyValidated,false);assert.equal(science.meta.hasStatisticalIntervals,false);
});
test('science v24: chaque valeur affichée concorde avec son CSV source figé',()=>{
 const byKey=new Map(source.map(r=>[`${r.crop}|${r.prefecture_modele_35}|${r.geographical_level==='national'?'National':'Préfecture historique'}|${r.forecast_year}`,r]));
 for(const f of science.forecasts){const row=byKey.get(key(f));assert.ok(row,key(f));close(f.yield,Number(row.prediction_t_ha));assert.equal(f.model,row.model);assert.equal(f.sourceLineage,row.source_lineage);assert.equal(f.originYear,2015);assert.equal(f.cutoffYear,2015);assert.equal(f.horizonYears,f.year-2015);assert.equal(f.intervalStatus,'NOT_CALIBRATED_NO_NOMINAL_COVERAGE');assert.ok(Number.isFinite(f.yield)&&f.yield>=0);}
});
test('science v24: toutes les entrées de filiation sont antérieures ou égales à 2015',()=>{
 assert.ok(lineage.length>0);const keys=new Set(lineage.map(r=>r.source_lineage));for(const row of lineage){assert.ok(Number(row.input_year)<=2015);assert.ok(Number.isFinite(Number(row.input_value_t_ha)));assert.match(row.raw_file_sha256,/^[a-f0-9]{64}$/);}for(const f of science.forecasts)assert.ok(keys.has(f.sourceLineage));
});
test('science v24: 28 paires nationales principales, 8 diagnostics séparés',()=>{
 const primary=science.comparisons.filter(c=>c.compatibleForMetrics===true),diagnostic=science.comparisons.filter(c=>c.compatibleForMetrics!==true);
 assert.equal(primary.length,28);assert.equal(diagnostic.length,8);assert.deepEqual([...new Set(primary.map(c=>c.year))].sort(),[2016,2017,2018,2019,2020,2021,2022]);
 const observations=new Map(science.observations.map(x=>[key(x),x])),forecasts=new Map(science.forecasts.map(x=>[x.id,x]));
 for(const c of science.comparisons){assert.equal(c.level,'National');const observation=observations.get(key(c)),forecast=forecasts.get(c.forecastId);assert.ok(observation);assert.ok(forecast);close(c.prediction,forecast.yield);close(c.observation,observation.yield);assert.equal(c.areaDefinition,observation.areaDefinition);assert.equal(c.areaDefinition,forecast.areaDefinition);assert.equal(c.labelCutoff,2015);if(c.compatibleForMetrics)assert.match(observation.observationStatus,/^A:/);else assert.match(c.comparisonLimitation,/diagnostic/);}
});

test('science v24: MAE/RMSE/biais recalculés identiques aux métriques du système sélectionné',()=>{const metrics=readCSV('../public/scientific/model_comparison.csv').filter(r=>r.model==='selected_system'&&r.geographic_level==='national'&&r.grouping==='all');assert.equal(metrics.length,4);for(const row of metrics){const pairs=science.comparisons.filter(c=>c.crop===row.crop&&c.compatibleForMetrics===true),errors=pairs.map(c=>c.prediction-c.observation);assert.equal(errors.length,Number(row.n));close(errors.reduce((s,x)=>s+Math.abs(x),0)/errors.length,Number(row.mae));close(Math.sqrt(errors.reduce((s,x)=>s+x*x,0)/errors.length),Number(row.rmse));close(errors.reduce((s,x)=>s+x,0)/errors.length,Number(row.bias));}});
