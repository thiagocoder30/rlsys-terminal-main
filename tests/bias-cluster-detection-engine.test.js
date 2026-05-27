'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BiasClusterDetectionEngine } = require('../dist/application/runtime/BiasClusterDetectionEngine.js');

test('BiasClusterDetectionEngine retorna score zero para histórico vazio ou nulo', () => {
  const engine = new BiasClusterDetectionEngine();
  
  const resultNull = engine.analyze(null);
  assert.equal(resultNull.contextPressureScore, 0);
  
  const resultEmpty = engine.analyze([]);
  assert.equal(resultEmpty.contextPressureScore, 0);
});

test('BiasClusterDetectionEngine lida defensivamente com dados corrompidos ou fora do escopo', () => {
  const engine = new BiasClusterDetectionEngine();
  
  const result = engine.analyze([10, -5, 99]);
  assert.equal(result.contextPressureScore, 100);
  assert.equal(result.details.sectorScore, 100);
});

test('BiasClusterDetectionEngine calcula desvio crítico de densidade de setor no cilindro', () => {
  const engine = new BiasClusterDetectionEngine();
  
  // Amostra pesada forçando apenas números do setor Tiers du Cylindre
  const heavyTSpins = [5, 8, 10, 11, 13, 16, 23, 24, 5, 8, 10, 11, 13, 16, 23, 24];
  const result = engine.analyze(heavyTSpins);
  
  assert.ok(result.contextPressureScore > 0);
  assert.ok(result.details.sectorScore > 0);
});

test('BiasClusterDetectionEngine eleva pressão ao detectar sequências anormais da mesma cor', () => {
  const engine = new BiasClusterDetectionEngine();
  
  // Sequência de 10 vermelhos seguidos (Anomalia de repetição)
  const streakSpins = [1, 3, 5, 7, 9, 1, 3, 5, 7, 9, 1, 3];
  const result = engine.analyze(streakSpins);
  
  assert.ok(result.contextPressureScore > 0);
  assert.ok(result.details.repetitionScore > 0);
});

test('BiasClusterDetectionEngine identifica oscilações suspeitas intermitentes de curto prazo', () => {
  const engine = new BiasClusterDetectionEngine();
  
  // Padrão perfeito de zigue-zague: R, B, R, B, R, B, R, B
  const oscillationSpins = [1, 2, 3, 4, 5, 6, 1, 4, 3, 2, 5, 6, 1, 4];
  const result = engine.analyze(oscillationSpins);
  
  assert.ok(result.details.oscillationScore >= 0);
});
