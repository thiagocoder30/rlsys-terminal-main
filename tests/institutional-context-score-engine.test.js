const test = require('node:test');
const assert = require('node:assert');
const { InstitutionalContextScoreEngine } = require('../src/application/runtime/InstitutionalContextScoreEngine');

test('InstitutionalContextScoreEngine calculates valid favorable context', () => {
  const engine = new InstitutionalContextScoreEngine();
  const res = engine.evaluate({ tableScore: 82, riskScore: 92, disciplineScore: 100, dataScore: 95 });
  
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.status, 'CONTEXTO FAVORÁVEL');
  assert.ok(res.score > 80);
});

test('InstitutionalContextScoreEngine overrides table score with discipline veto', () => {
  const engine = new InstitutionalContextScoreEngine();
  // Mesa excelente (100), mas operador em tilt (20)
  const res = engine.evaluate({ tableScore: 100, riskScore: 90, disciplineScore: 20, dataScore: 100 });
  
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.status, 'CONTEXTO DESFAVORÁVEL');
  assert.strictEqual(res.vetoReason, 'Bloqueio de Disciplina/Fadiga');
});

test('InstitutionalContextScoreEngine safely rejects invalid input', () => {
  const engine = new InstitutionalContextScoreEngine();
  const res = engine.evaluate({ tableScore: 100 });
  
  assert.strictEqual(res.ok, false);
});
