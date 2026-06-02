const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  AdaptiveConfidenceCalibrationEngine,
} = require('../dist/infrastructure/paper-operational/adaptive-confidence-calibration-engine');

function input(overrides = {}) {
  return {
    strategyId: 'fusion',
    tableId: 'mesa-a',
    baseConfidence: 82,
    strategyReputationDecision: 'REPUTATION_STRONG',
    strategySuggestedWeight: 1.18,
    tableReputationDecision: 'TABLE_REPUTATION_STRONG',
    tableSuggestedWeight: 1.16,
    crossSessionDecision: 'CROSS_SESSION_STRONG',
    crossSessionSuggestedWeight: 1.2,
    trendDirection: 'TREND_IMPROVING',
    operatorStatus: 'OPERATOR_STABLE',
    consensusDecision: 'PAPER_CONSENSUS_READY',
    ...overrides,
  };
}

test('AdaptiveConfidenceCalibrationEngine boosts confidence with strong institutional evidence', () => {
  const result = new AdaptiveConfidenceCalibrationEngine().calibrate(input());

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'CALIBRATION_BOOSTED');
  assert.equal(result.value.calibratedConfidence > result.value.baseConfidence, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('AdaptiveConfidenceCalibrationEngine reduces confidence with degrading trend', () => {
  const result = new AdaptiveConfidenceCalibrationEngine().calibrate(input({
    strategyReputationDecision: 'REPUTATION_CAUTION',
    strategySuggestedWeight: 0.85,
    tableReputationDecision: 'TABLE_REPUTATION_VOLATILE',
    tableSuggestedWeight: 0.8,
    crossSessionDecision: 'CROSS_SESSION_CAUTION',
    crossSessionSuggestedWeight: 0.8,
    trendDirection: 'TREND_DEGRADING',
    operatorStatus: 'OPERATOR_COOLDOWN',
    consensusDecision: 'PAPER_CONSENSUS_OBSERVE',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'CALIBRATION_REDUCED');
  assert.equal(result.value.calibratedConfidence < result.value.baseConfidence, true);
});

test('AdaptiveConfidenceCalibrationEngine blocks confidence on institutional block', () => {
  const result = new AdaptiveConfidenceCalibrationEngine().calibrate(input({
    tableReputationDecision: 'TABLE_REPUTATION_BLOCKING',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'CALIBRATION_BLOCKED');
  assert.equal(result.value.calibratedConfidence, 0);
  assert.equal(result.value.institutionalWeight, 0);
});

test('AdaptiveConfidenceCalibrationEngine rejects live money before structural validation', () => {
  const result = new AdaptiveConfidenceCalibrationEngine().calibrate(input({
    strategyId: 'x',
    productionMoneyAllowed: true,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('AdaptiveConfidenceCalibrationEngine rejects malformed input', () => {
  const result = new AdaptiveConfidenceCalibrationEngine().calibrate(input({
    strategyId: 'x',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_ADAPTIVE_CONFIDENCE_INPUT');
});

test('adaptive-confidence-calibration-demo emits boosted confidence', () => {
  const result = spawnSync(process.execPath, ['scripts/adaptive-confidence-calibration-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.strategyId, 'fusion');
  assert.equal(payload.tableId, 'mesa-a');
  assert.equal(payload.decision, 'CALIBRATION_BOOSTED');
  assert.equal(payload.calibratedConfidence > payload.baseConfidence, true);
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
