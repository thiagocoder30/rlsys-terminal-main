const assert = require('node:assert/strict');
const test = require('node:test');

const {
  StrategyReplayValidationEngine,
} = require('../../../dist/application/runtime/StrategyReplayValidationEngine.js');

test('StrategyReplayValidationEngine liquida sinais contra próxima rodada', () => {
  const engine = new StrategyReplayValidationEngine();

  const report = engine.validate([1, 3, 2, 4], [
    {
      strategyId: 'triplicacao',
      roundIndex: 0,
      target: 'RED',
      confidenceScore: 0.7,
      riskScore: 0.2,
    },
    {
      strategyId: 'fusion-reduzida',
      roundIndex: 1,
      target: 'BLACK',
      confidenceScore: 0.7,
      riskScore: 0.2,
    },
  ], {
    initialBankroll: 100,
    stakeAmount: 1,
  });

  assert.equal(report.settledSignals.length, 2);
  assert.equal(report.settledSignals[0].result, 'GREEN');
  assert.equal(report.settledSignals[1].result, 'GREEN');
  assert.equal(report.finalBankroll, 102);
});

test('StrategyReplayValidationEngine trata zero como VOID', () => {
  const engine = new StrategyReplayValidationEngine();

  const report = engine.validate([1, 0], [
    {
      strategyId: 'triplicacao',
      roundIndex: 0,
      target: 'RED',
      confidenceScore: 0.7,
      riskScore: 0.2,
    },
  ]);

  assert.equal(report.settledSignals[0].result, 'VOID');
  assert.equal(report.finalBankroll, 100);
});

test('StrategyReplayValidationEngine calcula métricas por estratégia', () => {
  const engine = new StrategyReplayValidationEngine();

  const report = engine.validate([1, 3, 2, 1, 4], [
    { strategyId: 'triplicacao', roundIndex: 0, target: 'RED', confidenceScore: 0.7, riskScore: 0.2 },
    { strategyId: 'triplicacao', roundIndex: 1, target: 'BLACK', confidenceScore: 0.7, riskScore: 0.2 },
    { strategyId: 'triplicacao', roundIndex: 2, target: 'RED', confidenceScore: 0.7, riskScore: 0.2 },
    { strategyId: 'fusion-reduzida', roundIndex: 3, target: 'RED', confidenceScore: 0.7, riskScore: 0.2 },
  ]);

  const triplicacao = report.strategyMetrics.find((metric) => metric.strategyId === 'triplicacao');
  const fusion = report.strategyMetrics.find((metric) => metric.strategyId === 'fusion-reduzida');

  assert.ok(triplicacao);
  assert.ok(fusion);
  assert.equal(triplicacao.totalSignals, 3);
  assert.equal(triplicacao.greens, 3);
  assert.equal(triplicacao.winRatePercent, 100);
  assert.equal(fusion.reds, 1);
});

test('StrategyReplayValidationEngine gera classificação PAPER_READY_HIGH_CONFIDENCE quando replay é forte', () => {
  const engine = new StrategyReplayValidationEngine();
  const history = [];
  const signals = [];

  for (let index = 0; index < 80; index += 1) {
    history.push(1, 3);
  }

  for (let index = 0; index < 50; index += 2) {
    signals.push({
      strategyId: 'consensus',
      roundIndex: index,
      target: 'RED',
      confidenceScore: 0.8,
      riskScore: 0.2,
    });
  }

  const report = engine.validate(history, signals, {
    minSignalsForPaperReady: 20,
    minWinRateForPaperReady: 52,
    minProfitFactorForPaperReady: 1.05,
    maxDrawdownPercentForPaperReady: 12,
  });

  assert.equal(report.classification, 'PAPER_READY_HIGH_CONFIDENCE');
  assert.equal(report.blockers.length, 0);
});

test('StrategyReplayValidationEngine gera NOT_READY com amostra insuficiente', () => {
  const engine = new StrategyReplayValidationEngine();

  const report = engine.validate([1, 3, 5], [
    { strategyId: 'consensus', roundIndex: 0, target: 'RED', confidenceScore: 0.7, riskScore: 0.2 },
  ]);

  assert.equal(report.classification, 'NOT_READY');
  assert.ok(report.blockers.includes('REPLAY_SIGNAL_SAMPLE_INSUFFICIENT'));
});

test('StrategyReplayValidationEngine gera sinais ingênuos para validação do engine', () => {
  const engine = new StrategyReplayValidationEngine();

  const signals = engine.generateNaiveColorSignals([1, 3, 2, 4, 0, 5], 'triplicacao', 0, 2);

  assert.ok(signals.length > 0);
  assert.equal(signals[0].strategyId, 'triplicacao');
  assert.ok(['RED', 'BLACK'].includes(signals[0].target));
});

test('StrategyReplayValidationEngine gera texto de auditoria', () => {
  const engine = new StrategyReplayValidationEngine();

  const report = engine.validate([1, 3, 2], [
    { strategyId: 'consensus', roundIndex: 0, target: 'RED', confidenceScore: 0.7, riskScore: 0.2 },
  ]);

  assert.ok(report.auditText.includes('STRATEGY REPLAY VALIDATION'));
  assert.ok(report.auditText.includes('CLASSIFICATION='));
  assert.ok(report.auditText.includes('paperOnly=true'));
  assert.ok(report.auditText.includes('liveMoneyAuthorized=false'));
});

test('StrategyReplayValidationEngine mantém governança PAPER only', () => {
  const engine = new StrategyReplayValidationEngine();

  const report = engine.validate([1, 3, 2], [
    { strategyId: 'consensus', roundIndex: 0, target: 'RED', confidenceScore: 0.7, riskScore: 0.2 },
  ]);

  assert.equal(report.paperOnly, true);
  assert.equal(report.liveMoneyAuthorized, false);
  assert.equal(report.productionMoneyAllowed, false);
  assert.equal(report.operatorDecisionRequired, true);
  assert.equal(report.supervisedRecommendationOnly, true);
});
