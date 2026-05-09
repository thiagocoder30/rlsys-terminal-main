const test = require('node:test');
const assert = require('node:assert/strict');
const { EdgePersistenceAnalyzer } = require('../dist/domain/persistence/EdgePersistenceAnalyzer');

function rotatingDataset(size) {
  return Array.from({ length: size }, (_, index) => index % 37);
}

function persistentDataset(size) {
  const cluster = [31, 32, 33, 34, 35, 36, 30, 29];
  return Array.from({ length: size }, (_, index) => cluster[index % cluster.length]);
}

test('EdgePersistenceAnalyzer returns no persistent edge for rotating balanced data', () => {
  const analyzer = new EdgePersistenceAnalyzer();
  const report = analyzer.analyze(rotatingDataset(1200), { windowSize: 120, stepSize: 60 });

  assert.equal(report.sampleSize, 1200);
  assert.ok(report.windows.length >= 4);
  assert.ok(report.persistenceScore >= 0 && report.persistenceScore <= 1);
  assert.equal(report.verdict, 'NO_PERSISTENT_EDGE');
});

test('EdgePersistenceAnalyzer flags stable concentrated evidence as persistent research signal', () => {
  const analyzer = new EdgePersistenceAnalyzer();
  const report = analyzer.analyze(persistentDataset(1200), { windowSize: 120, stepSize: 60 });

  assert.ok(report.persistenceScore > 0.6);
  assert.ok(['MODERATE_PERSISTENCE', 'STRONG_PERSISTENCE', 'WEAK_PERSISTENCE'].includes(report.verdict));
  assert.ok(report.stability.stableWindows > 0);
  assert.ok(report.outOfSampleConsistency >= 0.5);
});

test('EdgePersistenceAnalyzer estimates decay direction for fading signals', () => {
  const analyzer = new EdgePersistenceAnalyzer();
  const first = persistentDataset(600);
  const second = rotatingDataset(600);
  const report = analyzer.analyze([...first, ...second], { windowSize: 120, stepSize: 60 });

  assert.equal(report.decay.direction, 'decaying');
  assert.ok(report.decay.relativeDecay >= 0);
});
