const test = require('node:test');
const assert = require('node:assert/strict');
const { CapitalExposureService } = require('../dist/application/backtesting/CapitalExposureService');

function dataset(size) {
  return Array.from({ length: size }, (_, index) => ({ value: index % 37, timestamp: new Date(2024, 0, 1, 0, index).toISOString(), tableId: 'capital-test' }));
}

test('CapitalExposureService returns institutional capital report with blocked gate', () => {
  const service = new CapitalExposureService();
  const report = service.evaluate(dataset(260));

  assert.equal(report.operationalGate, 'BLOCKED');
  assert.ok(['RESEARCH_REVIEW', 'CAPITAL_RESILIENT_CANDIDATE', 'REJECTED'].includes(report.status));
  assert.ok(report.datasetChecksum.length > 20);
  assert.ok(report.analysis.summary.advancedRiskOfRuin.probability >= 0);
  assert.ok(report.recommendations.length >= 1);
});

test('CapitalExposureService rejects corrupted datasets', () => {
  const service = new CapitalExposureService();
  const report = service.evaluate([{ value: 1 }, { value: 99 }]);

  assert.equal(report.status, 'REJECTED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.ok(report.blockers.length >= 1);
});
