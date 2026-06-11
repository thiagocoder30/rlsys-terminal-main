const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AnalyticsDecisionEngine,
} = require('../../../dist/application/runtime/AnalyticsDecisionEngine.js');

function rounds(count) {
  return Array.from({ length: count }, (_, index) => String((index % 36) + 1));
}

test('AnalyticsDecisionEngine bloqueia decisão com warmup insuficiente', () => {
  const result = new AnalyticsDecisionEngine().evaluate({
    warmupRounds: rounds(50),
    liveRounds: [],
  });

  assert.equal(result.recommendation, 'AGUARDAR');
  assert.equal(result.consensus.classification, 'NO_GO');
  assert.equal(result.liveMoneyAuthorization, false);
  assert.equal(result.automaticBetExecutionAllowed, false);
});

test('AnalyticsDecisionEngine aguarda quando não há rodadas ao vivo', () => {
  const result = new AnalyticsDecisionEngine().evaluate({
    warmupRounds: rounds(120),
    liveRounds: [],
  });

  assert.equal(result.recommendation, 'AGUARDAR');
  assert.equal(result.consensus.classification, 'WEAK_CONTEXT');
});

test('AnalyticsDecisionEngine calcula Triplicacao, Heatmap e Consenso', () => {
  const result = new AnalyticsDecisionEngine().evaluate({
    warmupRounds: rounds(150),
    liveRounds: ['1', '3', '5', '7', '9', '12', '14', '16'],
    minimumLiveRounds: 6,
  });

  assert.ok(result.triplicacao.totalTrios > 0);
  assert.ok(result.heatmap.hotNumbers.length > 0);
  assert.equal(result.consensus.enginesTotal, 3);
  assert.equal(result.paperOnly, true);
  assert.equal(result.liveMoneyAuthorization, false);
});
