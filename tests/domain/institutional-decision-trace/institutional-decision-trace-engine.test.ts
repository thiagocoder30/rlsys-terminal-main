import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InstitutionalDecisionTraceEngine,
  type InstitutionalDecisionTraceInput,
} from '../../../src/domain/institutional-decision-trace/institutional-decision-trace-engine';

const alignedInput: InstitutionalDecisionTraceInput = {
  sessionId: 'paper-session-218',
  strategyId: 'fusion',
  tableId: 'table-alpha',
  requestedStatus: 'PAPER_FAVORAVEL',
  nodes: [
    {
      nodeId: 'certification',
      label: 'Certification Runtime',
      status: 'PASS',
      weight: 1,
      score: 0.9,
      message: 'Certificação PAPER aprovada.',
    },
    {
      nodeId: 'risk',
      label: 'Risk Gate',
      status: 'PASS',
      weight: 1,
      score: 0.86,
      message: 'Risco institucional controlado.',
    },
    {
      nodeId: 'confidence',
      label: 'Adaptive Confidence',
      status: 'PASS',
      weight: 1,
      score: 0.84,
      message: 'Confiança calibrada favorável.',
    },
  ],
};

describe('InstitutionalDecisionTraceEngine', () => {
  it('creates an aligned paper-only trace for favorable decisions', () => {
    const engine = new InstitutionalDecisionTraceEngine();
    const result = engine.trace(alignedInput);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.resolvedStatus, 'PAPER_FAVORAVEL');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.ok(result.value.reasons.includes('TRACE_ALIGNED'));
      assert.equal(result.value.steps.length, 3);
    }
  });

  it('blocks when any trace node is blocked', () => {
    const engine = new InstitutionalDecisionTraceEngine();
    const result = engine.trace({
      ...alignedInput,
      nodes: [
        ...alignedInput.nodes,
        {
          nodeId: 'operator',
          label: 'Operator Monitor',
          status: 'BLOCK',
          weight: 1,
          score: 0.1,
          message: 'Operador bloqueado por disciplina operacional.',
        },
      ],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.resolvedStatus, 'NAO_UTILIZAR');
      assert.ok(result.value.reasons.includes('TRACE_HAS_BLOCKERS'));
    }
  });

  it('downgrades weak traces to observe', () => {
    const engine = new InstitutionalDecisionTraceEngine();
    const result = engine.trace({
      ...alignedInput,
      nodes: [
        {
          nodeId: 'confidence',
          label: 'Adaptive Confidence',
          status: 'WARN',
          weight: 1,
          score: 0.65,
          message: 'Confiança moderada.',
        },
        {
          nodeId: 'consensus',
          label: 'Institutional Consensus',
          status: 'PASS',
          weight: 1,
          score: 0.62,
          message: 'Consenso moderado.',
        },
      ],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.resolvedStatus, 'OBSERVAR');
      assert.ok(result.value.reasons.includes('TRACE_HAS_WARNINGS'));
    }
  });

  it('blocks empty traces defensively', () => {
    const engine = new InstitutionalDecisionTraceEngine();
    const result = engine.trace({
      ...alignedInput,
      nodes: [],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.resolvedStatus, 'NAO_UTILIZAR');
      assert.ok(result.value.reasons.includes('TRACE_EMPTY'));
    }
  });

  it('orders blockers before warnings and pass nodes deterministically', () => {
    const engine = new InstitutionalDecisionTraceEngine();
    const result = engine.trace({
      ...alignedInput,
      nodes: [
        {
          nodeId: 'pass-node',
          label: 'Pass Node',
          status: 'PASS',
          weight: 3,
          score: 0.9,
          message: 'Pass.',
        },
        {
          nodeId: 'warn-node',
          label: 'Warn Node',
          status: 'WARN',
          weight: 2,
          score: 0.7,
          message: 'Warn.',
        },
        {
          nodeId: 'block-node',
          label: 'Block Node',
          status: 'BLOCK',
          weight: 1,
          score: 0.1,
          message: 'Block.',
        },
      ],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.steps[0]?.nodeId, 'block-node');
      assert.equal(result.value.steps[1]?.nodeId, 'warn-node');
      assert.equal(result.value.steps[2]?.nodeId, 'pass-node');
    }
  });

  it('rejects invalid trace input through Result without silent failure', () => {
    const engine = new InstitutionalDecisionTraceEngine();
    const result = engine.trace({
      ...alignedInput,
      sessionId: ' ',
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(
        result.error.code,
        'INVALID_INSTITUTIONAL_DECISION_TRACE_INPUT',
      );
    }
  });
});
