const test = require('node:test');
const assert = require('node:assert/strict');
const { ResearchReportingService } = require('../dist/application/research/ResearchReportingService');

function toRecords(values) {
  return values.map((value, index) => ({
    value,
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    tableId: 'mesa-research'
  }));
}

test('ResearchReportingService rejects corrupted datasets with audit envelope', () => {
  const service = new ResearchReportingService('test');
  const report = service.evaluate([{ value: 99 }, { value: -1 }, { value: 7 }]);

  assert.equal(report.executiveSummary.status, 'REJECTED');
  assert.equal(report.executiveSummary.operationalGate, 'BLOCKED');
  assert.ok(report.envelope.reportId.length >= 12);
  assert.ok(report.auditTrail.some(item => item.includes('final:REJECTED')));
});

test('ResearchReportingService consolidates all research modules while keeping operational gate blocked', () => {
  const service = new ResearchReportingService('test');
  const values = Array.from({ length: 1600 }, (_, index) => [31, 32, 33, 34, 35, 36, 30, 29][index % 8]);
  const report = service.evaluate(toRecords(values));

  assert.ok(['INCONCLUSIVE', 'RESEARCH_REVIEW_READY'].includes(report.executiveSummary.status));
  assert.equal(report.executiveSummary.operationalGate, 'BLOCKED');
  assert.ok(report.executiveSummary.compositeScore >= 0 && report.executiveSummary.compositeScore <= 1);
  assert.ok(report.executiveSummary.confidence >= 0 && report.executiveSummary.confidence <= 1);
  assert.equal(report.envelope.schemaVersion, 'research-report.v1');
  assert.ok(report.statistics.significance.sampleSize > 0);
  assert.ok(report.sequential.sequential.sampleSize > 0);
  assert.ok(report.persistence.persistence.sampleSize > 0);
});
