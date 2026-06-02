const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  PaperOperationalStateStore,
} = require('../dist/infrastructure/paper-operational/paper-operational-state-store');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-paper-persistence-'));
  return {
    dir,
    filePath: path.join(dir, 'session.json'),
  };
}

function createState(overrides = {}) {
  return {
    sessionId: 'paper-persistence-188',
    schemaVersion: 1,
    savedAtEpochMs: 1717200000000,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    payload: {
      snapshot: {
        state: 'SETTLED',
        currentBalance: 105,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    },
    ...overrides,
  };
}

test('PaperOperationalStateStore saves and loads paper operational state atomically', () => {
  const target = tempFile();
  const store = new PaperOperationalStateStore({
    filePath: target.filePath,
    maxBytes: 250000,
  });

  const save = store.save({ state: createState() });

  assert.equal(save.ok, true);
  assert.equal(save.reason, 'PAPER_OPERATIONAL_STATE_SAVED');
  assert.equal(fs.existsSync(target.filePath), true);

  const load = store.load();

  assert.equal(load.ok, true);
  assert.equal(load.reason, 'PAPER_OPERATIONAL_STATE_LOADED');
  assert.equal(load.state.sessionId, 'paper-persistence-188');
  assert.equal(load.state.productionMoneyAllowed, false);
  assert.equal(load.state.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperOperationalStateStore returns not found for missing state', () => {
  const target = tempFile();
  const store = new PaperOperationalStateStore({
    filePath: target.filePath,
    maxBytes: 250000,
  });

  const load = store.load();

  assert.equal(load.ok, true);
  assert.equal(load.reason, 'PAPER_OPERATIONAL_STATE_NOT_FOUND');

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperOperationalStateStore replays identical save idempotently', () => {
  const target = tempFile();
  const store = new PaperOperationalStateStore({
    filePath: target.filePath,
    maxBytes: 250000,
  });
  const state = createState();

  const first = store.save({ state });
  assert.equal(first.ok, true);

  const replay = store.save({ state });

  assert.equal(replay.ok, true);
  assert.equal(replay.reason, 'PAPER_OPERATIONAL_STATE_REPLAYED_IDEMPOTENTLY');

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperOperationalStateStore rejects live money flags in top-level state', () => {
  const target = tempFile();
  const store = new PaperOperationalStateStore({
    filePath: target.filePath,
    maxBytes: 250000,
  });

  const result = store.save({
    state: createState({
      productionMoneyAllowed: true,
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_PAPER_OPERATIONAL_STATE');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperOperationalStateStore rejects nested live money flags in payload', () => {
  const target = tempFile();
  const store = new PaperOperationalStateStore({
    filePath: target.filePath,
    maxBytes: 250000,
  });

  const result = store.save({
    state: createState({
      payload: {
        unsafe: {
          liveMoneyAuthorization: true,
        },
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_PAPER_OPERATIONAL_STATE');

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperOperationalStateStore rejects oversized persisted state', () => {
  const target = tempFile();
  const store = new PaperOperationalStateStore({
    filePath: target.filePath,
    maxBytes: 512,
  });

  const result = store.save({
    state: createState({
      payload: {
        big: 'x'.repeat(2000),
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_PAPER_OPERATIONAL_STATE');

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('paper-operational-persistence-demo writes and loads state JSON', () => {
  const target = tempFile();

  const result = spawnSync(process.execPath, ['scripts/paper-operational-persistence-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      RLSYS_PAPER_OPERATIONAL_STATE_PATH: target.filePath,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, true);
  assert.equal(payload.saveReason, 'PAPER_OPERATIONAL_STATE_SAVED');
  assert.equal(payload.loadReason, 'PAPER_OPERATIONAL_STATE_LOADED');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
  assert.equal(fs.existsSync(target.filePath), true);

  fs.rmSync(target.dir, { recursive: true, force: true });
});
