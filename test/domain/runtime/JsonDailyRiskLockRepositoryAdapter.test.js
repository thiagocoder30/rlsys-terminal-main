'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  JsonDailyRiskLockRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonDailyRiskLockRepositoryAdapter.js');

function lock(overrides = {}) {
  return {
    lockId: 'daily-lock-274',
    sessionId: 'session-274',
    strategyName: 'Triplicação',
    operationalDay: '2026-06-08',
    reason: 'STOP_LOSS_REACHED',
    lockedAtEpochMs: 1760000000000,
    unlockAtEpochMs: 1760054400000,
    bankroll: 70,
    riskMode: 'CONSERVATIVE',
    currentSessionPnl: -3.5,
    stopWinAmount: 5.6,
    stopLossAmount: 3.5,
    bankrollGateVerdict: 'BLOCKED',
    bankrollGateReason: 'Stop loss diário atingido. Encerrar sessão para preservar a banca.',
    isActive: true,
    operatorSummary: 'Stop Loss atingido. Bloqueio diário criado.',
    operatorDecisionRequired: true,
    supervisedRecommendationOnly: true,
    institutionalAnalysisMode: true,
    ...overrides,
  };
}

async function tempRepo() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-daily-risk-lock-'));
  const filePath = join(dir, 'daily-risk-lock.json');
  const repository = new JsonDailyRiskLockRepositoryAdapter({ filePath });

  return { dir, filePath, repository };
}

test('json daily risk lock repository saves and loads lock snapshot', async () => {
  const { dir, filePath, repository } = await tempRepo();

  try {
    const saved = await repository.save(lock());
    assert.equal(saved.ok, true);
    assert.equal(saved.value.lockId, 'daily-lock-274');

    const raw = await readFile(filePath, 'utf8');
    assert.match(raw, /daily-lock-274/);

    const loaded = await repository.load();
    assert.equal(loaded.ok, true);
    assert.notEqual(loaded.value, null);
    assert.equal(loaded.value.lockId, 'daily-lock-274');
    assert.equal(loaded.value.reason, 'STOP_LOSS_REACHED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('json daily risk lock repository returns null when file does not exist', async () => {
  const { dir, repository } = await tempRepo();

  try {
    const loaded = await repository.load();

    assert.equal(loaded.ok, true);
    assert.equal(loaded.value, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('json daily risk lock repository clears persisted lock', async () => {
  const { dir, repository } = await tempRepo();

  try {
    const saved = await repository.save(lock());
    assert.equal(saved.ok, true);

    const cleared = await repository.clear();
    assert.equal(cleared.ok, true);
    assert.equal(cleared.value, true);

    const loaded = await repository.load();
    assert.equal(loaded.ok, true);
    assert.equal(loaded.value, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('json daily risk lock repository rejects invalid lock on save', async () => {
  const { dir, repository } = await tempRepo();

  try {
    const saved = await repository.save(lock({
      lockId: '',
    }));

    assert.equal(saved.ok, false);
    assert.equal(saved.error.code, 'INVALID_DAILY_RISK_LOCK_REPOSITORY_INPUT');
    assert.equal(saved.error.stage, 'VALIDATION');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('json daily risk lock repository rejects corrupted persisted lock', async () => {
  const { dir, filePath, repository } = await tempRepo();

  try {
    const { writeFile } = require('node:fs/promises');
    await writeFile(filePath, JSON.stringify(lock({ unlockAtEpochMs: 1 })), 'utf8');

    const loaded = await repository.load();

    assert.equal(loaded.ok, false);
    assert.equal(loaded.error.code, 'INVALID_DAILY_RISK_LOCK_REPOSITORY_INPUT');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('json daily risk lock repository constructor rejects invalid path', () => {
  assert.throws(
    () => new JsonDailyRiskLockRepositoryAdapter({ filePath: '' }),
    /filePath is required/,
  );
});
