const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  PaperOperationalAuditEngine,
} = require('../dist/infrastructure/paper-operational/paper-operational-audit-engine');

function appendPrepare(engine, previousLedger) {
  return engine.append({
    eventId: 'audit-prepare-191',
    sessionId: 'paper-audit-191',
    tradeId: 'trade-audit-191',
    action: 'prepare',
    result: 'PAPER_COMPATIVEL',
    occurredAtEpochMs: 1717200002000,
    payload: {
      command: 'prepare',
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    },
    previousLedger,
  });
}

test('PaperOperationalAuditEngine appends immutable audit event', () => {
  const result = appendPrepare(new PaperOperationalAuditEngine());

  assert.equal(result.ok, true);
  assert.equal(result.value.reason, 'PAPER_OPERATIONAL_AUDIT_APPENDED');
  assert.equal(result.value.event.sequence, 1);
  assert.equal(result.value.ledger.totalEvents, 1);
  assert.equal(result.value.event.productionMoneyAllowed, false);
  assert.equal(result.value.event.liveMoneyAuthorization, false);
  assert.equal(typeof result.value.event.integrityHash, 'string');
  assert.equal(result.value.event.integrityHash.length, 64);
});

test('PaperOperationalAuditEngine chains multiple audit events', () => {
  const engine = new PaperOperationalAuditEngine();
  const first = appendPrepare(engine);

  assert.equal(first.ok, true);

  const second = engine.append({
    eventId: 'audit-finish-191',
    sessionId: 'paper-audit-191',
    tradeId: 'trade-audit-191',
    action: 'finish',
    result: 'PAPER_COMPATIVEL',
    occurredAtEpochMs: 1717200002001,
    payload: {
      command: 'finish',
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    },
    previousLedger: first.value.ledger,
  });

  assert.equal(second.ok, true);
  assert.equal(second.value.ledger.totalEvents, 2);
  assert.equal(second.value.event.previousHash, first.value.event.integrityHash);
});

test('PaperOperationalAuditEngine replays identical event idempotently', () => {
  const engine = new PaperOperationalAuditEngine();
  const first = appendPrepare(engine);

  assert.equal(first.ok, true);

  const replay = appendPrepare(engine, first.value.ledger);

  assert.equal(replay.ok, true);
  assert.equal(replay.value.reason, 'PAPER_OPERATIONAL_AUDIT_REPLAYED_IDEMPOTENTLY');
  assert.deepEqual(replay.value.event, first.value.event);
});

test('PaperOperationalAuditEngine rejects duplicate audit event conflict', () => {
  const engine = new PaperOperationalAuditEngine();
  const first = appendPrepare(engine);

  assert.equal(first.ok, true);

  const conflict = engine.append({
    eventId: 'audit-prepare-191',
    sessionId: 'paper-audit-191',
    tradeId: 'trade-audit-191',
    action: 'open-paper',
    result: 'PAPER_COMPATIVEL',
    occurredAtEpochMs: 1717200002000,
    payload: {
      command: 'open-paper',
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    },
    previousLedger: first.value.ledger,
  });

  assert.equal(conflict.ok, false);
  assert.equal(conflict.error.reason, 'DUPLICATE_AUDIT_EVENT_CONFLICT');
});

test('PaperOperationalAuditEngine rejects live money flags in payload', () => {
  const result = new PaperOperationalAuditEngine().append({
    eventId: 'audit-live-191',
    sessionId: 'paper-audit-live-191',
    action: 'prepare',
    result: 'PAPER_COMPATIVEL',
    occurredAtEpochMs: 1717200002002,
    payload: {
      nested: {
        liveMoneyAuthorization: true,
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('PaperOperationalAuditEngine verifies valid audit chain', () => {
  const engine = new PaperOperationalAuditEngine();
  const first = appendPrepare(engine);

  assert.equal(first.ok, true);

  const verification = engine.verify(first.value.ledger);

  assert.equal(verification.ok, true);
  assert.equal(verification.value.reason, 'PAPER_OPERATIONAL_AUDIT_CHAIN_VALID');
});

test('PaperOperationalAuditEngine detects broken chain metadata', () => {
  const engine = new PaperOperationalAuditEngine();
  const first = appendPrepare(engine);

  assert.equal(first.ok, true);

  const corruptedLedger = {
    ...first.value.ledger,
    lastHash: 'broken-hash',
  };

  const verification = engine.verify(corruptedLedger);

  assert.equal(verification.ok, true);
  assert.equal(verification.value.reason, 'PAPER_OPERATIONAL_AUDIT_CHAIN_BROKEN');
});

test('paper-operational-audit-demo emits valid audit report', () => {
  const result = spawnSync(process.execPath, ['scripts/paper-operational-audit-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, true);
  assert.equal(payload.appendReason, 'PAPER_OPERATIONAL_AUDIT_APPENDED');
  assert.equal(payload.verifyReason, 'PAPER_OPERATIONAL_AUDIT_CHAIN_VALID');
  assert.equal(payload.totalEvents, 2);
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
