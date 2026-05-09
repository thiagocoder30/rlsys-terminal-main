const test = require('node:test');
const assert = require('node:assert/strict');
const { StatisticalResearchService } = require('../dist/application/research/StatisticalResearchService');

test('StatisticalResearchService returns inconclusive research report for clean uniform dataset', () => {
  const service = new StatisticalResearchService();
  const dataset = Array.from({ length: 740 }, (_, index) => ({ value: index % 37, timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString() }));
  const report = service.evaluate(dataset);

  assert.equal(report.integrity.valid, true);
  assert.equal(report.significance.verdict, 'NO_EVIDENCE');
  assert.equal(report.status, 'INCONCLUSIVE');
  assert.ok(report.recommendations.length > 0);
});

test('StatisticalResearchService rejects corrupted tiny dataset', () => {
  const service = new StatisticalResearchService();
  const report = service.evaluate('1 2 99 x 3');

  assert.equal(report.status, 'REJECTED');
  assert.equal(report.integrity.valid, false);
});
