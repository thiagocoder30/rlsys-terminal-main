const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  PaperOperationalStatefulCliEngine,
} = require('../dist/infrastructure/paper-operational/paper-operational-stateful-cli-engine');
const {
  PaperOperationalStateStore,
} = require('../dist/infrastructure/paper-operational/paper-operational-state-store');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-paper-stateful-'));
  return {
    dir,
    filePath: path.join(dir, 'session.json'),
  };
}

function createEngine(filePath) {
  const store = new PaperOperationalStateStore({
    filePath,
    maxBytes: 250000,
  });

  return new PaperOperationalStatefulCliEngine(store);
}

test('PaperOperationalStatefulCliEngine returns empty status before prepare', () => {
  const target = tempFile();
  const result = createEngine(target.filePath).execute({
    command: 'status',
    sessionId: 'paper-stateful-189',
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.reason, 'PAPER_STATEFUL_STATUS_EMPTY');
  assert.equal(result.value.persisted, false);
  assert.equal(result.value.productionMoneyAllowed, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperOperationalStatefulCliEngine persists prepare and loads status', () => {
  const target = tempFile();
  const engine = createEngine(target.filePath);

  const prepare = engine.execute({
    command: 'prepare',
    sessionId: 'paper-stateful-prepare-189',
    balance: 100,
    stake: 5,
  });

  assert.equal(prepare.ok, true);
  assert.equal(prepare.value.persisted, true);
  assert.equal(fs.existsSync(target.filePath), true);

  const status = engine.execute({
    command: 'status',
  });

  assert.equal(status.ok, true);
  assert.equal(status.value.reason, 'PAPER_STATEFUL_STATUS_LOADED');
  assert.equal(status.value.state.sessionId, 'paper-stateful-prepare-189');
  assert.equal(status.value.state.productionMoneyAllowed, false);
  assert.equal(status.value.state.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperOperationalStatefulCliEngine persists lifecycle commands', () => {
  const target = tempFile();
  const engine = createEngine(target.filePath);

  for (const command of ['open-paper', 'settle-win', 'settle-loss', 'settle-push', 'snapshot', 'recover', 'finish', 'demo']) {
    const result = engine.execute({
      command,
      sessionId: `paper-stateful-${command}-189`,
      tradeId: `trade-stateful-${command}-189`,
      balance: 100,
      stake: 5,
    });

    assert.equal(result.ok, true);
    assert.equal(result.value.persisted, true);
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.liveMoneyAuthorization, false);
    assert.equal(result.value.state.productionMoneyAllowed, false);
  }

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperOperationalStatefulCliEngine rejects live money flags', () => {
  const target = tempFile();
  const result = createEngine(target.filePath).execute({
    command: 'prepare',
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('paper-operational-stateful-cli persists through script commands', () => {
  const target = tempFile();
  const env = {
    ...process.env,
    RLSYS_PAPER_OPERATIONAL_STATE_PATH: target.filePath,
  };

  const prepare = spawnSync(process.execPath, [
    'scripts/paper-operational-stateful-cli.js',
    'prepare',
    '--sessionId',
    'paper-stateful-script-189',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env,
  });

  assert.equal(prepare.status, 0, prepare.stderr);
  const preparePayload = JSON.parse(prepare.stdout);
  assert.equal(preparePayload.persisted, true);

  const status = spawnSync(process.execPath, [
    'scripts/paper-operational-stateful-cli.js',
    'status',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env,
  });

  assert.equal(status.status, 0, status.stderr);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.reason, 'PAPER_STATEFUL_STATUS_LOADED');
  assert.equal(statusPayload.state.sessionId, 'paper-stateful-script-189');
  assert.equal(statusPayload.productionMoneyAllowed, false);
  assert.equal(statusPayload.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});
