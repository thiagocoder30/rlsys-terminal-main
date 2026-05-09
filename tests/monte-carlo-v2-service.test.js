const test = require('node:test');
const assert = require('node:assert/strict');
const { MonteCarloV2Service } = require('../dist/application/backtesting/MonteCarloV2Service');

function csvHistory(size = 180) {
  const rows = ['value,timestamp,tableId'];
  for (let index = 0; index < size; index += 1) {
    rows.push(`${index % 37},2026-01-01T00:${String(index % 60).padStart(2, '0')}:00.000Z,mesa-a`);
  }
  return rows.join('\n');
}

test('MonteCarloV2Service returns institutional blocked research report', () => {
  const service = new MonteCarloV2Service();
  const report = service.evaluate(csvHistory());

  assert.equal(report.service, 'MonteCarloV2Service');
  assert.equal(report.schemaVersion, '2.5.0');
  assert.equal(report.executiveSummary.operationalGate, 'BLOCKED');
  assert.ok(report.simulation.summary.simulations >= 50);
  assert.ok(report.executiveSummary.robustnessScore >= 0 && report.executiveSummary.robustnessScore <= 1);
});

test('MonteCarloV2Service rejects corrupted datasets', () => {
  const service = new MonteCarloV2Service();
  const report = service.evaluate('value\n1\n99\nabc');

  assert.equal(report.status, 'REJECTED');
  assert.equal(report.executiveSummary.operationalGate, 'BLOCKED');
  assert.equal(report.executiveSummary.tailRisk, 'CRITICAL');
});
