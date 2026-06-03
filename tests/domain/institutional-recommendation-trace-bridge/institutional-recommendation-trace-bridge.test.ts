import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InstitutionalRecommendationTraceBridge,
  type RecommendationBridgeInput,
} from '../../../src/domain/institutional-recommendation-trace-bridge/institutional-recommendation-trace-bridge';

const favorableInput: RecommendationBridgeInput = {
  recommendationId: 'recommendation-229',
  sessionId: 'paper-session-229',
  strategyId: 'fusion',
  tableId: 'table-alpha',
  decision: 'PAPER_FAVORAVEL',
  institutionalScore: 0.84,
  learningScore: 0.82,
  defensiveBlock: false,
  occurredAtEpochMs: 1000,
  reasons: ['PAPER_ONLY_POLICY_LOCK', 'INSTITUTIONAL_ALIGNMENT_STRONG'],
};

describe('InstitutionalRecommendationTraceBridge', () => {
  it('bridges favorable recommendations into trace, explanation, audit and ledger artifacts', () => {
    const bridge = new InstitutionalRecommendationTraceBridge();
    const result = bridge.bridge(favorableInput);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'BRIDGE_TRACE_READY');
      assert.equal(result.value.decision, 'PAPER_FAVORAVEL');
      assert.equal(result.value.traceNodes.length, 3);
      assert.ok(result.value.explanationSignals.length >= 3);
      assert.equal(result.value.auditEvents.length, 3);
      assert.equal(result.value.ledgerEvents.length, 3);
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.ok(result.value.reasons.includes('TRACE_NODE_CREATED'));
      assert.ok(result.value.reasons.includes('LEDGER_EVENT_CREATED'));
    }
  });

  it('marks observe recommendations for trace review', () => {
    const bridge = new InstitutionalRecommendationTraceBridge();
    const result = bridge.bridge({
      ...favorableInput,
      decision: 'OBSERVAR',
      institutionalScore: 0.58,
      learningScore: 0.56,
      reasons: ['LEARNING_UNCERTAIN', 'INSTITUTIONAL_ALIGNMENT_MODERATE'],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'BRIDGE_TRACE_REVIEW');
      assert.equal(result.value.decision, 'OBSERVAR');
      assert.ok(result.value.reasons.includes('RECOMMENDATION_OBSERVE'));
      assert.equal(result.value.traceNodes[0]?.status, 'WARN');
    }
  });

  it('blocks trace bridge when recommendation is NAO_UTILIZAR', () => {
    const bridge = new InstitutionalRecommendationTraceBridge();
    const result = bridge.bridge({
      ...favorableInput,
      decision: 'NAO_UTILIZAR',
      institutionalScore: 0.3,
      learningScore: 0.2,
      defensiveBlock: true,
      reasons: ['RISK_BLOCKED', 'LEARNING_REJECTED'],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'BRIDGE_TRACE_BLOCKED');
      assert.equal(result.value.decision, 'NAO_UTILIZAR');
      assert.ok(result.value.reasons.includes('DEFENSIVE_BLOCK_ACTIVE'));
      assert.equal(result.value.traceNodes[2]?.status, 'BLOCK');
      assert.equal(result.value.auditEvents[0]?.severity, 'BLOCKER');
    }
  });

  it('creates deterministic ledger events from audit events', () => {
    const bridge = new InstitutionalRecommendationTraceBridge();
    const result = bridge.bridge(favorableInput);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(
        result.value.ledgerEvents[0]?.eventId,
        'recommendation-229:ledger:decision',
      );
      assert.equal(
        result.value.ledgerEvents[1]?.eventId,
        'recommendation-229:ledger:trace',
      );
      assert.equal(
        result.value.ledgerEvents[2]?.eventId,
        'recommendation-229:ledger:explanation',
      );
    }
  });

  it('maps risk and learning reasons into explanation categories', () => {
    const bridge = new InstitutionalRecommendationTraceBridge();
    const result = bridge.bridge({
      ...favorableInput,
      decision: 'NAO_UTILIZAR',
      defensiveBlock: true,
      reasons: ['RISK_BLOCKED', 'LEARNING_REJECTED'],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      const riskSignal = result.value.explanationSignals.find(
        (signal) => signal.code === 'RISK_BLOCKED',
      );
      const learningSignal = result.value.explanationSignals.find(
        (signal) => signal.code === 'LEARNING_REJECTED',
      );

      assert.equal(riskSignal?.category, 'RISK');
      assert.equal(learningSignal?.category, 'LEARNING');
      assert.equal(learningSignal?.severity, 'BLOCKER');
    }
  });

  it('rejects invalid bridge input through Result', () => {
    const bridge = new InstitutionalRecommendationTraceBridge();
    const result = bridge.bridge({
      ...favorableInput,
      recommendationId: ' ',
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_RECOMMENDATION_TRACE_BRIDGE_INPUT');
    }
  });
});
