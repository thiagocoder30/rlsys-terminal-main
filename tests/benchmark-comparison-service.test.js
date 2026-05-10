const test = require('node:test');
const assert = require('node:assert/strict');
const { BenchmarkComparisonService } = require('../dist/application/backtesting/BenchmarkComparisonService');

function csvFrom(values) {
  return 'value\n' + values.join('\n');
}

test('BenchmarkComparisonService rejects corrupted datasets', () => {
  const service = new BenchmarkComparisonService();
  const report = service.evaluate('value\n1\n2\n99');
  assert.equal(report.status, 'REJECTED');
  assert.equal(report.executiveSummary.operationalGate, 'BLOCKED');
});

test('BenchmarkComparisonService returns institutional benchmark report with blocked gate', () => {
  const service = new BenchmarkComparisonService();
  const values = Array.from({ length: 220 }, (_, index) => index % 37);
  const report = service.evaluate(csvFrom(values));

  assert.equal(report.service, 'BenchmarkComparisonService');
  assert.equal(report.schemaVersion, '2.6.0');
  assert.equal(report.executiveSummary.operationalGate, 'BLOCKED');
  assert.ok(report.benchmark);
  assert.ok(report.executiveSummary.benchmarkScore >= 0 && report.executiveSummary.benchmarkScore <= 1);
});
