import test from 'node:test';
import assert from 'node:assert/strict';
import {finiteNonnegative,tonnes,production,observedYield,weightedYield,pairedMetrics,collectionTotals,csvCell,csvText} from '../lib/calculations.ts';

test('unités: kg et sacs explicitement pondérés en tonnes',()=>{assert.equal(tonnes(1500,'kg'),1.5);assert.equal(tonnes(30,'sac',50),1.5);assert.equal(tonnes(20,'sac',75),1.5);assert.equal(tonnes(0,'kg'),0);assert.throws(()=>tonnes(10,'sac',0));assert.throws(()=>tonnes(10,'lb'));});
test('production et rendement: unités cohérentes et superficie non nulle',()=>{assert.equal(production(1.5,4),6);assert.equal(observedYield(6,4),1.5);assert.equal(observedYield(0,4),0);assert.throws(()=>observedYield(6,0));for(const x of [NaN,Infinity,-1,null,undefined,'',true,false,[],{}])assert.throws(()=>finiteNonnegative(x));});
test('agrégation: ratio sommes productions/surfaces, pas moyenne rendements',()=>{assert.equal(weightedYield([{productionT:2,area:1},{productionT:9,area:9}]),1.1);assert.equal(weightedYield([]),null);assert.throws(()=>weightedYield([{productionT:1,area:-1}]));});
test('comparaison: erreurs signées, MAE, RMSE, biais et observation nulle',()=>{const m=pairedMetrics([{prediction:3,observation:1},{prediction:1,observation:2},{prediction:0,observation:0}]);assert.equal(m.n,3);assert.equal(m.mae,1);assert.equal(m.bias,1/3);assert.equal(m.rmse,Math.sqrt(5/3));assert.equal(m.relativeN,2);assert.equal(m.mape,125);assert.deepEqual(pairedMetrics([]),{n:0,mae:null,rmse:null,bias:null,mape:null,relativeN:0});assert.equal(pairedMetrics([{prediction:1,observation:0}]).mape,null);});
test('collecte: ne jamais additionner les quatre étapes du même volume',()=>{assert.deepEqual(collectionTotals([{estimated:10,declared:8,committed:7,collected:6},{estimated:2,declared:1,collected:1}]),{estimated:12,declared:9,committed:7,collected:7});});
test('CSV: cellules échappées et formules désamorcées',()=>{assert.equal(csvCell('a"b'),'"a""b"');assert.equal(csvCell('=HYPERLINK("https://a")'),'"\'=HYPERLINK(""https://a"")"');assert.equal(csvCell('  @SUM(1)'),'"\'  @SUM(1)"');assert.ok(csvText([{a:0,b:null}],['a','b']).includes('"0",""'));});

test('extrêmes numériques: dépassement refusé avant stockage',()=>{assert.throws(()=>production(1e308,1e308));assert.throws(()=>tonnes(1e308,'sac',1e308));assert.throws(()=>observedYield(1e308,1e-308));});
