const test = require('node:test');
const assert = require('node:assert/strict');
const { DatasetEngine } = require('../dist/domain/research/DatasetEngine');
const { DataIntegrityValidator } = require('../dist/domain/research/DataIntegrityValidator');

test('DataIntegrityValidator accepts research-sized canonical datasets', () => {
  const engine = new DatasetEngine();
  const values = Array.from({ length: 150 }, (_, index) => index % 37);
  const normalized = engine.normalize(engine.parse(values).records);
  const report = new DataIntegrityValidator({ minRecords: 120, maxDuplicateRatio: 0.4, maxRepeatRun: 12 }).validate(normalized.records);

  assert.equal(report.valid, true);
  assert.equal(report.totalRecords, 150);
  assert.equal(report.uniqueValues, 37);
  assert.ok(report.score > 0.8);
});

test('DataIntegrityValidator blocks insufficient datasets', () => {
  const engine = new DatasetEngine();
  const normalized = engine.normalize(engine.parse([1, 2, 3, 4, 5]).records);
  const report = new DataIntegrityValidator().validate(normalized.records);

  assert.equal(report.valid, false);
  assert.ok(report.issues.some(issue => issue.code === 'INSUFFICIENT_RECORDS'));
});
