const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  PaperOperationalE2EHarness,
} = require('../dist/infrastructure/paper-operational/paper-operational-e2e-harness');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-paper-e2e-'));
  return {
    dir,
    filePath: path.join(dir, 'e2e-session.json'),
  };
}

test('PaperOperationalE2EHarness certifies complete persisted PAPER flow', () => {
  const target = tempFile();
  const result = new PaperOperationalE2EHarness().run({
    filePath: target.filePath,
    sessionId: 'paper-e2e-190',
    tradeId: 'trade-e2e-190',
    balance: 100,
    stake: 5,
    startedAtEpochMs: 1717200001000,
    maxBytes: 250000,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.finalDecision, 'PAPER_COMPATIVEL');
  assert.equal(result.value.reason, 'PAPER_OPERATIONAL_E2E_CERTIFIED');
  assert.equal(result.value.totalSteps, 10);
  assert.equal(result.value.successfulSteps, 10);
  assert.equal(result.value.persistedSteps >= 8, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(fs.existsSync(target.filePath), true);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperOperationalE2EHarness rejects live money flags', () => {
  const target = tempFile();
  const result = new PaperOperationalE2EHarness().run({
    filePath: target.filePath,
    sessionId: 'paper-e2e-live-190',
    tradeId: 'trade-e2e-live-190',
    balance: 100,
    stake: 5,
    startedAtEpochMs: 1717200001000,
    maxBytes: 250000,
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperOperationalE2EHarness rejects malformed input without silent failure', () => {
  const target = tempFile();
  const result = new PaperOperationalE2EHarness().run({
    filePath: target.filePath,
    sessionId: 'x',
    tradeId: 'trade-e2e-invalid-190',
    balance: 100,
    stake: 5,
    startedAtEpochMs: 1717200001000,
    maxBytes: 250000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_PAPER_OPERATIONAL_E2E_INPUT');

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('paper-operational-e2e-harness script emits PAPER_COMPATIVEL report', () => {
  const target = tempFile();
  const result = spawnSync(process.execPath, ['scripts/paper-operational-e2e-harness.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      RLSYS_PAPER_OPERATIONAL_STATE_PATH: target.filePath,
      RLSYS_PAPER_SESSION_ID: 'paper-e2e-script-190',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.finalDecision, 'PAPER_COMPATIVEL');
  assert.equal(payload.reason, 'PAPER_OPERATIONAL_E2E_CERTIFIED');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
  assert.equal(payload.steps.length, 10);

  fs.rmSync(target.dir, { recursive: true, force: true });
});
