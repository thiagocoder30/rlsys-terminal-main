const test = require('node:test');
const assert = require('node:assert/strict');
const { RegimeClassificationEngine } = require('../dist/domain/regime/RegimeClassificationEngine');

function rotatingHistory(size = 150) {
  return Array.from({ length: size }, (_, index) => index % 37);
}

test('RegimeClassificationEngine classifies balanced history as stable research regime', () => {
  const engine = new RegimeClassificationEngine();
  const result = engine.classify(rotatingHistory());

  assert.equal(result.success, true);
  assert.equal(result.value.engineVersion, 'regime-classification-v1');
  assert.equal(result.value.regime, 'STABLE');
  assert.equal(result.value.signalPolicy, 'ALLOW_RESEARCH');
  assert.equal(result.value.blockers.length, 0);
  assert.ok(result.value.metrics.normalizedEntropy > 0.9);
  assert.ok(result.value.metrics.confidence >= 0.58);
});

test('RegimeClassificationEngine blocks chaotic concentrated history', () => {
  const engine = new RegimeClassificationEngine();
  const history = Array.from({ length: 140 }, (_, index) => (index < 100 ? 7 : index % 4));
  const result = engine.classify(history);

  assert.equal(result.success, true);
  assert.equal(result.value.regime, 'CHAOTIC');
  assert.equal(result.value.signalPolicy, 'BLOCK_SIGNALS');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('Regime caótico')));
  assert.ok(result.value.metrics.concentration > 0.22);
});

test('RegimeClassificationEngine detects drifting sector pressure without opening signals', () => {
  const engine = new RegimeClassificationEngine({ driftThreshold: 0.08 });
  const early = Array.from({ length: 75 }, (_, index) => index % 37);
  const late = Array.from({ length: 75 }, (_, index) => 25 + (index % 12));
  const result = engine.classify([...early, ...late]);

  assert.equal(result.success, true);
  assert.equal(result.value.regime, 'DRIFTING');
  assert.equal(result.value.signalPolicy, 'OBSERVE_ONLY');
  assert.ok(result.value.warnings.some((warning) => warning.includes('drift')));
});

test('RegimeClassificationEngine returns typed Result error for malformed history', () => {
  const engine = new RegimeClassificationEngine();
  const result = engine.classify([1, 2, 37, 4]);

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'REGIME_CLASSIFICATION_FAILED');
  assert.match(result.error.message, /invalid_regime_history_value/);
});
