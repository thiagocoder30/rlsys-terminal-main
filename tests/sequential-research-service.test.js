const test = require('node:test');
const assert = require('node:assert/strict');
const { SequentialResearchService } = require('../dist/application/research/SequentialResearchService');

test('SequentialResearchService rejects corrupted tiny dataset', () => {
  const service = new SequentialResearchService();
  const report = service.evaluate('1,2,x,99');
  assert.equal(report.status, 'REJECTED');
});

test('SequentialResearchService returns a temporal report for persistent dataset', () => {
  const service = new SequentialResearchService();
  const dataset = [
    ...Array.from({ length: 300 }, () => 2),
    ...Array.from({ length: 300 }, () => 33)
  ];
  const report = service.evaluate(dataset);
  assert.ok(['INCONCLUSIVE', 'TEMPORAL_RESEARCH_READY'].includes(report.status));
  assert.ok(report.temporalEvidenceScore >= 0);
  assert.ok(report.sequential.sequentialBiasScore > 0);
});
