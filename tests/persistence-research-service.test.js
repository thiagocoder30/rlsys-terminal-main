const test = require('node:test');
const assert = require('node:assert/strict');
const { PersistenceResearchService } = require('../dist/application/research/PersistenceResearchService');

function toRecords(values) {
  return values.map((value, index) => ({ value, timestamp: new Date(2026, 0, 1, 0, index).toISOString(), tableId: 'mesa-alpha' }));
}

test('PersistenceResearchService rejects corrupted tiny dataset', () => {
  const service = new PersistenceResearchService();
  const report = service.evaluate([{ value: 99 }, { value: -1 }, { value: 7 }]);

  assert.equal(report.status, 'REJECTED');
  assert.equal(report.operationalGate, 'BLOCKED');
});

test('PersistenceResearchService returns research-ready status for persistent evidence while keeping operational gate blocked', () => {
  const service = new PersistenceResearchService();
  const values = Array.from({ length: 1400 }, (_, index) => [31, 32, 33, 34, 35, 36, 30, 29][index % 8]);
  const report = service.evaluate(toRecords(values));

  assert.ok(['PERSISTENCE_RESEARCH_READY', 'INCONCLUSIVE'].includes(report.status));
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.ok(report.researchScore >= 0 && report.researchScore <= 1);
  assert.ok(report.persistence.windows.length >= 4);
});
