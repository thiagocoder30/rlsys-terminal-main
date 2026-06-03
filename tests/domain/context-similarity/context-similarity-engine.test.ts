import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ContextSimilarityEngine,
  type ContextSimilarityInput,
} from '../../../src/domain/context-similarity/context-similarity-engine';

const baseInput: ContextSimilarityInput = {
  currentContextId: 'current-context-223',
  strategyId: 'fusion',
  tableId: 'table-alpha',
  currentVector: {
    volatilityScore: 0.22,
    consensusScore: 0.86,
    confidenceScore: 0.84,
    riskScore: 0.18,
    operatorScore: 0.9,
    strategyReputationScore: 0.84,
    tableReputationScore: 0.82,
    memoryScore: 0.8,
  },
  references: [
    {
      contextId: 'historical-positive',
      strategyId: 'fusion',
      tableId: 'table-alpha',
      vector: {
        volatilityScore: 0.24,
        consensusScore: 0.84,
        confidenceScore: 0.82,
        riskScore: 0.2,
        operatorScore: 0.88,
        strategyReputationScore: 0.82,
        tableReputationScore: 0.8,
        memoryScore: 0.78,
      },
      historicalOutcomeScore: 0.82,
      blocked: false,
    },
    {
      contextId: 'historical-distant',
      strategyId: 'triplicacao',
      tableId: 'table-beta',
      vector: {
        volatilityScore: 0.88,
        consensusScore: 0.3,
        confidenceScore: 0.28,
        riskScore: 0.8,
        operatorScore: 0.5,
        strategyReputationScore: 0.36,
        tableReputationScore: 0.34,
        memoryScore: 0.3,
      },
      historicalOutcomeScore: 0.25,
      blocked: false,
    },
  ],
};

describe('ContextSimilarityEngine', () => {
  it('supports paper when a highly similar positive historical context exists', () => {
    const engine = new ContextSimilarityEngine();
    const result = engine.evaluate(baseInput);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'SIMILARITY_SUPPORTS_PAPER');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.equal(result.value.bestMatch?.contextId, 'historical-positive');
      assert.ok(result.value.reasons.includes('HIGH_SIMILARITY'));
      assert.ok(result.value.reasons.includes('SIMILAR_CONTEXT_POSITIVE'));
    }
  });

  it('stays neutral when there are no reference contexts', () => {
    const engine = new ContextSimilarityEngine();
    const result = engine.evaluate({
      ...baseInput,
      references: [],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'SIMILARITY_NEUTRAL');
      assert.equal(result.value.bestMatch, null);
      assert.ok(result.value.reasons.includes('NO_REFERENCE_CONTEXTS'));
    }
  });

  it('stays neutral when no reference reaches moderate similarity', () => {
    const engine = new ContextSimilarityEngine();
    const result = engine.evaluate({
      ...baseInput,
      references: [baseInput.references[1]],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'SIMILARITY_NEUTRAL');
      assert.equal(result.value.bestMatch, null);
      assert.ok(result.value.reasons.includes('NO_SIMILAR_CONTEXT'));
    }
  });

  it('blocks when the most similar context was institutionally blocked', () => {
    const engine = new ContextSimilarityEngine();
    const result = engine.evaluate({
      ...baseInput,
      references: [
        {
          ...baseInput.references[0],
          contextId: 'historical-blocked',
          blocked: true,
        },
      ],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'SIMILARITY_BLOCKED');
      assert.ok(result.value.reasons.includes('SIMILAR_CONTEXT_BLOCKED'));
    }
  });

  it('degrades when similar context has negative historical outcome', () => {
    const engine = new ContextSimilarityEngine();
    const result = engine.evaluate({
      ...baseInput,
      references: [
        {
          ...baseInput.references[0],
          contextId: 'historical-negative',
          historicalOutcomeScore: 0.3,
        },
      ],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'SIMILARITY_DEGRADED');
      assert.ok(result.value.reasons.includes('SIMILAR_CONTEXT_NEGATIVE'));
    }
  });

  it('rejects invalid vector values through Result', () => {
    const engine = new ContextSimilarityEngine();
    const result = engine.evaluate({
      ...baseInput,
      currentVector: {
        ...baseInput.currentVector,
        confidenceScore: 1.5,
      },
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_CONTEXT_SIMILARITY_INPUT');
    }
  });
});
