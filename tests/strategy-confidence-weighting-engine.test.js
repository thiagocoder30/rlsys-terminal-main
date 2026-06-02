const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  StrategyConfidenceWeightingEngine,
} = require('../dist/infrastructure/paper-operational/strategy-confidence-weighting-engine');

function baseInput(overrides = {}) {
  return {
    strategyId: 'fusion',
    tableId: 'mesa-198',
    rawConfidence: 84,
    baseWeight: 1,
    tableHistory: {
      sampleSize: 120,
      recentHitRate: 0.62,
      recentDrawdownPercent: 3,
      consistencyScore: 0.74,
      volatilityScore: 0.22,
    },
    readinessScore: 0.95,
    operatorScore: 0.92,
    performanceScore: 0.86,
    consensusScore: 0.9,
    minimumConfidenceForFavoravel: 80,
    minimumConfidenceForCertificado: 88,
    ...overrides,
  };
}

test('StrategyConfidenceWeightingEngine returns favorable or certified for strong Fusion context', () => {
  const result = new StrategyConfidenceWeightingEngine().evaluate(baseInput());

  assert.equal(result.ok, true);
  assert.equal(result.value.strategyId, 'fusion');
  assert.equal(result.value.finalConfidence >= 80, true);
  assert.equal(result.value.decision === 'PAPER_FAVORAVEL' || result.value.decision === 'PAPER_CERTIFICADO', true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('StrategyConfidenceWeightingEngine blocks when operator score is unsafe', () => {
  const result = new StrategyConfidenceWeightingEngine().evaluate(baseInput({
    operatorScore: 0.35,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_NAO_UTILIZAR');
});

test('StrategyConfidenceWeightingEngine downgrades weak sample to observation', () => {
  const result = new StrategyConfidenceWeightingEngine().evaluate(baseInput({
    rawConfidence: 82,
    tableHistory: {
      sampleSize: 8,
      recentHitRate: 0.9,
      recentDrawdownPercent: 2,
      consistencyScore: 0.9,
      volatilityScore: 0.1,
    },
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision === 'PAPER_OBSERVAR' || result.value.decision === 'PAPER_NAO_UTILIZAR', true);
  assert.equal(result.value.tableHistoryWeight, 0.75);
});

test('StrategyConfidenceWeightingEngine blocks high drawdown despite raw confidence', () => {
  const result = new StrategyConfidenceWeightingEngine().evaluate(baseInput({
    rawConfidence: 95,
    tableHistory: {
      sampleSize: 300,
      recentHitRate: 0.8,
      recentDrawdownPercent: 15,
      consistencyScore: 0.8,
      volatilityScore: 0.2,
    },
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_NAO_UTILIZAR');
});

test('StrategyConfidenceWeightingEngine rejects live money flags before structural validation', () => {
  const result = new StrategyConfidenceWeightingEngine().evaluate(baseInput({
    strategyId: 'x',
    productionMoneyAllowed: true,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('StrategyConfidenceWeightingEngine rejects malformed thresholds', () => {
  const result = new StrategyConfidenceWeightingEngine().evaluate(baseInput({
    minimumConfidenceForFavoravel: 90,
    minimumConfidenceForCertificado: 80,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_STRATEGY_CONFIDENCE_INPUT');
});

test('strategy-confidence-weighting-demo emits manual PAPER suggestion report', () => {
  const result = spawnSync(process.execPath, ['scripts/strategy-confidence-weighting-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.strategyId, 'fusion');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
  assert.equal(payload.decision === 'PAPER_FAVORAVEL' || payload.decision === 'PAPER_CERTIFICADO', true);
});
