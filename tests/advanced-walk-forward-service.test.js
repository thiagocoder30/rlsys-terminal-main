const test = require('node:test');
const assert = require('node:assert/strict');
const { AdvancedWalkForwardService } = require('../dist/application/backtesting/AdvancedWalkForwardService');

test('AdvancedWalkForwardService rejects corrupted datasets', () => {
  const service = new AdvancedWalkForwardService();
  const report = service.evaluate([{ value: 1 }, { value: 99 }]);
  assert.equal(report.status, 'REJECTED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.blockers.includes('dataset_integrity_failed'), true);
});

test('AdvancedWalkForwardService returns blocked research report for clean dataset', () => {
  const service = new AdvancedWalkForwardService();
  const dataset = Array.from({ length: 900 }, (_, index) => ({ value: index % 37, timestamp: index }));
  const report = service.evaluate(dataset);
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.ok(report.result);
  assert.equal(report.result.summary.folds > 0, true);
});
