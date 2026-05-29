import test from 'node:test';
import assert from 'node:assert/strict';

import {
  InstitutionalAuditEngine
} from '../dist/domain/supervision/institutional-audit-engine.js';

const engine = new InstitutionalAuditEngine();

test('InstitutionalAuditEngine marks empty audit as non compliant while keeping gates blocked', () => {
  const report = engine.audit({ decisions: [] });

  assert.equal(report.finalVerdict, 'NON_COMPLIANT');
  assert.equal(report.decisionsAudited, 0);
  assert.equal(report.gate, 'BLOCKED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.paperSessionGate, 'BLOCKED');
  assert.equal(report.liveSessionGate, 'BLOCKED');
  assert.equal(report.liveMoneyAuthorized, false);
});

test('InstitutionalAuditEngine audits assisted decision with explainability trail', () => {
  const report = engine.audit({
    decisions: [
      {
        decisionId: 'd1',
        timestamp: 1,
        type: 'OBSERVATION_ONLY',
        reason: 'SESSION_RHYTHM_WITHIN_DEFENSIVE_LIMITS',
        evidenceScore: 91,
        riskPressure: 18
      },
      {
        decisionId: 'd2',
        timestamp: 2,
        type: 'ASSISTED_SUGGESTION',
        reason: 'ASSISTED_SESSION_CONTEXT_ELIGIBLE',
        evidenceScore: 88,
        riskPressure: 26
      }
    ]
  });

  assert.equal(report.finalVerdict, 'ASSISTED');
  assert.equal(report.counters.suggestions, 1);
  assert.equal(report.hasBlockingDecision, false);
  assert.ok(report.averageEvidenceScore >= 80);
});

test('InstitutionalAuditEngine prioritizes veto, cooldown and interruption correctly', () => {
  assert.equal(engine.audit({
    decisions: [
      { decisionId: 'd1', timestamp: 1, type: 'ASSISTED_SUGGESTION', reason: 'ASSIST', riskPressure: 20 },
      { decisionId: 'd2', timestamp: 2, type: 'SUPERVISOR_VETO', reason: 'VETO', riskPressure: 82 }
    ]
  }).finalVerdict, 'VETOED');

  assert.equal(engine.audit({
    decisions: [
      { decisionId: 'd1', timestamp: 1, type: 'SUPERVISOR_VETO', reason: 'VETO', riskPressure: 76 },
      { decisionId: 'd2', timestamp: 2, type: 'COOLDOWN_TRIGGERED', reason: 'COOLDOWN', riskPressure: 84 }
    ]
  }).finalVerdict, 'COOLDOWN');

  assert.equal(engine.audit({
    decisions: [
      { decisionId: 'd1', timestamp: 1, type: 'COOLDOWN_TRIGGERED', reason: 'COOLDOWN', riskPressure: 80 },
      { decisionId: 'd2', timestamp: 2, type: 'SESSION_INTERRUPTED', reason: 'INTERRUPT', riskPressure: 96 }
    ]
  }).finalVerdict, 'INTERRUPTED');
});

test('InstitutionalAuditEngine applies compliance penalty to unordered decisions', () => {
  const report = engine.audit({
    decisions: [
      { decisionId: 'd1', timestamp: 10, type: 'OBSERVATION_ONLY', reason: 'OBSERVED', riskPressure: 12 },
      { decisionId: 'd2', timestamp: 5, type: 'OBSERVATION_ONLY', reason: 'UNORDERED', riskPressure: 12 }
    ]
  });

  assert.equal(report.finalVerdict, 'OBSERVED');
  assert.ok(report.complianceScore < 100);
});

test('InstitutionalAuditEngine is deterministic and bounded', () => {
  const input = {
    decisions: [
      { decisionId: 'd1', timestamp: 1, type: 'OBSERVATION_ONLY', reason: 'OBSERVED', evidenceScore: 90, riskPressure: 10 }
    ]
  };

  const first = engine.audit(input);
  const second = engine.audit(input);

  assert.deepEqual(first, second);
  assert.ok(first.complianceScore >= 0 && first.complianceScore <= 100);
  assert.ok(first.highestRiskPressure >= 0 && first.highestRiskPressure <= 100);
});

test('InstitutionalAuditEngine rejects malformed decisions without silent failure', () => {
  assert.throws(
    () => engine.audit({
      decisions: [
        { decisionId: '', timestamp: 1, type: 'OBSERVATION_ONLY', reason: 'INVALID' }
      ]
    }),
    /INVALID_INSTITUTIONAL_AUDIT_DECISION_ID/
  );
});
