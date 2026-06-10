const assert = require('node:assert/strict');
const test = require('node:test');

const {
  TriplicacaoAdvancedProbabilityEngine,
} = require('../../../dist/domain/analytics/TriplicacaoAdvancedProbabilityEngine.js');

test('TriplicacaoAdvancedProbabilityEngine calcula recorrência, ausência e evidência por padrão', () => {
  const engine = new TriplicacaoAdvancedProbabilityEngine();
  const history = [];

  for (let index = 0; index < 18; index += 1) {
    history.push(1, 3, 5);
  }

  const analysis = engine.analyze(history, {
    minValidTrios: 12,
    recentTrioWindow: 8,
    shortWindow: 6,
    mediumWindow: 12,
    longWindow: 18,
  });

  const tc = analysis.metrics.find((metric) => metric.patternKind === 'TC');

  assert.ok(tc);
  assert.equal(analysis.baseAnalysis.validTrioCount, 18);
  assert.equal(tc.occurrences, 18);
  assert.equal(tc.lastSeenDistance, 0);
  assert.equal(tc.observedFrequencyScore, 100);
  assert.equal(tc.shortWindowFrequencyScore, 100);
  assert.equal(tc.mediumWindowFrequencyScore, 100);
  assert.equal(tc.longWindowFrequencyScore, 100);
  assert.ok(tc.recurrenceScore >= 90);
  assert.ok(tc.evidenceScore >= 68);
  assert.equal(analysis.selectedPatternKind, 'TC');
  assert.equal(analysis.liveMoneyAuthorized, false);
});

test('TriplicacaoAdvancedProbabilityEngine mede ausência quando padrão não aparece', () => {
  const engine = new TriplicacaoAdvancedProbabilityEngine();
  const history = [];

  for (let index = 0; index < 16; index += 1) {
    history.push(1, 3, 5);
  }

  const analysis = engine.analyze(history, { minValidTrios: 12 });
  const nta = analysis.metrics.find((metric) => metric.patternKind === 'NTA');

  assert.ok(nta);
  assert.equal(nta.occurrences, 0);
  assert.equal(nta.lastSeenDistance, null);
  assert.equal(nta.absenceScore, 100);
  assert.equal(nta.observedFrequencyScore, 0);
});

test('TriplicacaoAdvancedProbabilityEngine calcula score condicional de continuação', () => {
  const engine = new TriplicacaoAdvancedProbabilityEngine();
  const history = [];

  for (let index = 0; index < 14; index += 1) {
    history.push(1, 3, 5);
  }

  history.push(1, 3, 2);
  history.push(1, 2, 3);

  const analysis = engine.analyze(history, { minValidTrios: 12 });
  const tc = analysis.metrics.find((metric) => metric.patternKind === 'TC');

  assert.ok(tc);
  assert.ok(tc.conditionalContinuationScore > 80);
  assert.ok(tc.conditionalReversalScore < 20);
});

test('TriplicacaoAdvancedProbabilityEngine fica em dados insuficientes quando base engine bloqueia amostra', () => {
  const engine = new TriplicacaoAdvancedProbabilityEngine();

  const analysis = engine.analyze([1, 3, 5, 1, 3, 2], {
    minValidTrios: 12,
  });

  assert.equal(analysis.probabilityMode, 'INSUFFICIENT_DATA');
  assert.equal(analysis.selectedPatternKind, null);
  assert.equal(analysis.blockers.includes('TRIPLICACAO_ADVANCED_DADOS_INSUFICIENTES'), true);
  assert.equal(analysis.liveMoneyAuthorized, false);
});

test('TriplicacaoAdvancedProbabilityEngine mantém OBSERVE quando evidência avançada é fraca', () => {
  const engine = new TriplicacaoAdvancedProbabilityEngine();

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

  const analysis = engine.analyze(history, { minValidTrios: 12 });

  assert.equal(analysis.probabilityMode, 'OBSERVE');
  assert.equal(analysis.blockers.includes('TRIPLICACAO_ADVANCED_EVIDENCIA_INSUFICIENTE'), true);
});

test('TriplicacaoAdvancedProbabilityEngine compõe consenso PAPER_ONLY somente com acordo forte', () => {
  const engine = new TriplicacaoAdvancedProbabilityEngine();

  const consensus = engine.composeConsensus([
    {
      strategyId: 'triplicacao',
      confidenceScore: 0.82,
      riskScore: 0.22,
      reasons: ['TRIPLICACAO_ADVANCED_SELECTED:TC'],
    },
    {
      strategyId: 'fusion-reduzida',
      confidenceScore: 0.78,
      riskScore: 0.28,
      reasons: ['FUSION_REGION_PRESSURE_STRONG'],
    },
  ]);

  assert.equal(consensus.inputCount, 2);
  assert.equal(consensus.acceptedInputCount, 2);
  assert.equal(consensus.operationalMode, 'PAPER_ONLY');
  assert.equal(consensus.liveMoneyAuthorized, false);
  assert.equal(consensus.blockers.length, 0);
  assert.ok(consensus.consensusScore >= 70);
});

test('TriplicacaoAdvancedProbabilityEngine bloqueia consenso com apenas uma estratégia aceita', () => {
  const engine = new TriplicacaoAdvancedProbabilityEngine();

  const consensus = engine.composeConsensus([
    {
      strategyId: 'triplicacao',
      confidenceScore: 0.84,
      riskScore: 0.2,
    },
    {
      strategyId: 'fusion-reduzida',
      confidenceScore: 0.8,
      riskScore: 0.25,
      blockers: ['FUSION_BLOCKED'],
    },
  ]);

  assert.equal(consensus.acceptedInputCount, 1);
  assert.equal(consensus.operationalMode, 'OBSERVE');
  assert.equal(consensus.blockers.includes('CONSENSUS_OBSERVE_ONLY'), true);
});

test('TriplicacaoAdvancedProbabilityEngine nunca autoriza dinheiro real', () => {
  const engine = new TriplicacaoAdvancedProbabilityEngine();

  const analysis = engine.analyze(Array.from({ length: 60 }, () => 1), {
    minValidTrios: 12,
  });

  const consensus = engine.composeConsensus([
    {
      strategyId: 'triplicacao',
      confidenceScore: 1,
      riskScore: 0,
    },
    {
      strategyId: 'fusion-reduzida',
      confidenceScore: 1,
      riskScore: 0,
    },
  ]);

  assert.equal(analysis.liveMoneyAuthorized, false);
  assert.equal(analysis.baseAnalysis.liveMoneyAuthorized, false);
  assert.equal(consensus.liveMoneyAuthorized, false);
});
