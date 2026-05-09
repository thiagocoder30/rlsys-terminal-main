const test = require('node:test');
const assert = require('node:assert/strict');
const { ResearchDatasetService } = require('../dist/application/research/ResearchDatasetService');

test('ResearchDatasetService returns accepted report for clean research dataset', () => {
  const service = new ResearchDatasetService();
  const dataset = Array.from({ length: 160 }, (_, index) => ({ value: index % 37, timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(), tableId: 'mesa-a' }));
  const report = service.evaluate(dataset);

  assert.equal(report.status, 'ACCEPTED');
  assert.equal(report.integrity.valid, true);
  assert.equal(report.normalized.metadata.totalRecords, 160);
});

test('ResearchDatasetService rejects corrupted dataset', () => {
  const service = new ResearchDatasetService();
  const report = service.evaluate('1 2 3 99 -4 x');

  assert.equal(report.status, 'REJECTED');
  assert.ok(report.parse.rejectedRows.length >= 3);
  assert.ok(report.recommendations.length > 0);
});
