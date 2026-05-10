const test = require('node:test');
const assert = require('node:assert/strict');
const { WarmupSessionService } = require('../dist/application/session/WarmupSessionService');

function csvFrom(values) {
  return 'value\n' + values.join('\n');
}

test('WarmupSessionService evaluates manual 100-round warmup with blocked operational gate', () => {
  const service = new WarmupSessionService();
  const values = Array.from({ length: 100 }, (_, index) => index % 37);
  const report = service.evaluate({ source: 'manual', values });

  assert.equal(report.service, 'WarmupSessionService');
  assert.equal(report.schemaVersion, '2.7.0');
  assert.notEqual(report.status, 'REJECTED');
  assert.equal(report.executiveSummary.operationalGate, 'BLOCKED');
  assert.equal(report.warmup.sample.used, 100);
});

test('WarmupSessionService rejects corrupted warmup dataset', () => {
  const service = new WarmupSessionService();
  const report = service.evaluate(csvFrom([1, 2, 99]));

  assert.equal(report.status, 'REJECTED');
  assert.equal(report.executiveSummary.tableGate, 'NO_GO');
});

test('WarmupSessionService evaluates vision raw JSON without opening operational gate', () => {
  const service = new WarmupSessionService();
  const values = Array.from({ length: 100 }, (_, index) => index % 37);
  const report = service.evaluate({ source: 'vision', visionRaw: JSON.stringify({ total: 100, sequencia: values }) });

  assert.equal(report.source, 'vision');
  assert.equal(report.extraction.accepted, 100);
  assert.equal(report.executiveSummary.operationalGate, 'BLOCKED');
});
