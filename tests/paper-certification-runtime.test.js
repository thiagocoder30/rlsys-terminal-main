const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  PaperCertificationRuntime,
} = require('../dist/infrastructure/paper-operational/paper-certification-runtime');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-paper-certification-'));
  return {
    dir,
    filePath: path.join(dir, 'certification-session.json'),
  };
}

function createInput(filePath, overrides = {}) {
  return {
    filePath,
    sessionId: 'paper-certification-192',
    tradeId: 'trade-certification-192',
    balance: 100,
    stake: 5,
    startedAtEpochMs: 1717200003000,
    maxBytes: 250000,
    minimumSuccessfulSteps: 10,
    minimumPersistedSteps: 8,
    requireAuditChain: true,
    ...overrides,
  };
}

test('PaperCertificationRuntime grants PAPER_CERTIFIED for valid E2E and audit chain', () => {
  const target = tempFile();
  const result = new PaperCertificationRuntime().certify(createInput(target.filePath));

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_CERTIFIED');
  assert.equal(result.value.reason, 'PAPER_CERTIFICATION_GRANTED');
  assert.equal(result.value.e2eFinalDecision, 'PAPER_COMPATIVEL');
  assert.equal(result.value.auditChainValid, true);
  assert.equal(result.value.auditLedger.totalEvents, result.value.e2eReport.steps.length + 1);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperCertificationRuntime returns NEEDS_REVIEW when thresholds are stricter than observed flow', () => {
  const target = tempFile();
  const result = new PaperCertificationRuntime().certify(createInput(target.filePath, {
    sessionId: 'paper-certification-review-192',
    minimumSuccessfulSteps: 99,
    minimumPersistedSteps: 99,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'NEEDS_REVIEW');
  assert.equal(result.value.reason, 'PAPER_CERTIFICATION_NEEDS_REVIEW');
  assert.equal(result.value.productionMoneyAllowed, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperCertificationRuntime rejects live money flags', () => {
  const target = tempFile();
  const result = new PaperCertificationRuntime().certify(createInput(target.filePath, {
    sessionId: 'paper-certification-live-192',
    productionMoneyAllowed: true,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperCertificationRuntime rejects malformed input without silent failure', () => {
  const target = tempFile();
  const result = new PaperCertificationRuntime().certify(createInput(target.filePath, {
    sessionId: 'x',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_PAPER_CERTIFICATION_INPUT');

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('paper-certification-runtime script emits PAPER_CERTIFIED summary', () => {
  const target = tempFile();
  const result = spawnSync(process.execPath, ['scripts/paper-certification-runtime.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      RLSYS_PAPER_CERTIFICATION_STATE_PATH: target.filePath,
      RLSYS_PAPER_SESSION_ID: 'paper-certification-script-192',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, true);
  assert.equal(payload.status, 'PAPER_CERTIFIED');
  assert.equal(payload.reason, 'PAPER_CERTIFICATION_GRANTED');
  assert.equal(payload.e2eFinalDecision, 'PAPER_COMPATIVEL');
  assert.equal(payload.auditChainValid, true);
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});
