const assert = require('node:assert/strict');
const test = require('node:test');

const {
  TriplicacaoPatternEngine,
} = require('../../../dist/domain/analytics/TriplicacaoPatternEngine.js');

test('TriplicacaoPatternEngine classifica TC', () => {
  const engine = new TriplicacaoPatternEngine();
  const analysis = engine.analyze([1, 3, 5, 7, 9, 12], { minValidTrios: 1 });

  assert.equal(analysis.trios[0].patternKind, 'TC');
  assert.equal(analysis.dominantPatternKind, 'TC');
  assert.equal(analysis.liveMoneyAuthorized, false);
});

test('TriplicacaoPatternEngine classifica NTC', () => {
  const engine = new TriplicacaoPatternEngine();
  const analysis = engine.analyze([1, 3, 2, 5, 7, 4], { minValidTrios: 1 });

  assert.equal(analysis.trios[0].patternKind, 'NTC');
  assert.equal(analysis.dominantPatternKind, 'NTC');
});

test('TriplicacaoPatternEngine classifica TA', () => {
  const engine = new TriplicacaoPatternEngine();
  const analysis = engine.analyze([1, 2, 3, 5, 4, 7], { minValidTrios: 1 });

  assert.equal(analysis.trios[0].patternKind, 'TA');
  assert.equal(analysis.dominantPatternKind, 'TA');
});

test('TriplicacaoPatternEngine classifica NTA', () => {
  const engine = new TriplicacaoPatternEngine();
  const analysis = engine.analyze([1, 2, 4, 3, 6, 8], { minValidTrios: 1 });

  assert.equal(analysis.trios[0].patternKind, 'NTA');
  assert.equal(analysis.dominantPatternKind, 'NTA');
});

test('TriplicacaoPatternEngine descarta trio com zero', () => {
  const engine = new TriplicacaoPatternEngine();
  const analysis = engine.analyze([1, 0, 3, 1, 3, 5, 2, 4, 6], { minValidTrios: 1 });

  assert.equal(analysis.discardedZeroTrioCount, 1);
  assert.equal(analysis.validTrioCount, 2);
  assert.equal(analysis.signal.warnings.includes('TRIOS_WITH_ZERO_DISCARDED'), true);
});

test('TriplicacaoPatternEngine bloqueia amostra insuficiente', () => {
  const engine = new TriplicacaoPatternEngine();
  const analysis = engine.analyze([1, 3, 5], { minValidTrios: 12 });

  assert.equal(analysis.dominantPatternKind, 'INSUFFICIENT_DATA');
  assert.equal(analysis.operationalMode, 'OBSERVE');
  assert.equal(analysis.signal.blockers.includes('TRIPLICACAO_DADOS_INSUFICIENTES'), true);
});

test('TriplicacaoPatternEngine permite PAPER_ONLY sem autorizar dinheiro real', () => {
  const engine = new TriplicacaoPatternEngine();
  const history = [];

  for (let index = 0; index < 20; index += 1) {
    history.push(1, 3, 5);
  }

  const analysis = engine.analyze(history, {
    minValidTrios: 12,
    recentTrioWindow: 8,
    dominanceThreshold: 58,
    paperConfidenceThreshold: 0.7,
    paperRiskThreshold: 0.33,
  });

  assert.equal(analysis.dominantPatternKind, 'TC');
  assert.equal(analysis.operationalMode, 'PAPER_ONLY');
  assert.equal(analysis.liveMoneyAuthorized, false);
  assert.equal(analysis.signal.blockers.length, 0);
});

test('TriplicacaoPatternEngine mantém OBSERVE sem dominância forte', () => {
  const engine = new TriplicacaoPatternEngine();

  const history = [
    1, 3, 5,
    1, 3, 2,
    1, 2, 3,
    1, 2, 4,
    5, 7, 9,
    5, 7, 4,
    5, 4, 7,
    5, 4, 6,
    9, 12, 14,
    9, 12, 6,
    9, 6, 12,
    9, 6, 8,
  ];

  const analysis = engine.analyze(history, {
    minValidTrios: 12,
    dominanceThreshold: 58,
  });

  assert.equal(analysis.operationalMode, 'OBSERVE');
  assert.equal(analysis.signal.blockers.includes('TRIPLICACAO_SEM_EVIDENCIA_FORTE'), true);
});
