const test = require('node:test');
const assert = require('node:assert/strict');
const { StressScenarioService } = require('../dist/application/backtesting/StressScenarioService');

const csv = 'spin,timestamp\n' + Array.from({ length: 220 }, (_, index) => `${index % 37},2026-01-01T00:${String(index % 60).padStart(2, '0')}:00Z`).join('\n');

test('StressScenarioService returns institutional stress report with blocked gate', () => {
  const report = new StressScenarioService().evaluate(csv);
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.ok(report.datasetChecksum.length > 10);
  assert.ok(report.analysis.summary.scenarios >= 5);
  assert.ok(Array.isArray(report.recommendations));
});

test('StressScenarioService rejects corrupted datasets', () => {
  const report = new StressScenarioService().evaluate([{ value: 1 }, { value: 88 }]);
  assert.equal(report.status, 'REJECTED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.ok(report.blockers.includes('dataset_integrity_failed'));
});
