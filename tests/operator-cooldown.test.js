const test = require('node:test');
const assert = require('node:assert');
const { OperatorCooldownGuard } = require('../dist/domain/runtime/OperatorCooldownGuard');
const { CooldownReason } = require('../dist/domain/runtime/CooldownContracts');

const policy = {
  stopLossMs: 60 * 60 * 1000,         // 1 Hora
  drawdownVelocityMs: 30 * 60 * 1000, // 30 Minutos
  paradigmBreakMs: 12 * 60 * 60 * 1000, // 12 Horas
  manualEmergencyMs: 24 * 60 * 60 * 1000 // 24 Horas
};

test('CooldownGuard: Inicia inativo (Permissivo)', () => {
  const guard = new OperatorCooldownGuard(policy);
  const status = guard.evaluate(1000000);
  assert.strictEqual(status.isActive, false);
});

test('CooldownGuard: Aplica penalidade correta e bloqueia', () => {
  const guard = new OperatorCooldownGuard(policy);
  const startTime = 1000000;
  
  guard.enforceLock(CooldownReason.STOP_LOSS, startTime);
  
  // 10 minutos depois...
  const status = guard.evaluate(startTime + (10 * 60 * 1000));
  assert.strictEqual(status.isActive, true);
  assert.strictEqual(status.reason, CooldownReason.STOP_LOSS);
  assert.strictEqual(status.remainingMs, 50 * 60 * 1000); // Faltam 50 min
});

test('CooldownGuard: Libera o sistema após expiração do tempo', () => {
  const guard = new OperatorCooldownGuard(policy);
  const startTime = 1000000;
  
  guard.enforceLock(CooldownReason.DRAWDOWN_VELOCITY, startTime);
  
  // 31 minutos depois (A política de Drawdown é de 30 minutos)
  const status = guard.evaluate(startTime + (31 * 60 * 1000));
  assert.strictEqual(status.isActive, false);
  assert.strictEqual(status.remainingMs, 0);
});

test('CooldownGuard: Evita bypass - Nao substitui bloqueio maior por um menor', () => {
  const guard = new OperatorCooldownGuard(policy);
  const startTime = 1000000;
  
  // Sofre Paradigm Break (12 Horas de Block)
  guard.enforceLock(CooldownReason.PARADIGM_BREAK, startTime);
  
  // 1 hora depois, operador tenta forçar um Drawdown Lock (30 Min) para "burlar" o tempo
  guard.enforceLock(CooldownReason.DRAWDOWN_VELOCITY, startTime + (60 * 60 * 1000));
  
  const status = guard.evaluate(startTime + (60 * 60 * 1000));
  // O sistema DEVE manter o bloqueio original mais rigoroso
  assert.strictEqual(status.reason, CooldownReason.PARADIGM_BREAK);
  assert.strictEqual(status.isActive, true);
  assert.strictEqual(status.remainingMs, 11 * 60 * 60 * 1000); // Restam 11 horas
});
