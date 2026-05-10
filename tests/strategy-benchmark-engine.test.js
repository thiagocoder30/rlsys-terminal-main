const test = require('node:test');
const assert = require('node:assert/strict');
const { StrategyBenchmarkEngine } = require('../dist/domain/benchmark/StrategyBenchmarkEngine');

function balancedHistory(size = 240) {
  return Array.from({ length: size }, (_, index) => index % 37);
}

function persistentVoisinsHistory(size = 260) {
  const voisins = [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25];
  return Array.from({ length: size }, (_, index) => voisins[index % voisins.length]);
}

test('StrategyBenchmarkEngine rejects invalid histories', () => {
  const engine = new StrategyBenchmarkEngine();
  assert.throws(() => engine.run([1, 2, 99]), /Invalid roulette number/);
});

test('StrategyBenchmarkEngine returns bounded benchmark metrics', () => {
  const engine = new StrategyBenchmarkEngine({ randomRuns: 32, windowSize: 48 });
  const report = engine.run(balancedHistory());

  assert.equal(report.engineVersion, 'strategy-benchmark-v1');
  assert.equal(report.governance.operationalGate, 'BLOCKED');
  assert.ok(report.candidates.length >= 2);
  assert.ok(report.baselines.length >= 4);
  assert.ok(report.randomBaseline.runs >= 24);
  assert.ok(report.comparison.benchmarkScore >= 0 && report.comparison.benchmarkScore <= 1);
  assert.ok(report.comparison.baselineDominanceRisk >= 0 && report.comparison.baselineDominanceRisk <= 1);
});

test('StrategyBenchmarkEngine can surface candidate without opening operational gate', () => {
  const engine = new StrategyBenchmarkEngine({ randomRuns: 32, windowSize: 48, stakeFraction: 0.006 });
  const report = engine.run(persistentVoisinsHistory());

  assert.equal(report.governance.operationalGate, 'BLOCKED');
  assert.ok(['RESEARCH_REVIEW', 'BENCHMARK_CANDIDATE', 'REJECTED'].includes(report.governance.verdict));
  assert.ok(report.comparison.bestCandidate);
  assert.ok(Number.isFinite(report.comparison.relativeEdge));
});
