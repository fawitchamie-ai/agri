import test from 'node:test';import assert from 'node:assert/strict';
import {advanceCanopy,adjustedGreenCover,type CanopyDynamics,type CanopyState} from '../lib/seasonal/canopy.ts';
import {dualCoefficients,type DualKcInput} from '../lib/seasonal/dual-kc.ts';
const p:CanopyDynamics={version:'canopy-state-1',source:'Synthetic mechanism test only',availableOn:'2026-01-01',initialCover:.005,maxCover:.95,emergenceDay:5,senescenceDay:100,growthRateDay:.1,declineRateDay:.08,expansionLower:.14,expansionUpper:.72,senescenceThreshold:.69,stressDeclineRateDay:.1};
function series(drought=false){let s:CanopyState={cover:0,senescenceAge:0,coverAtSenescence:null};return Array.from({length:125},(_,day)=>{s=advanceCanopy(s,day,drought&&day>=25&&day<65?.9:0,p);return s.cover;});}
test('canopy has state: early drought delays expansion and leaves a later penalty after rewatering',()=>{
 const wet=series(),dry=series(true);assert.equal(wet[0],0);assert.ok(wet[90]>.9);assert.ok(dry[65]<wet[65]/2);assert.ok(dry[75]<wet[75]);assert.ok(wet[124]<wet[100]);assert.ok([...wet,...dry].every(c=>c>=0&&c<=p.maxCover));
});
test('the actual green cover changes BOTH evaporation and transpiration under the explicit cover method',()=>{
 const m:DualKcInput={version:'fao56-dual-1',availableOn:'2026-01-01',source:'Synthetic',readilyEvaporableMm:8,totalEvaporableMm:20,initialDepletionMm:20,wettedFraction:1,kcMax:1.25,stages:[{coverStart:.9,coverEnd:.9,kcbStart:1.1,kcbEnd:1.1}],transpiration:{method:'canopy-cover',maxCoefficient:1.1,availableOn:'2026-01-01',source:'FAO documented CC* relation'}};
 const bare=dualCoefficients(m,0,0,20,10,0,0),green=dualCoefficients(m,0,0,20,10,0,.8);
 assert.equal(bare.kcb,0);assert.ok(green.kcb>0);assert.ok(green.ke<bare.ke);assert.equal(adjustedGreenCover(0),0);assert.equal(adjustedGreenCover(1),1);
});
test('assimilated cover is retained even above the assumed profile maximum',()=>{
 const s=advanceCanopy({cover:.8,senescenceAge:0,coverAtSenescence:null},80,0,p,.99);
 assert.equal(s.cover,.99);assert.equal(advanceCanopy(s,81,0,p).cover,.99);
});
