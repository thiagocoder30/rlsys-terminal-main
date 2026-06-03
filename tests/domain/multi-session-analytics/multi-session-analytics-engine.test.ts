import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MultiSessionAnalyticsEngine,
  type MultiSessionAnalyticsSample,
} from '../../../src/domain/multi-session-analytics/multi-session-analytics-engine';

const stableSamples: readonly MultiSessionAnalyticsSample[] = [
  {
    sessionId: 'session-001',
    startedAtEpochMs: 1000,
    paperSignals: 18,
    favorableSignals: 13,
    blockedSignals: 2,
    wins: 10,
    losses: 4,
    neutralOutcomes: 4,
    averageConfidenceScore: 0.78,
    averageConsensusScore: 0.8,
    maxDrawdownUnits: 2,
    operatorViolationCount: 0,
    certificationFailureCount: 0,
  },
  {
    sessionId: 'session-002',
    startedAtEpochMs: 2000,
    paperSignals: 20,
    favorableSignals: 15,
    blockedSignals: 2,
    wins: 12,
    losses: 4,
    neutralOutcomes: 4,
    averageConfidenceScore: 0.82,
    averageConsensusScore: 0.84,
    maxDrawdownUnits: 3,
    operatorViolationCount: 0,
    certificationFailureCount: 0,
  },
  {
    sessionId: 'session-003',
    startedAtEpochMs: 3000,
    paperSignals: 22,
    favorableSignals: 17,
    blockedSignals: 2,
    wins: 14,
    losses: 4,
    neutralOutcomes: 4,
    averageConfidenceScore: 0.84,
    averageConsensusScore: 0.86,
    maxDrawdownUnits: 2,
    operatorViolationCount: 0,
    certificationFailureCount: 0,
  },
];

describe('MultiSessionAnalyticsEngine', () => {
  it('classifies consistent multi-session paper history as stable', () => {
    const engine = new MultiSessionAnalyticsEngine();
    const result = engine.evaluate(stableSamples);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'STABLE_PAPER_PROGRESS');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.ok(
        result.value.reasons.includes('POSITIVE_MULTI_SESSION_CONSISTENCY'),
      );
    }
  });

  it('detects improving trend independently from input order', () => {
    const engine = new MultiSessionAnalyticsEngine();
    const result = engine.evaluate([...stableSamples].reverse());

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.trend, 'IMPROVING');
    }
  });

  it('keeps low session count neutral instead of over-trusting', () => {
    const engine = new MultiSessionAnalyticsEngine();
    const result = engine.evaluate([stableSamples[0]]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'NEUTRAL_PAPER_PROGRESS');
      assert.ok(result.value.reasons.includes('LOW_SESSION_COUNT'));
    }
  });

  it('blocks excessive drawdown across sessions', () => {
    const engine = new MultiSessionAnalyticsEngine();
    const result = engine.evaluate([
      stableSamples[0],
      {
        ...stableSamples[1],
        maxDrawdownUnits: 12,
      },
      stableSamples[2],
    ]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'BLOCKED_PAPER_PROGRESS');
      assert.ok(result.value.reasons.includes('EXCESSIVE_DRAWDOWN'));
    }
  });

  it('blocks operator discipline violations across sessions', () => {
    const engine = new MultiSessionAnalyticsEngine();
    const result = engine.evaluate([
      stableSamples[0],
      {
        ...stableSamples[1],
        operatorViolationCount: 1,
      },
      stableSamples[2],
    ]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'BLOCKED_PAPER_PROGRESS');
      assert.ok(
        result.value.reasons.includes('EXCESSIVE_OPERATOR_VIOLATIONS'),
      );
    }
  });

  it('rejects invalid sessions through Result without silent failure', () => {
    const engine = new MultiSessionAnalyticsEngine();
    const result = engine.evaluate([
      {
        ...stableSamples[0],
        sessionId: ' ',
      },
    ]);

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_MULTI_SESSION_ANALYTICS_INPUT');
    }
  });
});
