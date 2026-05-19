const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { OperatorCooldownGuard } = require('../dist/domain/runtime/OperatorCooldownGuard');
const { CooldownReason } = require('../dist/domain/runtime/CooldownContracts');
const { FileCooldownStateRepository } = require('../dist/infrastructure/storage/FileCooldownStateRepository');

const policy = {
  stopLossMs: 3600000,
  drawdownVelocityMs: 1800000,
  paradigmBreakMs: 43200000,
  manualEmergencyMs: 86400000
};

function createTestStorageDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-cooldown-'));
}

function removeTestStorageDir(storageDir) {
  if (fs.existsSync(storageDir)) {
    fs.rmSync(storageDir, { recursive: true, force: true });
  }
}

test('PersistentCooldown: Guarda estado no disco e restaura em nova instancia', () => {
  const testStorageDir = createTestStorageDir();

  try {
    const repo1 = new FileCooldownStateRepository(testStorageDir);
    const guard1 = new OperatorCooldownGuard(policy, repo1);
    const startTime = 1000000;

    guard1.enforceLock(CooldownReason.STOP_LOSS, startTime);

    const repo2 = new FileCooldownStateRepository(testStorageDir);
    const guard2 = new OperatorCooldownGuard(policy, repo2);

    const status = guard2.evaluate(startTime + 1000);
    assert.strictEqual(status.isActive, true);
    assert.strictEqual(status.reason, CooldownReason.STOP_LOSS);
    assert.strictEqual(status.remainingMs, 3600000 - 1000);
  } finally {
    removeTestStorageDir(testStorageDir);
  }
});

test('PersistentCooldown: Remove arquivo do disco quando tempo expira', () => {
  const testStorageDir = createTestStorageDir();

  try {
    const repo = new FileCooldownStateRepository(testStorageDir);
    const guard = new OperatorCooldownGuard(policy, repo);
    const startTime = 1000000;

    guard.enforceLock(CooldownReason.DRAWDOWN_VELOCITY, startTime);
    assert.strictEqual(
      fs.existsSync(path.join(testStorageDir, 'cooldown_state.json')),
      true
    );

    guard.evaluate(startTime + 1800001);

    assert.strictEqual(
      fs.existsSync(path.join(testStorageDir, 'cooldown_state.json')),
      false
    );
  } finally {
    removeTestStorageDir(testStorageDir);
  }
});
