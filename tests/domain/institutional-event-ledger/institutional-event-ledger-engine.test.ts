import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InstitutionalEventLedgerEngine,
  type InstitutionalLedgerEvent,
} from '../../../src/domain/institutional-event-ledger/institutional-event-ledger-engine';

const stableEvents: readonly InstitutionalLedgerEvent[] = [
  {
    eventId: 'evt-003',
    sessionId: 'paper-session-220',
    occurredAtEpochMs: 3000,
    type: 'HUD_DECISION',
    severity: 'INFO',
    source: 'institutional-hud-summary',
    message: 'HUD indicou PAPER_FAVORAVEL.',
  },
  {
    eventId: 'evt-001',
    sessionId: 'paper-session-220',
    occurredAtEpochMs: 1000,
    type: 'SESSION_STARTED',
    severity: 'INFO',
    source: 'paper-runtime',
    message: 'Sessão PAPER iniciada.',
  },
  {
    eventId: 'evt-002',
    sessionId: 'paper-session-220',
    occurredAtEpochMs: 2000,
    type: 'CONFIDENCE_CALIBRATED',
    severity: 'INFO',
    source: 'adaptive-confidence',
    message: 'Confiança calibrada com sucesso.',
  },
];

describe('InstitutionalEventLedgerEngine', () => {
  it('builds a stable ordered paper-only ledger', () => {
    const engine = new InstitutionalEventLedgerEngine();
    const result = engine.buildLedger({
      sessionId: 'paper-session-220',
      events: stableEvents,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'LEDGER_STABLE');
      assert.equal(result.value.totalInputEvents, 3);
      assert.equal(result.value.totalLedgerEntries, 3);
      assert.equal(result.value.entries[0]?.eventId, 'evt-001');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.ok(result.value.reasons.includes('CHECKSUM_GENERATED'));
    }
  });

  it('deduplicates repeated event ids idempotently', () => {
    const engine = new InstitutionalEventLedgerEngine();
    const result = engine.buildLedger({
      sessionId: 'paper-session-220',
      events: [...stableEvents, stableEvents[0]],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.totalInputEvents, 4);
      assert.equal(result.value.totalLedgerEntries, 3);
      assert.equal(result.value.duplicateEventsRemoved, 1);
      assert.ok(result.value.reasons.includes('LEDGER_DEDUPLICATED'));
    }
  });

  it('generates deterministic ledger checksum regardless of input order', () => {
    const engine = new InstitutionalEventLedgerEngine();

    const first = engine.buildLedger({
      sessionId: 'paper-session-220',
      events: stableEvents,
    });

    const second = engine.buildLedger({
      sessionId: 'paper-session-220',
      events: [...stableEvents].reverse(),
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);

    if (first.ok && second.ok) {
      assert.equal(first.value.ledgerChecksum, second.value.ledgerChecksum);
    }
  });

  it('requires review for excessive warning events', () => {
    const engine = new InstitutionalEventLedgerEngine({
      maximumWarningsBeforeReview: 1,
      maximumBlockersBeforeBlocked: 0,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    const result = engine.buildLedger({
      sessionId: 'paper-session-220',
      events: [
        ...stableEvents,
        {
          eventId: 'evt-004',
          sessionId: 'paper-session-220',
          occurredAtEpochMs: 4000,
          type: 'OPERATOR_EVENT',
          severity: 'WARNING',
          source: 'operator-monitor',
          message: 'Operador em atenção.',
        },
        {
          eventId: 'evt-005',
          sessionId: 'paper-session-220',
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
      assert.equal(result.value.status, 'LEDGER_REQUIRES_REVIEW');
      assert.ok(result.value.reasons.includes('EXCESSIVE_WARNINGS'));
    }
  });

  it('blocks ledgers with blocker events', () => {
    const engine = new InstitutionalEventLedgerEngine();
    const result = engine.buildLedger({
      sessionId: 'paper-session-220',
      events: [
        ...stableEvents,
        {
          eventId: 'evt-004',
          sessionId: 'paper-session-220',
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
      assert.equal(result.value.status, 'LEDGER_BLOCKED');
      assert.ok(result.value.reasons.includes('LEDGER_HAS_BLOCKERS'));
      assert.ok(result.value.reasons.includes('EXCESSIVE_BLOCKERS'));
    }
  });

  it('rejects invalid ledger input through Result without silent failure', () => {
    const engine = new InstitutionalEventLedgerEngine();
    const result = engine.buildLedger({
      sessionId: 'paper-session-220',
      events: [
        {
          ...stableEvents[0],
          sessionId: 'another-session',
        },
      ],
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_INSTITUTIONAL_LEDGER_INPUT');
    }
  });
});
