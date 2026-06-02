#!/usr/bin/env node
'use strict';

const { PaperOperationalAuditEngine } = require('../dist/infrastructure/paper-operational/paper-operational-audit-engine');

const engine = new PaperOperationalAuditEngine();

const first = engine.append({
  eventId: 'audit-demo-prepare',
  sessionId: 'paper-audit-demo',
  tradeId: 'trade-audit-demo',
  action: 'prepare',
  result: 'PAPER_COMPATIVEL',
  occurredAtEpochMs: 1717200002001,
  payload: {
    command: 'prepare',
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  },
});

if (!first.ok) {
  console.error(JSON.stringify({ ok: false, error: first.error }, null, 2));
  process.exitCode = 1;
} else {
  const second = engine.append({
    eventId: 'audit-demo-finish',
    sessionId: 'paper-audit-demo',
    tradeId: 'trade-audit-demo',
    action: 'finish',
    result: 'PAPER_COMPATIVEL',
    occurredAtEpochMs: 1717200002002,
    payload: {
      command: 'finish',
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    },
    previousLedger: first.value.ledger,
  });

  const verification = second.ok ? engine.verify(second.value.ledger) : second;

  console.log(JSON.stringify({
    ok: second.ok && verification.ok,
    appendReason: second.ok ? second.value.reason : second.error.reason,
    verifyReason: verification.ok ? verification.value.reason : verification.error.reason,
    totalEvents: second.ok ? second.value.ledger.totalEvents : 0,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  }, null, 2));

  if (!second.ok || !verification.ok) {
    process.exitCode = 1;
  }
}
