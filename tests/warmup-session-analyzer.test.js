const test = require('node:test');
const assert = require('node:assert/strict');
const { WarmupSessionAnalyzer } = require('../dist/domain/session/WarmupSessionAnalyzer');

function balancedWarmup() {
  return Array.from({ length: 100 }, (_, index) => index % 37);
}

test('WarmupSessionAnalyzer accepts complete balanced 100-round warmup for research', () => {
  const analyzer = new WarmupSessionAnalyzer();
  const report = analyzer.analyze(balancedWarmup());

  assert.equal(report.engineVersion, 'warmup-session-v1');
  assert.equal(report.sample.used, 100);
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.ok(['GO_RESEARCH', 'OBSERVE'].includes(report.tableGate));
  assert.ok(report.metrics.normalizedEntropy >= 0 && report.metrics.normalizedEntropy <= 1);
  assert.equal(report.sectors.length, 4);
});

test('WarmupSessionAnalyzer rejects invalid roulette values', () => {
  const analyzer = new WarmupSessionAnalyzer();
  assert.throws(() => analyzer.analyze([1, 2, 37]), /Invalid roulette number/);
});

test('WarmupSessionAnalyzer marks incomplete warmup as NO_GO', () => {
  const analyzer = new WarmupSessionAnalyzer();
  const report = analyzer.analyze(Array.from({ length: 80 }, (_, index) => index % 37));

  assert.equal(report.tableGate, 'NO_GO');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.ok(report.blockers.includes('WARMUP_INCOMPLETE_100_ROUNDS'));
});
