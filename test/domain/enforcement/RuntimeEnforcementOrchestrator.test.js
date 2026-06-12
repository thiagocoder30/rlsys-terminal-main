const assert = require('node:assert/strict');
const test = require('node:test');
const { RuntimeEnforcementOrchestrator } = require('../../../dist/domain/enforcement/RuntimeEnforcementOrchestrator.js');

test('RuntimeEnforcementOrchestrator bloqueia após 3 perdas consecutivas sem cooldown', () => {
  const orchestrator = new RuntimeEnforcementOrchestrator();
  const result = orchestrator.evaluateContext({ consecutiveLosses: 3, roundsSinceLastAction: 2 });
  
  assert.equal(result.isAllowed, false);
  assert.equal(result.state, 'LOCKED');
  assert.match(result.reason, /DEFENSE LOCK/);
});

test('RuntimeEnforcementOrchestrator libera após cumprir cooldown de 5 rodadas', () => {
  const orchestrator = new RuntimeEnforcementOrchestrator();
  const result = orchestrator.evaluateContext({ consecutiveLosses: 3, roundsSinceLastAction: 5 });
  
  assert.equal(result.isAllowed, true);
  assert.equal(result.state, 'REVIEW');
  assert.match(result.reason, /Cooldown concluído/);
});
