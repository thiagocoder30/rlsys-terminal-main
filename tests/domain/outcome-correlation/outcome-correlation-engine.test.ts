import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  OutcomeCorrelationEngine,
  type OutcomeCorrelationSample,
} from '../../../src/domain/outcome-correlation/outcome-correlation-engine';

const supportiveSamples: readonly OutcomeCorrelationSample[] = [
  {
    sampleId: 'sample-001',
    contextId: 'context-001',
    strategyId: 'fusion',
    tableId: 'table-alpha',
    volatilityScore: 0.18,
    consensusScore: 0.86,
    confidenceScore: 0.84,
    riskScore: 0.18,
    operatorScore: 0.9,
    strategyReputationScore: 0.84,
    tableReputationScore: 0.82,
    memoryScore: 0.8,
    similarityScore: 0.88,
    outcomeScore: 0.84,
    blocked: false,
  },
  {
    sampleId: 'sample-002',
    contextId: 'context-002',
    strategyId: 'fusion',
    tableId: 'table-alpha',
    volatilityScore: 0.22,
    consensusScore: 0.84,
    confidenceScore: 0.82,
    riskScore: 0.2,
    operatorScore: 0.88,
    strategyReputationScore: 0.82,
    tableReputationScore: 0.8,
    memoryScore: 0.78,
    similarityScore: 0.86,
    outcomeScore: 0.82,
    blocked: false,
  },
  {
    sampleId: 'sample-003',
    contextId: 'context-003',
    strategyId: 'fusion',
    tableId: 'table-alpha',
    volatilityScore: 0.24,
    consensusScore: 0.82,
    confidenceScore: 0.8,
    riskScore: 0.22,
    operatorScore: 0.86,
    strategyReputationScore: 0.8,
    tableReputationScore: 0.78,
    memoryScore: 0.76,
    similarityScore: 0.84,
    outcomeScore: 0.8,
    blocked: false,
  },
];

describe('OutcomeCorrelationEngine', () => {
  it('supports paper when historical outcome correlations are positive', () => {
    const engine = new OutcomeCorrelationEngine();
    const result = engine.evaluate(supportiveSamples);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'CORRELATION_SUPPORTS_PAPER');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.equal(result.value.sampleCount, 3);
      assert.ok(result.value.reasons.includes('POSITIVE_CORRELATION_EVIDENCE'));
    }
  });

  it('keeps low sample evidence neutral', () => {
    const engine = new OutcomeCorrelationEngine();
    const result = engine.evaluate([supportiveSamples[0]]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'CORRELATION_NEUTRAL');
      assert.ok(result.value.reasons.includes('LOW_SAMPLE_SIZE'));
    }
  });

  it('blocks when risk correlation is excessive', () => {
    const engine = new OutcomeCorrelationEngine();
    const result = engine.evaluate(
      supportiveSamples.map((sample) => ({
        ...sample,
        riskScore: 0.9,
      })),
    );

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'CORRELATION_BLOCKED');
      assert.ok(result.value.reasons.includes('RISK_CORRELATION_BLOCKER'));
    }
  });

  it('blocks when operator correlation is too weak', () => {
    const engine = new OutcomeCorrelationEngine();
    const result = engine.evaluate(
      supportiveSamples.map((sample) => ({
        ...sample,
        operatorScore: 0.2,
      })),
    );

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'CORRELATION_BLOCKED');
      assert.ok(result.value.reasons.includes('OPERATOR_CORRELATION_BLOCKER'));
    }
  });

  it('degrades when support score is weak', () => {
    const engine = new OutcomeCorrelationEngine();
    const result = engine.evaluate(
      supportiveSamples.map((sample) => ({
        ...sample,
        consensusScore: 0.2,
        confidenceScore: 0.2,
        strategyReputationScore: 0.2,
        tableReputationScore: 0.2,
        memoryScore: 0.2,
        similarityScore: 0.2,
        outcomeScore: 0.2,
      })),
    );

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'CORRELATION_DEGRADED');
      assert.ok(result.value.reasons.includes('NEGATIVE_CORRELATION_EVIDENCE'));
    }
  });

  it('rejects invalid outcome input through Result', () => {
    const engine = new OutcomeCorrelationEngine();
    const result = engine.evaluate([
      {
        ...supportiveSamples[0],
        outcomeScore: 1.5,
      },
    ]);

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_OUTCOME_CORRELATION_INPUT');
    }
  });
});
