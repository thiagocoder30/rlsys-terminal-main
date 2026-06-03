import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  StrategyReputationEngine,
  type StrategyReputationSample,
} from '../../../src/domain/strategy-reputation/strategy-reputation-engine';

const fusionSamples: readonly StrategyReputationSample[] = [
  {
    strategyId: 'fusion',
    paperSignals: 20,
    favorableSignals: 15,
    blockedSignals: 2,
    wins: 12,
    losses: 4,
    neutralOutcomes: 4,
    totalExposureUnits: 20,
    maxDrawdownUnits: 2,
    operatorViolationCount: 0,
    certificationFailureCount: 0,
    confidenceScore: 0.86,
  },
  {
    strategyId: 'fusion',
    paperSignals: 18,
    favorableSignals: 13,
    blockedSignals: 1,
    wins: 11,
    losses: 4,
    neutralOutcomes: 3,
    totalExposureUnits: 18,
    maxDrawdownUnits: 3,
    operatorViolationCount: 0,
    certificationFailureCount: 0,
    confidenceScore: 0.82,
  },
  {
    strategyId: 'fusion',
    paperSignals: 16,
    favorableSignals: 11,
    blockedSignals: 1,
    wins: 10,
    losses: 4,
    neutralOutcomes: 2,
    totalExposureUnits: 16,
    maxDrawdownUnits: 2,
    operatorViolationCount: 0,
    certificationFailureCount: 0,
    confidenceScore: 0.84,
  },
];

describe('StrategyReputationEngine', () => {
  it('classifies consistent paper strategies as trusted paper only', () => {
    const engine = new StrategyReputationEngine();
    const result = engine.evaluate(fusionSamples);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.length, 1);
      assert.equal(result.value[0]?.strategyId, 'fusion');
      assert.equal(result.value[0]?.status, 'TRUSTED_PAPER');
      assert.equal(result.value[0]?.productionMoneyAllowed, false);
      assert.equal(result.value[0]?.liveMoneyAuthorization, false);
      assert.equal(result.value[0]?.paperOnly, true);
      assert.ok(
        result.value[0]?.reasons.includes('POSITIVE_PAPER_CONSISTENCY'),
      );
    }
  });

  it('blocks strategies with excessive drawdown', () => {
    const engine = new StrategyReputationEngine({
      minimumSamples: 1,
      minimumTrustedScore: 0.72,
      minimumNeutralScore: 0.48,
      maximumDrawdownUnits: 4,
      maximumOperatorViolations: 0,
      maximumCertificationFailures: 0,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    const result = engine.evaluate([
      {
        ...fusionSamples[0],
        maxDrawdownUnits: 9,
      },
    ]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value[0]?.status, 'BLOCKED_PAPER');
      assert.ok(result.value[0]?.reasons.includes('EXCESSIVE_DRAWDOWN'));
    }
  });

  it('blocks strategies with operator discipline risk', () => {
    const engine = new StrategyReputationEngine({
      minimumSamples: 1,
      minimumTrustedScore: 0.72,
      minimumNeutralScore: 0.48,
      maximumDrawdownUnits: 8,
      maximumOperatorViolations: 0,
      maximumCertificationFailures: 0,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    const result = engine.evaluate([
      {
        ...fusionSamples[0],
        operatorViolationCount: 1,
      },
    ]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value[0]?.status, 'BLOCKED_PAPER');
      assert.ok(
        result.value[0]?.reasons.includes('OPERATOR_DISCIPLINE_RISK'),
      );
    }
  });

  it('keeps low-sample strategies neutral instead of over-trusting them', () => {
    const engine = new StrategyReputationEngine();
    const result = engine.evaluate([fusionSamples[0]]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value[0]?.status, 'NEUTRAL_PAPER');
      assert.ok(result.value[0]?.reasons.includes('LOW_SAMPLE_SIZE'));
    }
  });

  it('rejects invalid samples through Result without silent failure', () => {
    const engine = new StrategyReputationEngine();
    const result = engine.evaluate([
      {
        ...fusionSamples[0],
        strategyId: ' ',
      },
    ]);

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_REPUTATION_INPUT');
    }
  });

  it('supports multiple strategies in one O(n) aggregation pass', () => {
    const engine = new StrategyReputationEngine();
    const result = engine.evaluate([
      ...fusionSamples,
      {
        strategyId: 'triplicacao',
        paperSignals: 5,
        favorableSignals: 2,
        blockedSignals: 2,
        wins: 1,
        losses: 3,
        neutralOutcomes: 1,
        totalExposureUnits: 5,
        maxDrawdownUnits: 4,
        operatorViolationCount: 0,
        certificationFailureCount: 0,
        confidenceScore: 0.42,
      },
      {
        strategyId: 'triplicacao',
        paperSignals: 4,
        favorableSignals: 1,
        blockedSignals: 2,
        wins: 1,
        losses: 2,
        neutralOutcomes: 1,
        totalExposureUnits: 4,
        maxDrawdownUnits: 3,
        operatorViolationCount: 0,
        certificationFailureCount: 0,
        confidenceScore: 0.44,
      },
      {
        strategyId: 'triplicacao',
        paperSignals: 4,
        favorableSignals: 1,
        blockedSignals: 2,
        wins: 1,
        losses: 2,
        neutralOutcomes: 1,
        totalExposureUnits: 4,
        maxDrawdownUnits: 3,
        operatorViolationCount: 0,
        certificationFailureCount: 0,
        confidenceScore: 0.43,
      },
    ]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.length, 2);
      assert.equal(result.value[0]?.strategyId, 'fusion');
      assert.equal(result.value[1]?.strategyId, 'triplicacao');
      assert.equal(result.value[1]?.status, 'DEGRADED_PAPER');
    }
  });
});
