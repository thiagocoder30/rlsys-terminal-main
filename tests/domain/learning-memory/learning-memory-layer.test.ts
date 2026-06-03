import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LearningMemoryLayer,
  type LearningMemorySample,
} from '../../../src/domain/learning-memory/learning-memory-layer';

const supportingSamples: readonly LearningMemorySample[] = [
  {
    memoryId: 'mem-001',
    contextKey: 'fusion:table-alpha:low-volatility',
    strategyId: 'fusion',
    tableId: 'table-alpha',
    occurredAtEpochMs: 1000,
    paperSignals: 20,
    favorableSignals: 15,
    blockedSignals: 2,
    wins: 11,
    losses: 4,
    neutralOutcomes: 5,
    confidenceScore: 0.8,
    consensusScore: 0.82,
    maxDrawdownUnits: 2,
    operatorViolationCount: 0,
    certificationFailureCount: 0,
  },
  {
    memoryId: 'mem-002',
    contextKey: 'fusion:table-alpha:low-volatility',
    strategyId: 'fusion',
    tableId: 'table-alpha',
    occurredAtEpochMs: 2000,
    paperSignals: 22,
    favorableSignals: 17,
    blockedSignals: 2,
    wins: 13,
    losses: 4,
    neutralOutcomes: 5,
    confidenceScore: 0.84,
    consensusScore: 0.86,
    maxDrawdownUnits: 3,
    operatorViolationCount: 0,
    certificationFailureCount: 0,
  },
  {
    memoryId: 'mem-003',
    contextKey: 'fusion:table-alpha:low-volatility',
    strategyId: 'fusion',
    tableId: 'table-alpha',
    occurredAtEpochMs: 3000,
    paperSignals: 24,
    favorableSignals: 19,
    blockedSignals: 2,
    wins: 15,
    losses: 4,
    neutralOutcomes: 5,
    confidenceScore: 0.86,
    consensusScore: 0.88,
    maxDrawdownUnits: 2,
    operatorViolationCount: 0,
    certificationFailureCount: 0,
  },
];

describe('LearningMemoryLayer', () => {
  it('classifies recurring positive paper context as memory support', () => {
    const layer = new LearningMemoryLayer();
    const result = layer.evaluate(supportingSamples);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'MEMORY_SUPPORTS_PAPER');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.equal(result.value.totalContexts, 1);
      assert.equal(result.value.contexts[0]?.status, 'MEMORY_SUPPORTS_PAPER');
      assert.ok(
        result.value.contexts[0]?.reasons.includes('POSITIVE_CONTEXT_MEMORY'),
      );
    }
  });

  it('keeps low sample memory neutral instead of over-learning', () => {
    const layer = new LearningMemoryLayer();
    const result = layer.evaluate([supportingSamples[0]]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'MEMORY_NEUTRAL');
      assert.equal(result.value.contexts[0]?.status, 'MEMORY_NEUTRAL');
      assert.ok(result.value.contexts[0]?.reasons.includes('LOW_SAMPLE_SIZE'));
    }
  });

  it('blocks memory contexts with excessive drawdown', () => {
    const layer = new LearningMemoryLayer();
    const result = layer.evaluate([
      supportingSamples[0],
      {
        ...supportingSamples[1],
        maxDrawdownUnits: 12,
      },
      supportingSamples[2],
    ]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'MEMORY_BLOCKED');
      assert.equal(result.value.contexts[0]?.status, 'MEMORY_BLOCKED');
      assert.ok(result.value.contexts[0]?.reasons.includes('EXCESSIVE_DRAWDOWN'));
    }
  });

  it('detects degrading context memory trend', () => {
    const layer = new LearningMemoryLayer();
    const result = layer.evaluate([
      supportingSamples[2],
      {
        ...supportingSamples[1],
        memoryId: 'mem-004',
        occurredAtEpochMs: 4000,
        wins: 3,
        losses: 10,
        confidenceScore: 0.42,
        consensusScore: 0.4,
      },
      {
        ...supportingSamples[0],
        memoryId: 'mem-005',
        occurredAtEpochMs: 5000,
        wins: 2,
        losses: 11,
        confidenceScore: 0.38,
        consensusScore: 0.36,
      },
    ]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.contexts[0]?.trend, 'DEGRADING');
      assert.ok(result.value.contexts[0]?.reasons.includes('CONTEXT_DEGRADING'));
    }
  });

  it('aggregates multiple context keys independently', () => {
    const layer = new LearningMemoryLayer();
    const result = layer.evaluate([
      ...supportingSamples,
      {
        memoryId: 'mem-004',
        contextKey: 'triplicacao:table-beta:high-volatility',
        strategyId: 'triplicacao',
        tableId: 'table-beta',
        occurredAtEpochMs: 1000,
        paperSignals: 10,
        favorableSignals: 2,
        blockedSignals: 5,
        wins: 1,
        losses: 5,
        neutralOutcomes: 4,
        confidenceScore: 0.36,
        consensusScore: 0.38,
        maxDrawdownUnits: 5,
        operatorViolationCount: 0,
        certificationFailureCount: 0,
      },
    ]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.totalContexts, 2);
      assert.equal(result.value.contexts[0]?.contextKey, 'fusion:table-alpha:low-volatility');
      assert.equal(result.value.contexts[1]?.contextKey, 'triplicacao:table-beta:high-volatility');
    }
  });

  it('rejects invalid memory input through Result without silent failure', () => {
    const layer = new LearningMemoryLayer();
    const result = layer.evaluate([
      {
        ...supportingSamples[0],
        memoryId: ' ',
      },
    ]);

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_LEARNING_MEMORY_INPUT');
    }
  });
});
