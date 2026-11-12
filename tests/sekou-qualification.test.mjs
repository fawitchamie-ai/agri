import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const qualification=JSON.parse(readFileSync('research-data/simulation-audit/2026-11-10/sekou-qualification.json','utf8'));

test('Sékou author clarification qualifies the harvest variable without converting it to dry grain yield',()=>{
 assert.equal(qualification.authorClarification.receivedOn,'2026-11-12');
 assert.match(qualification.authorClarification.freshweightCobMeaning,/after removal of the husks/i);
 assert.match(qualification.authorClarification.missingValues,/not interpreted as zero/i);
 assert.match(qualification.outcome.notCompatibleWith,/Dry grain t\/ha/);
 assert.equal(qualification.yieldSheetAudit.numericFreshweightCobN,615);
 assert.equal(qualification.yieldSheetAudit.missingFreshweightCobN,297);
 assert.equal(qualification.yieldSheetAudit.literalDotN,0);
});

test('repeated composite keys remain visible and are not auto-deduplicated',()=>{
 assert.equal(qualification.yieldSheetAudit.repeatedCompositeKeys,13);
 assert.equal(qualification.yieldSheetAudit.extraRowsWithinRepeatedCompositeKeys,14);
 assert.equal(qualification.yieldSheetAudit.repeatedCompositeKeysRetainedWithoutDeduplication,true);
 assert.deepEqual(qualification.yieldSheetAudit.rowsMissingFertilizerLabel,[837]);
 assert.ok(qualification.repeatedCompositeKeys.every(group=>group.measurementsDiffer));
 assert.equal(qualification.experimentalUse.current,'Descriptive greenhouse treatment audit only; do not use as field-yield calibration or validation.');
});

test('the reported climate companion remains an unacquired source lead',()=>{
 assert.match(qualification.authorClarification.climateCompanionLead,/No exact record, DOI, or file was identified/);
 assert.ok(qualification.limits.some(limit=>/companion but gave no exact pointer/.test(limit)));
});
