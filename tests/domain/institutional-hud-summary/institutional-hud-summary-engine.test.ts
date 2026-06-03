import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InstitutionalHudSummaryEngine,
  type InstitutionalHudSummaryInput,
} from '../../../src/domain/institutional-hud-summary/institutional-hud-summary-engine';

const favorableInput: InstitutionalHudSummaryInput = {
  sessionId: 'paper-session-216',
  strategyId: 'fusion',
  tableId: 'table-alpha',
  certificationStatus: 'ENABLED',
  readinessStatus: 'ENABLED',
  consensusStatus: 'ENABLED',
  strategyReputationStatus: 'ENABLED',
  tableReputationStatus: 'ENABLED',
  adaptiveConfidenceStatus: 'ENABLED',
  multiSessionAnalyticsStatus: 'ENABLED',
  operatorStatus: 'ENABLED',
  riskStatus: 'ENABLED',
  calibratedConfidence: 0.84,
  institutionalScore: 0.86,
};

describe('InstitutionalHudSummaryEngine', () => {
  it('summarizes aligned institutional context as paper favorable only', () => {
    const engine = new InstitutionalHudSummaryEngine();
    const result = engine.summarize(favorableInput);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'PAPER_FAVORAVEL');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.equal(result.value.modules.length, 9);
      assert.ok(result.value.reasons.includes('PAPER_ONLY_POLICY_LOCK'));
      assert.ok(result.value.reasons.includes('CERTIFICATION_READY'));
      assert.ok(result.value.reasons.includes('RISK_READY'));
    }
  });

  it('blocks when certification is blocked', () => {
    const engine = new InstitutionalHudSummaryEngine();
    const result = engine.summarize({
      ...favorableInput,
      certificationStatus: 'BLOCKED',
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'NAO_UTILIZAR');
      assert.ok(result.value.reasons.includes('CERTIFICATION_BLOCKED'));
    }
  });

  it('blocks when risk gate is blocked', () => {
    const engine = new InstitutionalHudSummaryEngine();
    const result = engine.summarize({
      ...favorableInput,
      riskStatus: 'BLOCKED',
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'NAO_UTILIZAR');
      assert.ok(result.value.reasons.includes('RISK_BLOCKED'));
    }
  });

  it('keeps moderate institutional context in observe status', () => {
    const engine = new InstitutionalHudSummaryEngine();
    const result = engine.summarize({
      ...favorableInput,
      calibratedConfidence: 0.58,
      institutionalScore: 0.6,
      consensusStatus: 'DEGRADED',
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'OBSERVAR');
    }
  });

  it('blocks insufficient institutional alignment', () => {
    const engine = new InstitutionalHudSummaryEngine();
    const result = engine.summarize({
      ...favorableInput,
      calibratedConfidence: 0.32,
      institutionalScore: 0.4,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'NAO_UTILIZAR');
      assert.ok(
        result.value.reasons.includes('INSUFFICIENT_INSTITUTIONAL_ALIGNMENT'),
      );
    }
  });

  it('rejects invalid input through Result without silent failure', () => {
    const engine = new InstitutionalHudSummaryEngine();
    const result = engine.summarize({
      ...favorableInput,
      sessionId: ' ',
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_INSTITUTIONAL_HUD_INPUT');
    }
  });
});
