import test from 'node:test';
import assert from 'node:assert/strict';
import {planningAlerts} from '../components/agri/planning.ts';
const plan=(date:string,committed=4,status='prevu',point='Magasin',slotHHmm='08:00')=>({date,committed,status,point,slotHHmm});
test('Transport: deux dates indépendantes ne sont pas cumulées',()=>assert.deepEqual(planningAlerts([plan('2026-10-27'),plan('2026-10-28')],[{point:'Magasin',storage:20,transport:5}]),[]));
test('Transport: même créneau cumulé et capacité zéro explicite',()=>{assert.equal(planningAlerts([plan('2026-10-27'),plan('2026-10-27')],[{point:'Magasin',storage:20,transport:5}]).length,1);assert.equal(planningAlerts([plan('2026-10-27')],[{point:'Magasin',storage:0,transport:0}]).length,2)});
test('Planning: absence de capacité et passages annulés sans alerte inventée',()=>{assert.deepEqual(planningAlerts([plan('2026-10-27')],[]),[]);assert.deepEqual(planningAlerts([plan('2026-10-27',99,'annule')],[{point:'Magasin',storage:0,transport:0}]),[])});
