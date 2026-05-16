const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { OperatorCooldownGuard } = require('../dist/domain/runtime/OperatorCooldownGuard');
const { CooldownReason } = require('../dist/domain/runtime/CooldownContracts');
const { FileCooldownStateRepository } = require('../dist/infrastructure/storage/FileCooldownStateRepository');

const policy = { stopLossMs: 3600000, drawdownVelocityMs: 1800000, paradigmBreakMs: 43200000, manualEmergencyMs: 86400000 };
const testStorageDir = path.join(__dirname, 'test_storage');

test('PersistentCooldown: Guarda estado no disco e restaura em nova instancia', () => {
  const repo1 = new FileCooldownStateRepository(testStorageDir);
  const guard1 = new OperatorCooldownGuard(policy, repo1);
  const startTime = 1000000;
  
  // Applica bloqueio
  guard1.enforceLock(CooldownReason.STOP_LOSS, startTime);
  
  // Simula "Morte do Processo" e "Reinicio" criando nova instância
  const repo2 = new FileCooldownStateRepository(testStorageDir);
  const guard2 = new OperatorCooldownGuard(policy, repo2);
  
  // Verifica se o estado sobreviveu à nova instância
  const status = guard2.evaluate(startTime + 1000); 
  assert.strictEqual(status.isActive, true);
  assert.strictEqual(status.reason, CooldownReason.STOP_LOSS);
  assert.strictEqual(status.remainingMs, 3600000 - 1000);
});

test('PersistentCooldown: Remove arquivo do disco quando tempo expira', () => {
  const repo = new FileCooldownStateRepository(testStorageDir);
  const guard = new OperatorCooldownGuard(policy, repo);
  const startTime = 1000000;
  
  guard.enforceLock(CooldownReason.DRAWDOWN_VELOCITY, startTime);
  assert.strictEqual(fs.existsSync(path.join(testStorageDir, 'cooldown_state.json')), true);
  
  // Avalia após o tempo expirar (Drawdown = 30min)
  guard.evaluate(startTime + 1800001);
  
  // Arquivo deve ter sido excluído
  assert.strictEqual(fs.existsSync(path.join(testStorageDir, 'cooldown_state.json')), false);
});

// Limpeza pós-teste
test('Cleanup: Remove test storage', () => {
  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }
});
