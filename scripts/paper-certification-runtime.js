#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { PaperCertificationRuntime } = require('../dist/infrastructure/paper-operational/paper-certification-runtime');

const filePath = process.env.RLSYS_PAPER_CERTIFICATION_STATE_PATH
  || path.join(process.cwd(), 'data', 'paper-operational', 'certification-session.json');

const runtime = new PaperCertificationRuntime();

const result = runtime.certify({
  filePath,
  sessionId: process.env.RLSYS_PAPER_SESSION_ID || 'paper-certification-runtime',
  tradeId: 'paper-certification-trade',
  balance: 100,
  stake: 5,
  startedAtEpochMs: 1717200003000,
  maxBytes: 250000,
  minimumSuccessfulSteps: 10,
  minimumPersistedSteps: 8,
  requireAuditChain: true,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    status: result.value.status,
    reason: result.value.reason,
    sessionId: result.value.sessionId,
    e2eFinalDecision: result.value.e2eFinalDecision,
    e2eSuccessfulSteps: result.value.e2eSuccessfulSteps,
    e2ePersistedSteps: result.value.e2ePersistedSteps,
    auditChainValid: result.value.auditChainValid,
    auditEvents: result.value.auditLedger.totalEvents,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  }, null, 2));

  process.exitCode = result.value.status === 'PAPER_CERTIFIED' ? 0 : 1;
}
