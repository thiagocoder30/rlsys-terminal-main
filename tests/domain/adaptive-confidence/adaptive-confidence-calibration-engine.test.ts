import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AdaptiveConfidenceCalibrationEngine,
  type AdaptiveConfidenceInput,
} from '../../../src/domain/adaptive-confidence/adaptive-confidence-calibration-engine';

const favorableInput: AdaptiveConfidenceInput = {
  strategyId: 'fusion',
  tableId: 'table-alpha',
  baseConfidence: 0.82,
  strategyReputationScore: 0.84,
  tableReputationScore: 0.82,
  consensusScore: 0.86,
  volatilityScore: 0.24,
  riskScore: 0.2,
  operatorScore: 0.9,
};

describe('AdaptiveConfidenceCalibrationEngine', () => {
  it('calibrates strong institutional context as paper favorable only', () => {
    const engine = new AdaptiveConfidenceCalibrationEngine();
    const result = engine.calibrate(favorableInput);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'CALIBRATED_PAPER_FAVORABLE');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.ok(result.value.calibratedConfidence >= 0.72);
      assert.ok(result.value.reasons.includes('STRATEGY_REPUTATION_SUPPORT'));
      assert.ok(result.value.reasons.includes('TABLE_REPUTATION_SUPPORT'));
      assert.ok(result.value.reasons.includes('CONSENSUS_SUPPORT'));
    }
  });

  it('blocks when strategy reputation is too low', () => {
    const engine = new AdaptiveConfidenceCalibrationEngine();
    const result = engine.calibrate({
      ...favorableInput,
      strategyReputationScore: 0.2,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'CALIBRATED_BLOCKED');
      assert.ok(result.value.reasons.includes('LOW_STRATEGY_REPUTATION'));
      assert.ok(result.value.reasons.includes('DEFENSIVE_BLOCK'));
    }
  });

  it('blocks when table reputation is too low', () => {
    const engine = new AdaptiveConfidenceCalibrationEngine();
    const result = engine.calibrate({
      ...favorableInput,
      tableReputationScore: 0.2,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'CALIBRATED_BLOCKED');
      assert.ok(result.value.reasons.includes('LOW_TABLE_REPUTATION'));
      assert.ok(result.value.reasons.includes('DEFENSIVE_BLOCK'));
    }
  });

  it('blocks high-volatility contexts defensively', () => {
    const engine = new AdaptiveConfidenceCalibrationEngine();
    const result = engine.calibrate({
      ...favorableInput,
      volatilityScore: 0.9,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'CALIBRATED_BLOCKED');
      assert.ok(result.value.reasons.includes('VOLATILITY_PENALTY'));
      assert.ok(result.value.reasons.includes('DEFENSIVE_BLOCK'));
    }
  });

  it('observes moderate contexts instead of over-authorizing them', () => {
    const engine = new AdaptiveConfidenceCalibrationEngine();
    const result = engine.calibrate({
      ...favorableInput,
      baseConfidence: 0.58,
      strategyReputationScore: 0.56,
      tableReputationScore: 0.55,
      consensusScore: 0.58,
      operatorScore: 0.68,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'CALIBRATED_OBSERVE');
      assert.ok(result.value.calibratedConfidence >= 0.48);
      assert.ok(result.value.calibratedConfidence < 0.72);
    }
  });

  it('rejects invalid inputs through Result without silent failure', () => {
    const engine = new AdaptiveConfidenceCalibrationEngine();
    const result = engine.calibrate({
      ...favorableInput,
      baseConfidence: 1.2,
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_ADAPTIVE_CONFIDENCE_INPUT');
    }
  });
});
