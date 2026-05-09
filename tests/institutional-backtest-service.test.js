const test = require('node:test');
const assert = require('node:assert/strict');
const { InstitutionalBacktestService } = require('../dist/application/backtesting/InstitutionalBacktestService');

function toRecords(values) {
  return values.map((value, index) => ({
    value,
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    tableId: 'mesa-backtest'
  }));
}

test('InstitutionalBacktestService rejects corrupted datasets and keeps operational gate blocked', () => {
  const report = new InstitutionalBacktestService().evaluate([{ value: 99 }, { value: -1 }]);
  assert.equal(report.status, 'REJECTED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.ok(report.blockers.includes('dataset_integrity_failed'));
});

test('InstitutionalBacktestService returns institutional research report for clean dataset', () => {
  const values = Array.from({ length: 900 }, (_, index) => [31, 32, 33, 34, 35, 36, 30, 29][index % 8]);
  const report = new InstitutionalBacktestService().evaluate(toRecords(values));

  assert.ok(['REJECTED', 'RESEARCH_REVIEW', 'CANDIDATE'].includes(report.status));
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.ok(report.datasetChecksum.length >= 12);
  assert.ok(report.result.summary.sampleSize >= 900);
  assert.ok(Array.isArray(report.recommendations));
});
