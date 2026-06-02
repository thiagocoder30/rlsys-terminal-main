#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { PaperOperationalCliModeEngine } = require('../dist/domain/bankroll/paper-operational-cli-mode-engine');
const { PaperOperationalStateStore } = require('../dist/infrastructure/paper-operational/paper-operational-state-store');

const outputPath = process.env.RLSYS_PAPER_OPERATIONAL_STATE_PATH
  || path.join(process.cwd(), 'data', 'paper-operational', 'session.json');

const engine = new PaperOperationalCliModeEngine();
const demo = engine.execute({
  command: 'demo',
  sessionId: 'paper-operational-demo',
  tradeId: 'paper-operational-demo-trade',
  balance: 100,
  stake: 5,
});

if (!demo.ok) {
  console.error(JSON.stringify({ ok: false, error: demo.error }, null, 2));
  process.exitCode = 1;
} else {
  const store = new PaperOperationalStateStore({
    filePath: outputPath,
    maxBytes: 250000,
  });

  const save = store.save({
    state: {
      sessionId: 'paper-operational-demo',
      schemaVersion: 1,
      savedAtEpochMs: 1717200000100,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      payload: demo.value.data,
    },
  });

  const load = store.load();

  console.log(JSON.stringify({
    ok: save.ok && load.ok,
    saveReason: save.ok ? save.reason : save.error.reason,
    loadReason: load.ok ? load.reason : load.error.reason,
    filePath: outputPath,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  }, null, 2));

  if (!save.ok || !load.ok) {
    process.exitCode = 1;
  }
}
