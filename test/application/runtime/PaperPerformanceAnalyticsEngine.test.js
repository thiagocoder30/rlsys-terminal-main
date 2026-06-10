const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PaperPerformanceAnalyticsEngine,
} = require('../../../dist/application/runtime/PaperPerformanceAnalyticsEngine.js');

const settlements = [
  {
    eventId: '1',
    strategyId: 'fusion-reduzida',
    result: 'GREEN',
    profitLossAmount: 2,
    stakeAmount: 2,
    bankrollBefore: 100,
    bankrollAfter: 102,
    settledAtIso: '2026-06-01T12:00:00.000Z',
    consensusStrategyIds: ['fusion-reduzida', 'triplicacao'],
    milestonePercent: 2,
    sessionId: 's1',
    dayKey: '2026-06-01',
  },
  {
    eventId: '2',
    strategyId: 'triplicacao',
    result: 'RED',
    profitLossAmount: -2,
    stakeAmount: 2,
    bankrollBefore: 102,
    bankrollAfter: 100,
    settledAtIso: '2026-06-01T12:05:00.000Z',
    consensusStrategyIds: ['fusion-reduzida', 'triplicacao'],
    milestonePercent: 2,
    sessionId: 's1',
    dayKey: '2026-06-01',
  },
  {
    eventId: '3',
    strategyId: 'triplicacao',
    result: 'GREEN',
    profitLossAmount: 2,
    stakeAmount: 2,
    bankrollBefore: 100,
    bankrollAfter: 102,
    settledAtIso: '2026-06-02T12:00:00.000Z',
    consensusStrategyIds: ['triplicacao'],
    milestonePercent: 4,
    sessionId: 's2',
    dayKey: '2026-06-02',
  },
  {
    eventId: '4',
    strategyId: 'fusion-reduzida',
    result: 'VOID',
    profitLossAmount: 0,
    stakeAmount: 2,
    bankrollBefore: 102,
    bankrollAfter: 102,
    settledAtIso: '2026-06-03T12:00:00.000Z',
    consensusStrategyIds: ['fusion-reduzida'],
    sessionId: 's3',
    dayKey: '2026-06-03',
  },
];

const sessions = [
  {
    sessionId: 's1',
    dayKey: '2026-06-01',
    openingBankroll: 100,
    closingBankroll: 100,
    stopReason: 'NONE',
    startedAtIso: '2026-06-01T11:00:00.000Z',
    finishedAtIso: '2026-06-01T13:00:00.000Z',
  },
  {
    sessionId: 's2',
    dayKey: '2026-06-02',
    openingBankroll: 100,
    closingBankroll: 108,
    stopReason: 'STOP_WIN',
    startedAtIso: '2026-06-02T11:00:00.000Z',
    finishedAtIso: '2026-06-02T13:00:00.000Z',
  },
  {
    sessionId: 's3',
    dayKey: '2026-06-03',
    openingBankroll: 108,
    closingBankroll: 104,
    stopReason: 'STOP_LOSS',
    startedAtIso: '2026-06-03T11:00:00.000Z',
    finishedAtIso: '2026-06-03T13:00:00.000Z',
  },
];

test('PaperPerformanceAnalyticsEngine calcula performance por estratégia', () => {
  const engine = new PaperPerformanceAnalyticsEngine();
  const report = engine.analyze({
    settlements,
    sessions,
    generatedAtIso: '2026-06-10T00:00:00.000Z',
    nowIso: '2026-06-10T00:00:00.000Z',
  }).allTime;

  const fusion = report.strategySummaries.find((summary) => summary.strategyId === 'fusion-reduzida');
  const triplicacao = report.strategySummaries.find((summary) => summary.strategyId === 'triplicacao');

  assert.ok(fusion);
  assert.ok(triplicacao);
  assert.equal(fusion.wins, 1);
  assert.equal(fusion.losses, 0);
  assert.equal(fusion.voids, 1);
  assert.equal(fusion.hitRatePercent, 100);
  assert.equal(triplicacao.wins, 1);
  assert.equal(triplicacao.losses, 1);
  assert.equal(triplicacao.hitRatePercent, 50);
});

test('PaperPerformanceAnalyticsEngine calcula performance de consenso', () => {
  const engine = new PaperPerformanceAnalyticsEngine();
  const report = engine.analyze({
    settlements,
    sessions,
    generatedAtIso: '2026-06-10T00:00:00.000Z',
    nowIso: '2026-06-10T00:00:00.000Z',
  }).allTime;

  assert.equal(report.consensusSummary.total, 2);
  assert.equal(report.consensusSummary.wins, 1);
  assert.equal(report.consensusSummary.losses, 1);
  assert.equal(report.consensusSummary.hitRatePercent, 50);
  assert.equal(report.consensusSummary.profitLossAmount, 0);
});

test('PaperPerformanceAnalyticsEngine calcula crescimento e drawdown de banca', () => {
  const engine = new PaperPerformanceAnalyticsEngine();
  const report = engine.analyze({
    settlements,
    sessions,
    generatedAtIso: '2026-06-10T00:00:00.000Z',
    nowIso: '2026-06-10T00:00:00.000Z',
  }).allTime;

  assert.equal(report.bankrollGrowth.openingBankroll, 100);
  assert.equal(report.bankrollGrowth.currentBankroll, 102);
  assert.equal(report.bankrollGrowth.peakBankroll, 108);
  assert.equal(report.bankrollGrowth.growthAmount, 2);
  assert.equal(report.bankrollGrowth.growthPercent, 2);
  assert.ok(report.bankrollGrowth.maxDrawdownAmount >= 4);
});

test('PaperPerformanceAnalyticsEngine calcula sessões e stops', () => {
  const engine = new PaperPerformanceAnalyticsEngine();
  const report = engine.analyze({
    settlements,
    sessions,
    generatedAtIso: '2026-06-10T00:00:00.000Z',
    nowIso: '2026-06-10T00:00:00.000Z',
  }).allTime;

  assert.equal(report.sessionSummary.totalSessions, 3);
  assert.equal(report.sessionSummary.stopWinSessions, 1);
  assert.equal(report.sessionSummary.stopLossSessions, 1);
  assert.equal(report.sessionSummary.neutralSessions, 1);
});

test('PaperPerformanceAnalyticsEngine calcula milestones', () => {
  const engine = new PaperPerformanceAnalyticsEngine();
  const report = engine.analyze({
    settlements,
    sessions,
    generatedAtIso: '2026-06-10T00:00:00.000Z',
    nowIso: '2026-06-10T00:00:00.000Z',
  }).allTime;

  const milestone2 = report.milestoneSummaries.find((summary) => summary.milestonePercent === 2);
  const milestone4 = report.milestoneSummaries.find((summary) => summary.milestonePercent === 4);

  assert.ok(milestone2);
  assert.ok(milestone4);
  assert.equal(milestone2.hits, 2);
  assert.equal(milestone2.hitRateAfterMilestonePercent, 50);
  assert.equal(milestone4.hits, 1);
  assert.equal(milestone4.hitRateAfterMilestonePercent, 100);
});

test('PaperPerformanceAnalyticsEngine gera escopos last7Days e last30Days', () => {
  const engine = new PaperPerformanceAnalyticsEngine();
  const result = engine.analyze({
    settlements,
    sessions,
    generatedAtIso: '2026-06-10T00:00:00.000Z',
    nowIso: '2026-06-10T00:00:00.000Z',
  });

  assert.equal(result.allTime.scope, 'allTime');
  assert.equal(result.last7Days.scope, 'last7Days');
  assert.equal(result.last30Days.scope, 'last30Days');
  assert.equal(result.last7Days.settlementCount, 1);
  assert.equal(result.last30Days.settlementCount, 4);
});

test('PaperPerformanceAnalyticsEngine mantém governança paper only', () => {
  const engine = new PaperPerformanceAnalyticsEngine();
  const report = engine.analyze({
    settlements,
    sessions,
    generatedAtIso: '2026-06-10T00:00:00.000Z',
    nowIso: '2026-06-10T00:00:00.000Z',
  }).allTime;

  assert.equal(report.paperOnly, true);
  assert.equal(report.liveMoneyAuthorized, false);
  assert.equal(report.productionMoneyAllowed, false);
  assert.equal(report.operatorDecisionRequired, true);
  assert.equal(report.supervisedRecommendationOnly, true);
  assert.ok(report.hudSummary.includes('liveMoneyAuthorized=false'));
});
