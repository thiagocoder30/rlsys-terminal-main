import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InstitutionalAuditTimelineEngine,
  type InstitutionalAuditTimelineEvent,
} from '../../../src/domain/institutional-audit-timeline/institutional-audit-timeline-engine';

const stableEvents: readonly InstitutionalAuditTimelineEvent[] = [
  {
    eventId: 'evt-003',
    sessionId: 'paper-session-219',
    occurredAtEpochMs: 3000,
    type: 'HUD_DECISION',
    severity: 'INFO',
    source: 'institutional-hud-summary',
    message: 'HUD indicou PAPER_FAVORAVEL.',
  },
  {
    eventId: 'evt-001',
    sessionId: 'paper-session-219',
    occurredAtEpochMs: 1000,
    type: 'SESSION_STARTED',
    severity: 'INFO',
    source: 'paper-runtime',
    message: 'Sessão PAPER iniciada.',
  },
  {
    eventId: 'evt-002',
    sessionId: 'paper-session-219',
    occurredAtEpochMs: 2000,
    type: 'CONFIDENCE_CALIBRATED',
    severity: 'INFO',
    source: 'adaptive-confidence',
    message: 'Confiança calibrada com sucesso.',
  },
];

describe('InstitutionalAuditTimelineEngine', () => {
  it('builds stable ordered audit timelines in paper-only mode', () => {
    const engine = new InstitutionalAuditTimelineEngine();
    const result = engine.buildTimeline({
      sessionId: 'paper-session-219',
      events: stableEvents,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'AUDIT_STABLE');
      assert.equal(result.value.totalEvents, 3);
      assert.equal(result.value.timeline[0]?.eventId, 'evt-001');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.ok(result.value.reasons.includes('TIMELINE_ORDERED'));
    }
  });

  it('requires review for warning-heavy timelines', () => {
    const engine = new InstitutionalAuditTimelineEngine({
      maximumWarningsBeforeReview: 1,
      maximumBlockersBeforeBlocked: 0,
      requireSessionFinished: false,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    const result = engine.buildTimeline({
      sessionId: 'paper-session-219',
      events: [
        ...stableEvents,
        {
          eventId: 'evt-004',
          sessionId: 'paper-session-219',
          occurredAtEpochMs: 4000,
          type: 'OPERATOR_EVENT',
          severity: 'WARNING',
          source: 'operator-monitor',
          message: 'Operador em atenção.',
        },
        {
          eventId: 'evt-005',
          sessionId: 'paper-session-219',
          occurredAtEpochMs: 5000,
          type: 'RISK_EVENT',
          severity: 'WARNING',
          source: 'risk-gate',
          message: 'Risco moderado detectado.',
        },
      ],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'AUDIT_REQUIRES_REVIEW');
      assert.ok(result.value.reasons.includes('EXCESSIVE_WARNINGS'));
    }
  });

  it('blocks timelines with blocker events', () => {
    const engine = new InstitutionalAuditTimelineEngine();
    const result = engine.buildTimeline({
      sessionId: 'paper-session-219',
      events: [
        ...stableEvents,
        {
          eventId: 'evt-004',
          sessionId: 'paper-session-219',
          occurredAtEpochMs: 4000,
          type: 'RISK_EVENT',
          severity: 'BLOCKER',
          source: 'risk-gate',
          message: 'Risco bloqueado.',
        },
      ],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'AUDIT_BLOCKED');
      assert.ok(result.value.reasons.includes('TIMELINE_HAS_BLOCKERS'));
      assert.ok(result.value.reasons.includes('EXCESSIVE_BLOCKERS'));
    }
  });

  it('requires review when policy requires finished session and it is absent', () => {
    const engine = new InstitutionalAuditTimelineEngine({
      maximumWarningsBeforeReview: 3,
      maximumBlockersBeforeBlocked: 0,
      requireSessionFinished: true,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    const result = engine.buildTimeline({
      sessionId: 'paper-session-219',
      events: stableEvents,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'AUDIT_REQUIRES_REVIEW');
      assert.ok(result.value.reasons.includes('SESSION_NOT_FINISHED'));
    }
  });

  it('accepts finished sessions when finish event exists', () => {
    const engine = new InstitutionalAuditTimelineEngine({
      maximumWarningsBeforeReview: 3,
      maximumBlockersBeforeBlocked: 0,
      requireSessionFinished: true,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    const result = engine.buildTimeline({
      sessionId: 'paper-session-219',
      events: [
        ...stableEvents,
        {
          eventId: 'evt-004',
          sessionId: 'paper-session-219',
          occurredAtEpochMs: 4000,
          type: 'SESSION_FINISHED',
          severity: 'INFO',
          source: 'paper-runtime',
          message: 'Sessão PAPER finalizada.',
        },
      ],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'AUDIT_STABLE');
    }
  });

  it('rejects invalid timeline input through Result without silent failure', () => {
    const engine = new InstitutionalAuditTimelineEngine();
    const result = engine.buildTimeline({
      sessionId: 'paper-session-219',
      events: [
        {
          ...stableEvents[0],
          sessionId: 'another-session',
        },
      ],
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(
        result.error.code,
        'INVALID_INSTITUTIONAL_AUDIT_TIMELINE_INPUT',
      );
    }
  });
});
