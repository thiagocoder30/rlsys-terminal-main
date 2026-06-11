const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FusionHeatmapIntegrationEngine,
} = require('../../../dist/application/runtime/FusionHeatmapIntegrationEngine.js');

function repeat(values, times) {
  const output = [];
  for (let index = 0; index < times; index += 1) output.push(...values);
  return output;
}

test('FusionHeatmapIntegrationEngine bloqueia amostra insuficiente', () => {
  const engine = new FusionHeatmapIntegrationEngine();

  const report = engine.analyze([7, 7, 28, 12], {
    minSampleSize: 60,
  });

  assert.equal(report.mode, 'BLOCKED');
  assert.equal(report.blockers.includes('FUSION_HEATMAP_SAMPLE_INSUFFICIENT'), true);
  assert.equal(report.liveMoneyAuthorized, false);
});

test('FusionHeatmapIntegrationEngine gera região alvo a partir de setor quente', () => {
  const engine = new FusionHeatmapIntegrationEngine();
  const history = repeat([27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33], 8);

  const report = engine.analyze(history, {
    recentWindow: 36,
    minSampleSize: 60,
    minFusionPressureScore: 20,
    minRecencyPressureScore: 20,
  });

  assert.ok(report.targetRegions.length > 0);
  assert.ok(report.targetRegions.some((region) => region.regionId === 'TIERS'));
  assert.ok(report.fusionConfidenceScore > 0);
  assert.ok(report.auditText.includes('FUSION HEATMAP INTEGRATION'));
});

test('FusionHeatmapIntegrationEngine pode ficar FUSION_READY com pressão forte', () => {
  const engine = new FusionHeatmapIntegrationEngine();
  const history = repeat([7, 28, 12, 35, 3, 26, 7, 28, 12, 35, 3, 26], 10);

  const report = engine.analyze(history, {
    recentWindow: 50,
    minSampleSize: 60,
    minFusionPressureScore: 20,
    minRecencyPressureScore: 20,
    maxDispersionScore: 100,
  });

  assert.ok(['FUSION_READY', 'OBSERVE', 'BLOCKED'].includes(report.mode));
  assert.ok(report.fusionPressureScore >= 0);
  assert.equal(report.paperOnly, true);
  assert.equal(report.productionMoneyAllowed, false);
});

test('FusionHeatmapIntegrationEngine converte relatório para sinal de consenso', () => {
  const engine = new FusionHeatmapIntegrationEngine();
  const history = repeat([7, 28, 12, 35, 3, 26], 12);

  const report = engine.analyze(history, {
    recentWindow: 30,
    minSampleSize: 60,
    minFusionPressureScore: 20,
    minRecencyPressureScore: 20,
    maxDispersionScore: 100,
  });

  const signal = engine.toConsensusSignal(report);

  assert.equal(signal.strategyId, 'fusion-reduzida');
  assert.equal(signal.source, 'FUSION_REDUZIDA');
  assert.equal(signal.enabled, true);
  assert.equal(typeof signal.confidenceScore, 'number');
  assert.equal(typeof signal.riskScore, 'number');
  assert.ok(['PAPER_ONLY', 'OBSERVE', 'BLOCKED'].includes(signal.suggestedMode));
});

test('FusionHeatmapIntegrationEngine mantém governança PAPER only', () => {
  const engine = new FusionHeatmapIntegrationEngine();
  const report = engine.analyze(repeat([7, 28, 12, 35, 3, 26], 20), {
    minSampleSize: 60,
    minFusionPressureScore: 20,
    minRecencyPressureScore: 20,
  });

  assert.equal(report.paperOnly, true);
  assert.equal(report.liveMoneyAuthorized, false);
  assert.equal(report.productionMoneyAllowed, false);
  assert.ok(report.auditText.includes('liveMoneyAuthorized=false'));
});
