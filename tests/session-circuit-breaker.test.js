const test = require('node:test');
const assert = require('node:assert');
const { SessionCircuitBreaker, SessionStatus } = require('../dist/domain/runtime/SessionCircuitBreaker');

const baseState = {
  initialBankroll: 240,
  currentBankroll: 240,
  stopLossThreshold: 30,
  stopWinThreshold: 20,
  drawdownVelocityAlert: false,
  sanityEngineState: 'HEALTHY',
  dataIntegrityValid: true,
  mandatoryCooldownActive: false
};

test('Deve permitir sessao saudavel', () => {
  const status = SessionCircuitBreaker.evaluate(baseState);
  assert.strictEqual(status, SessionStatus.SESSION_OPEN);
});

test('Deve bloquear por perda (Stop Loss)', () => {
  const status = SessionCircuitBreaker.evaluate({...baseState, currentBankroll: 200});
  assert.strictEqual(status, SessionStatus.SESSION_LOCKED);
});

test('Deve bloquear por lucro (Stop Win)', () => {
  const status = SessionCircuitBreaker.evaluate({...baseState, currentBankroll: 270});
  assert.strictEqual(status, SessionStatus.SESSION_PROFIT_LOCKED);
});
