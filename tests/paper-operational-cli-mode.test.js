const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  PaperOperationalCliModeEngine,
} = require('../dist/domain/bankroll/paper-operational-cli-mode-engine');

test('PaperOperationalCliModeEngine renders status with live money blocked', () => {
  const result = new PaperOperationalCliModeEngine().execute({
    command: 'status',
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.reason, 'PAPER_CLI_STATUS_RENDERED');
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('PaperOperationalCliModeEngine prepares a paper session', () => {
  const result = new PaperOperationalCliModeEngine().execute({
    command: 'prepare',
    sessionId: 'paper-cli-187',
    balance: 100,
    stake: 5,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.reason, 'PAPER_CLI_SESSION_PREPARED');
  assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
  assert.equal(result.value.data.account.productionMoneyAllowed, false);
});

test('PaperOperationalCliModeEngine opens paper entry with manual confirmation through coordinator', () => {
  const result = new PaperOperationalCliModeEngine().execute({
    command: 'open-paper',
    sessionId: 'paper-cli-open-187',
    tradeId: 'trade-cli-open-187',
    balance: 100,
    stake: 5,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.reason, 'PAPER_CLI_ENTRY_OPENED');
  assert.equal(result.value.data.entry.productionMoneyAllowed, false);
});

test('PaperOperationalCliModeEngine settles win, loss, and push commands', () => {
  const engine = new PaperOperationalCliModeEngine();

  for (const command of ['settle-win', 'settle-loss', 'settle-push']) {
    const result = engine.execute({
      command,
      sessionId: `paper-cli-${command}-187`,
      tradeId: `trade-cli-${command}-187`,
      balance: 100,
      stake: 5,
    });

    assert.equal(result.ok, true);
    assert.equal(result.value.reason, 'PAPER_CLI_TRADE_SETTLED');
    assert.equal(result.value.data.settlement.productionMoneyAllowed, false);
    assert.equal(result.value.data.final.liveMoneyAuthorization, false);
  }
});

test('PaperOperationalCliModeEngine creates snapshot and recovery outputs', () => {
  const engine = new PaperOperationalCliModeEngine();

  const snapshot = engine.execute({
    command: 'snapshot',
    sessionId: 'paper-cli-snapshot-187',
    balance: 100,
    stake: 5,
  });

  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.value.reason, 'PAPER_CLI_SNAPSHOT_CREATED');
  assert.equal(snapshot.value.data.snapshot.productionMoneyAllowed, false);

  const recovery = engine.execute({
    command: 'recover',
    sessionId: 'paper-cli-recovery-187',
    balance: 100,
    stake: 5,
  });

  assert.equal(recovery.ok, true);
  assert.equal(recovery.value.reason, 'PAPER_CLI_RECOVERY_CREATED');
  assert.equal(recovery.value.data.recovery.liveMoneyAuthorization, false);
});

test('PaperOperationalCliModeEngine runs end-to-end demo', () => {
  const result = new PaperOperationalCliModeEngine().execute({
    command: 'demo',
    sessionId: 'paper-cli-demo-187',
    tradeId: 'trade-cli-demo-187',
    balance: 100,
    stake: 5,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.reason, 'PAPER_CLI_DEMO_COMPLETED');
  assert.equal(result.value.data.snapshot.lastOutcome, 'WIN');
  assert.equal(result.value.productionMoneyAllowed, false);
});

test('PaperOperationalCliModeEngine rejects live money flags', () => {
  const result = new PaperOperationalCliModeEngine().execute({
    command: 'prepare',
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('paper-operational-cli script prints JSON status', () => {
  const result = spawnSync(process.execPath, ['scripts/paper-operational-cli.js', 'status'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.reason, 'PAPER_CLI_STATUS_RENDERED');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});

test('paper-operational-cli script runs JSON demo', () => {
  const result = spawnSync(process.execPath, ['scripts/paper-operational-cli.js', 'demo', '--sessionId', 'paper-cli-script-demo-187'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.reason, 'PAPER_CLI_DEMO_COMPLETED');
  assert.equal(payload.data.snapshot.lastOutcome, 'WIN');
});
