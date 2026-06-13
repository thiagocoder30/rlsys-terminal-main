const test = require('node:test');
const assert = require('node:assert');
const { TermuxTtsVoiceCopilot } = require('../src/infrastructure/audio/TermuxTtsVoiceCopilot');

test('TermuxTtsVoiceCopilot rejects empty message safely', () => {
  const copilot = new TermuxTtsVoiceCopilot();
  const res = copilot.speak('');
  assert.strictEqual(res.ok, false);
});

test('TermuxTtsVoiceCopilot executes gracefully without crashing on valid message', () => {
  const copilot = new TermuxTtsVoiceCopilot();
  // Este teste garante que o spawn não trava o ambiente de CI (Sandbox)
  const res = copilot.speak('Teste de integridade estrutural.');
  assert.strictEqual(res.ok, true);
});
