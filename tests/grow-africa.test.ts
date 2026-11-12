import test from 'node:test';
import assert from 'node:assert/strict';
import {growAfricaRegionalContext} from '../lib/seasonal/grow-africa.ts';

test('GROW administrative history is shown only for a unique exact region and stays context-only',()=>{
 const result=growAfricaRegionalContext('BEN','maize','Banikoara','2026-11-12');
 assert.equal(result.status,'context_only');
 assert.equal(result.matchedTerritory,'Banikoara');
 assert.equal(result.adminLevel,2);
 assert.equal(result.usedForPrediction,false);
 assert.equal(result.usedAsIndependentYm,false);
 assert.ok(result.rows.length>0);
 assert.ok(result.rows.every(r=>r.qualityFlag==='A'&&Number.isFinite(r.yieldTHa)));
 assert.ok(result.limits.some(x=>/non prévision de récolte/i.test(x)));
});

test('a region is never inferred from a partial name or substituted from another area',()=>{
 const result=growAfricaRegionalContext('BEN','maize','Banikoara rural','2026-11-12');
 assert.equal(result.status,'unavailable');
 assert.equal(result.rows.length,0);
 assert.match(result.missing,/correspond exactement/i);
});

test('Côte d’Ivoire remains unavailable in the GROW administrative table',()=>{
 const result=growAfricaRegionalContext('CIV','maize','Gagnoa','2026-11-12');
 assert.equal(result.status,'unavailable');
 assert.equal(result.rows.length,0);
 assert.match(result.missing,/aucune série régionale/i);
});

test('GROW records acquired after a historical issue date are not backdated',()=>{
 const result=growAfricaRegionalContext('BEN','maize','Banikoara','2025-12-31');
 assert.equal(result.status,'not_available_as_of');
 assert.equal(result.rows.length,0);
});
