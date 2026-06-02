const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  InstitutionalMemoryRepository,
} = require('../dist/infrastructure/paper-operational/institutional-memory-repository');

const {
  SessionLearningRepositoryAdapter,
} = require('../dist/infrastructure/paper-operational/session-learning-repository-adapter');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-learning-adapter-'));
}

function adapter(rootDir) {
  const repository = new InstitutionalMemoryRepository({
    rootDir,
    maxSessionFileBytes: 128000,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  });

  return {
    repository,
    adapter: new SessionLearningRepositoryAdapter(repository),
  };
}

function input(overrides = {}) {
  return {
    sessionId: 'paper-learning-adapter-206',
    tableId: 'mesa-206',
    strategyId: 'fusion',
    startedAtEpochMs: 1717200060000,
    finishedAtEpochMs: 1717200160000,
    roundCount: 24,
    operatorStatus: 'OPERATOR_STABLE',
    consensusDecision: 'PAPER_CONSENSUS_READY',
    strategyReputation: 'REPUTATION_STRONG',
    tableReputation: 'TABLE_REPUTATION_STRONG',
    suggestions: [
      { status: 'PAPER_FAVORAVEL', finalConfidence: 86, manualUseAllowed: true, occurredAtEpochMs: 1717200070000 },
      { status: 'PAPER_OBSERVAR', finalConfidence: 72, manualUseAllowed: false, occurredAtEpochMs: 1717200080000 },
      { status: 'PAPER_CERTIFICADO', finalConfidence: 89, manualUseAllowed: true, occurredAtEpochMs: 1717200090000 },
    ],
    ...overrides,
  };
}

test('SessionLearningRepositoryAdapter learns and persists session plus indexes', async () => {
  const root = tempRoot();
  const setup = adapter(root);

  const result = await setup.adapter.learnAndPersist(input());

  assert.equal(result.ok, true);
  assert.equal(result.value.savedSessionId, 'paper-learning-adapter-206');
  assert.equal(result.value.savedStrategyIndex, 'strategy-fusion');
  assert.equal(result.value.savedTableIndex, 'table-mesa-206');

  const session = await setup.repository.loadSession('paper-learning-adapter-206');
  const strategyIndex = await setup.repository.loadIndex('strategy-fusion');
  const tableIndex = await setup.repository.loadIndex('table-mesa-206');

  assert.equal(session.ok, true);
  assert.equal(strategyIndex.ok, true);
  assert.equal(tableIndex.ok, true);
  assert.equal(session.value.productionMoneyAllowed, false);
  assert.equal(strategyIndex.value.liveMoneyAuthorization, false);
  assert.equal(tableIndex.value.liveMoneyAuthorization, false);

  fs.rmSync(root, { recursive: true, force: true });
});

test('SessionLearningRepositoryAdapter is idempotent by session id and index names', async () => {
  const root = tempRoot();
  const setup = adapter(root);

  const first = await setup.adapter.learnAndPersist(input());
  const second = await setup.adapter.learnAndPersist(input({
    suggestions: [
      { status: 'PAPER_CERTIFICADO', finalConfidence: 91, manualUseAllowed: true, occurredAtEpochMs: 1717200090000 },
    ],
  }));

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const listed = await setup.repository.listSessionIds();

  assert.equal(listed.ok, true);
  assert.deepEqual(listed.value, ['paper-learning-adapter-206']);

  const session = await setup.repository.loadSession('paper-learning-adapter-206');

  assert.equal(session.ok, true);
  assert.equal(session.value.suggestionCount, 1);

  fs.rmSync(root, { recursive: true, force: true });
});

test('SessionLearningRepositoryAdapter rejects live money flags before learning', async () => {
  const root = tempRoot();
  const setup = adapter(root);

  const result = await setup.adapter.learnAndPersist(input({
    sessionId: 'x',
    productionMoneyAllowed: true,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);

  fs.rmSync(root, { recursive: true, force: true });
});

test('SessionLearningRepositoryAdapter returns invalid input for malformed learning payload', async () => {
  const root = tempRoot();
  const setup = adapter(root);

  const result = await setup.adapter.learnAndPersist(input({
    sessionId: 'x',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_SESSION_LEARNING_REPOSITORY_INPUT');

  fs.rmSync(root, { recursive: true, force: true });
});

test('session-learning-repository-adapter-demo persists payload', () => {
  const root = tempRoot();

  const result = spawnSync(process.execPath, ['scripts/session-learning-repository-adapter-demo.js'], {
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
  assert.equal(payload.savedSessionId, 'paper-learning-adapter-demo');
  assert.equal(payload.savedStrategyIndex, 'strategy-fusion');
  assert.equal(payload.savedTableIndex, 'table-mesa-demo');
  assert.deepEqual(payload.sessions, ['paper-learning-adapter-demo']);
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);

  fs.rmSync(root, { recursive: true, force: true });
});
