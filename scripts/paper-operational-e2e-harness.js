#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { PaperOperationalE2EHarness } = require('../dist/infrastructure/paper-operational/paper-operational-e2e-harness');

const filePath = process.env.RLSYS_PAPER_OPERATIONAL_STATE_PATH
  || path.join(process.cwd(), 'data', 'paper-operational', 'e2e-session.json');

const harness = new PaperOperationalE2EHarness();
const result = harness.run({
  filePath,
  sessionId: process.env.RLSYS_PAPER_SESSION_ID || 'paper-operational-e2e',
  tradeId: 'paper-operational-e2e-trade',
  balance: 100,
  stake: 5,
  startedAtEpochMs: 1717200001000,
  maxBytes: 250000,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
  process.exitCode = result.value.finalDecision === 'PAPER_COMPATIVEL' ? 0 : 1;
}
