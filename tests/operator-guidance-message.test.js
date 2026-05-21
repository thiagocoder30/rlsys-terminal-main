const test = require('node:test');
const assert = require('node:assert/strict');
const { OperatorGuidanceMessageComposer } = require('../dist/domain/operator');

test('OperatorGuidanceMessageComposer creates calm SAFE guidance', () => {
  const composer = new OperatorGuidanceMessageComposer();

  const message = composer.compose({
    verdict: 'SAFE',
    reason: 'Entrada compatível com a banca e com o perfil de risco.',
    allowedStake: 2,
    remainingLossBudget: 10,
    remainingProfitTarget: 16,
  });

  assert.equal(message.severity, 'INFO');
  assert.match(message.title, /Entrada saudável/);
  assert.match(message.recommendedAction, /Não aumentar/);
});

test('OperatorGuidanceMessageComposer creates REVIEW caution guidance', () => {
  const composer = new OperatorGuidanceMessageComposer();

  const message = composer.compose({
    verdict: 'REVIEW',
    reason: 'Entrada acima da base recomendada.',
    allowedStake: 4,
    remainingLossBudget: 10,
    remainingProfitTarget: 12,
  });

  assert.equal(message.severity, 'CAUTION');
  assert.match(message.title, /cautela/);
  assert.match(message.recommendedAction, /Reduzir/);
});

test('OperatorGuidanceMessageComposer explains stop loss in human language', () => {
  const composer = new OperatorGuidanceMessageComposer();

  const message = composer.compose({
    verdict: 'BLOCKED',
    reason: 'Stop loss diário atingido. Encerrar sessão para preservar a banca.',
    allowedStake: 0,
    remainingLossBudget: 0,
    remainingProfitTarget: 16,
  });

  assert.equal(message.severity, 'STOP');
  assert.match(message.title, /perda/);
  assert.match(message.body, /decisões emocionais/);
  assert.match(message.recommendedAction, /Encerrar/);
});

test('OperatorGuidanceMessageComposer explains stop win preservation', () => {
  const composer = new OperatorGuidanceMessageComposer();

  const message = composer.compose({
    verdict: 'BLOCKED',
    reason: 'Stop win diário atingido. Preservar lucro é prioridade.',
    allowedStake: 0,
    remainingLossBudget: 10,
    remainingProfitTarget: 0,
  });

  assert.equal(message.severity, 'STOP');
  assert.match(message.title, /Meta saudável/);
  assert.match(message.body, /Preservar lucro/);
});

test('OperatorGuidanceMessageComposer explains martingale block', () => {
  const composer = new OperatorGuidanceMessageComposer();

  const message = composer.compose({
    verdict: 'BLOCKED',
    reason: 'Martingale bloqueado: limite seguro de progressão atingido.',
    allowedStake: 2,
    remainingLossBudget: 10,
    remainingProfitTarget: 16,
  });

  assert.equal(message.severity, 'STOP');
  assert.match(message.title, /Progressão/);
  assert.match(message.recommendedAction, /Não aumentar/);
});

test('OperatorGuidanceMessageComposer explains excessive exposure', () => {
  const composer = new OperatorGuidanceMessageComposer();

  const message = composer.compose({
    verdict: 'BLOCKED',
    reason: 'Entrada bloqueada: exposição acima do limite saudável da banca.',
    allowedStake: 6,
    remainingLossBudget: 10,
    remainingProfitTarget: 16,
  });

  assert.equal(message.severity, 'STOP');
  assert.match(message.title, /Exposição/);
  assert.match(message.body, /banca/);
});
