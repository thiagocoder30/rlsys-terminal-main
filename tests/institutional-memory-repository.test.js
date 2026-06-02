const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  InstitutionalMemoryRepository,
} = require('../dist/infrastructure/paper-operational/institutional-memory-repository');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-memory-repository-'));
}

function repository(rootDir) {
  return new InstitutionalMemoryRepository({
    rootDir,
    maxSessionFileBytes: 128000,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  });
}

function sessionRecord(overrides = {}) {
  return {
    sessionId: 'paper-memory-204',
    tableId: 'mesa-204',
    strategyId: 'fusion',
    startedAtEpochMs: 1717200060000,
    finishedAtEpochMs: 1717200160000,
    roundCount: 24,
    finalStatus: 'PAPER_FAVORAVEL',
    finalConfidence: 86.4,
    suggestionCount: 4,
    favorableSuggestionCount: 2,
    operatorStatus: 'OPERATOR_STABLE',
    consensusDecision: 'PAPER_CONSENSUS_READY',
    strategyReputation: 'REPUTATION_STRONG',
    tableReputation: 'TABLE_REPUTATION_STRONG',
    notes: ['Sessão exportada para laboratório institucional.'],
    ...overrides,
  };
}

test('InstitutionalMemoryRepository creates laboratory layout', async () => {
  const root = tempRoot();
  const repo = repository(root);

  const result = await repo.ensureLayout();

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'sessions')), true);
  assert.equal(fs.existsSync(path.join(root, 'index')), true);
  assert.equal(fs.existsSync(path.join(root, 'memory')), true);

  fs.rmSync(root, { recursive: true, force: true });
});

test('InstitutionalMemoryRepository saves and loads session idempotently', async () => {
  const root = tempRoot();
  const repo = repository(root);

  const first = await repo.saveSession(sessionRecord());
  const second = await repo.saveSession(sessionRecord({ finalConfidence: 87 }));

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const loaded = await repo.loadSession('paper-memory-204');

  assert.equal(loaded.ok, true);
  assert.equal(loaded.value.finalConfidence, 87);
  assert.equal(loaded.value.productionMoneyAllowed, false);
  assert.equal(loaded.value.liveMoneyAuthorization, false);

  fs.rmSync(root, { recursive: true, force: true });
});

test('InstitutionalMemoryRepository lists session ids sorted', async () => {
  const root = tempRoot();
  const repo = repository(root);

  await repo.saveSession(sessionRecord({ sessionId: 'session-bbb' }));
  await repo.saveSession(sessionRecord({ sessionId: 'session-aaa' }));

  const listed = await repo.listSessionIds();

  assert.equal(listed.ok, true);
  assert.deepEqual(listed.value, ['session-aaa', 'session-bbb']);

  fs.rmSync(root, { recursive: true, force: true });
});

test('InstitutionalMemoryRepository saves and loads index record', async () => {
  const root = tempRoot();
  const repo = repository(root);

  const saved = await repo.saveIndex('strategy-reputation-fusion', {
    key: 'strategy:fusion',
    updatedAtEpochMs: 1717200160000,
    sampleSize: 10,
    score: 0.86,
    suggestedWeight: 1.12,
    decision: 'REPUTATION_STRONG',
  });

  assert.equal(saved.ok, true);

  const loaded = await repo.loadIndex('strategy-reputation-fusion');

  assert.equal(loaded.ok, true);
  assert.equal(loaded.value.key, 'strategy:fusion');
  assert.equal(loaded.value.productionMoneyAllowed, false);
  assert.equal(loaded.value.liveMoneyAuthorization, false);

  fs.rmSync(root, { recursive: true, force: true });
});

test('InstitutionalMemoryRepository rejects live money session', async () => {
  const root = tempRoot();
  const repo = repository(root);

  const result = await repo.saveSession(sessionRecord({
    productionMoneyAllowed: true,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);

  fs.rmSync(root, { recursive: true, force: true });
});

test('InstitutionalMemoryRepository rejects malformed session', async () => {
  const root = tempRoot();
  const repo = repository(root);

  const result = await repo.saveSession(sessionRecord({
    sessionId: 'x',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_INSTITUTIONAL_MEMORY_INPUT');

  fs.rmSync(root, { recursive: true, force: true });
});

test('institutional-memory-repository-demo persists laboratory payload', () => {
  const root = tempRoot();

  const result = spawnSync(process.execPath, ['scripts/institutional-memory-repository-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      RLSYS_MEMORY_REPOSITORY_DIR: root,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, true);
  assert.deepEqual(payload.sessions, ['paper-memory-demo']);
  assert.equal(payload.index, 'strategy:fusion');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);

  fs.rmSync(root, { recursive: true, force: true });
});
