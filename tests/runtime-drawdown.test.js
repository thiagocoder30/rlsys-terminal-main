const test = require('node:test');
const assert = require('node:assert');
const { RuntimeDrawdownMonitor } = require('../dist/domain/runtime/RuntimeDrawdownMonitor');
const { DrawdownStatus } = require('../dist/domain/runtime/DrawdownPolicy');

const policy = { windowSize: 5, maxLossPerWindow: 20 };

test('DrawdownMonitor: Mantem status HEALTHY em flutuacoes normais', () => {
  const monitor = new RuntimeDrawdownMonitor(policy);
  assert.strictEqual(monitor.processRound(1, 100).status, DrawdownStatus.HEALTHY);
  assert.strictEqual(monitor.processRound(2, 95).status, DrawdownStatus.HEALTHY); // -5 loss
  assert.strictEqual(monitor.processRound(3, 105).status, DrawdownStatus.HEALTHY); // peak changed
});

test('DrawdownMonitor: Dispara VELOCITY_ALERT em queda brusca', () => {
  const monitor = new RuntimeDrawdownMonitor(policy);
  monitor.processRound(1, 100);
  monitor.processRound(2, 110); // Novo Pico (Peak)
  
  // Queda de 110 para 85 = 25 de perda (limite é 20)
  const result = monitor.processRound(3, 85);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.status, DrawdownStatus.VELOCITY_ALERT);
});

test('DrawdownMonitor: Garante idempotencia e rejeita rodadas duplicadas', () => {
  const monitor = new RuntimeDrawdownMonitor(policy);
  monitor.processRound(10, 100);
  
  // Tenta injetar a rodada 10 novamente (Ex: Duplo clique ou falha de OCR)
  const invalidResult = monitor.processRound(10, 90);
  
  assert.strictEqual(invalidResult.success, false);
  assert.strictEqual(invalidResult.error, 'INVALID_ROUND_SEQUENCE');
});
