import {performance} from 'node:perf_hooks';
import {readFileSync} from 'node:fs';
import {pairedMetrics,collectionTotals,weightedYield} from '../lib/calculations.ts';
const count=100_000;
const pairs=Array.from({length:count},(_,i)=>({prediction:1+(i%80)/100,observation:1+(i%70)/100}));
const business=Array.from({length:count},(_,i)=>({estimated:2,declared:1.8,committed:1.5,collected:1.2,productionT:1+(i%40),area:1+(i%20)}));
const sample=(name,fn,records=count)=>{const timings=[];for(let i=0;i<7;i++){const start=performance.now();fn();timings.push(performance.now()-start);}timings.sort((a,b)=>a-b);return {name,records,medianMs:Number(timings[3].toFixed(2)),maxMs:Number(timings[6].toFixed(2))};};
const bundle=readFileSync(new URL('../public/scientific-data.json',import.meta.url));
console.log(JSON.stringify({runtime:process.version,scope:'Microbenchmark calculs en mémoire et lecture JSON local, pas mesure navigateur/réseau/D1',bundleBytes:bundle.byteLength,results:[sample('MAE/RMSE/biais',()=>pairedMetrics(pairs)),sample('Colonnes collecte',()=>collectionTotals(business)),sample('Rendement agrégé',()=>weightedYield(business)),sample('Décodage JSON scientifique',()=>JSON.parse(bundle),Object.values(JSON.parse(bundle)).filter(Array.isArray).reduce((n,a)=>n+a.length,0))]},null,2));
