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

test('Sessao Saudavel', () => {
  const status = SessionCircuitBreaker.evaluate(baseState);
  assert.strictEqual(status, SessionStatus.SESSION_OPEN);
});

test('Disparo Stop Loss', () => {
  const status = SessionCircuitBreaker.evaluate({...baseState, currentBankroll: 200});
  assert.strictEqual(status, SessionStatus.SESSION_LOCKED);
});
