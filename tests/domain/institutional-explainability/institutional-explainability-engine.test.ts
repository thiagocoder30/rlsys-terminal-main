import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InstitutionalExplainabilityEngine,
  type InstitutionalExplainabilityInput,
} from '../../../src/domain/institutional-explainability/institutional-explainability-engine';

const favorableInput: InstitutionalExplainabilityInput = {
  sessionId: 'paper-session-217',
  strategyId: 'fusion',
  tableId: 'table-alpha',
  decisionStatus: 'PAPER_FAVORAVEL',
  calibratedConfidence: 0.84,
  institutionalScore: 0.86,
  signals: [
    {
      category: 'POLICY',
      severity: 'INFO',
      code: 'PAPER_ONLY_POLICY_LOCK',
      message: 'Sistema permanece travado em modo PAPER.',
      score: 1,
    },
    {
      category: 'CONSENSUS',
      severity: 'INFO',
      code: 'CONSENSUS_READY',
      message: 'Consenso institucional está alinhado.',
      score: 0.86,
    },
    {
      category: 'RISK',
      severity: 'INFO',
      code: 'RISK_READY',
      message: 'Risco operacional está controlado.',
      score: 0.82,
    },
  ],
};

describe('InstitutionalExplainabilityEngine', () => {
  it('explains paper favorable decisions without live money authorization', () => {
    const engine = new InstitutionalExplainabilityEngine();
    const result = engine.explain(favorableInput);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.decisionStatus, 'PAPER_FAVORAVEL');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.equal(result.value.blockers.length, 0);
      assert.ok(result.value.operatorSummary.includes('PAPER_FAVORAVEL'));
    }
  });

  it('prioritizes blockers before warnings and infos', () => {
    const engine = new InstitutionalExplainabilityEngine();
    const result = engine.explain({
      ...favorableInput,
      decisionStatus: 'NAO_UTILIZAR',
      signals: [
        ...favorableInput.signals,
        {
          category: 'RISK',
          severity: 'BLOCKER',
          code: 'RISK_BLOCKED',
          message: 'Risco operacional bloqueado.',
          score: 0.98,
        },
        {
          category: 'OPERATOR',
          severity: 'WARNING',
          code: 'OPERATOR_DEGRADED',
          message: 'Operador em condição degradada.',
          score: 0.72,
        },
      ],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.decisionStatus, 'NAO_UTILIZAR');
      assert.equal(result.value.blockers[0]?.code, 'RISK_BLOCKED');
      assert.ok(result.value.operatorSummary.includes('Risco operacional bloqueado'));
    }
  });

  it('explains observe decisions with warning context', () => {
    const engine = new InstitutionalExplainabilityEngine();
    const result = engine.explain({
      ...favorableInput,
      decisionStatus: 'OBSERVAR',
      calibratedConfidence: 0.58,
      institutionalScore: 0.6,
      signals: [
        {
          category: 'CONFIDENCE',
          severity: 'WARNING',
          code: 'INSUFFICIENT_CONFIDENCE',
          message: 'Confiança calibrada ainda moderada.',
          score: 0.58,
        },
      ],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.decisionStatus, 'OBSERVAR');
      assert.equal(result.value.warnings[0]?.code, 'INSUFFICIENT_CONFIDENCE');
      assert.ok(result.value.operatorSummary.includes('OBSERVAR'));
    }
  });

  it('limits operator messages deterministically', () => {
    const engine = new InstitutionalExplainabilityEngine({
      maximumOperatorMessages: 2,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    const result = engine.explain({
      ...favorableInput,
      signals: [
        ...favorableInput.signals,
        {
          category: 'TABLE',
          severity: 'WARNING',
          code: 'TABLE_DEGRADED',
          message: 'Mesa com reputação moderada.',
          score: 0.7,
        },
      ],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      const totalMessages =
        result.value.blockers.length +
        result.value.warnings.length +
        result.value.infos.length;

      assert.equal(totalMessages, 2);
    }
  });

  it('rejects invalid inputs through Result without silent failure', () => {
    const engine = new InstitutionalExplainabilityEngine();
    const result = engine.explain({
      ...favorableInput,
      sessionId: ' ',
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(
        result.error.code,
        'INVALID_INSTITUTIONAL_EXPLAINABILITY_INPUT',
      );
    }
  });

  it('rejects invalid signal score through Result', () => {
    const engine = new InstitutionalExplainabilityEngine();
    const result = engine.explain({
      ...favorableInput,
      signals: [
        {
          category: 'SYSTEM',
          severity: 'INFO',
          code: 'INVALID_SCORE',
          message: 'Invalid score.',
          score: 1.5,
        },
      ],
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(
        result.error.code,
        'INVALID_INSTITUTIONAL_EXPLAINABILITY_INPUT',
      );
    }
  });
});
