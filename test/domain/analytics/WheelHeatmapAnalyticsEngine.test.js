const assert = require('node:assert/strict');
const test = require('node:test');

const {
  WheelHeatmapAnalyticsEngine,
} = require('../../../dist/domain/analytics/WheelHeatmapAnalyticsEngine.js');

test('WheelHeatmapAnalyticsEngine expõe ordem europeia da roda', () => {
  const engine = new WheelHeatmapAnalyticsEngine();

  const order = engine.wheelOrder();

  assert.equal(order.length, 37);
  assert.equal(order[0], 0);
  assert.equal(order[1], 32);
  assert.equal(order[36], 26);
});

test('WheelHeatmapAnalyticsEngine identifica números quentes por frequência e recência', () => {
  const engine = new WheelHeatmapAnalyticsEngine();
  const history = [
    7, 7, 7, 7, 7,
    28, 12, 35, 3, 26,
    7, 7, 7, 7, 7,
  ];

  const report = engine.analyze(history, {
    recentWindow: 10,
    neighborRadius: 2,
    hotThreshold: 60,
  });

  const seven = report.numbers.find((item) => item.number === 7);

  assert.ok(seven);
  assert.ok(seven.count >= 10);
  assert.ok(seven.heatScore >= 60);
  assert.ok(report.hotNumbers.some((item) => item.number === 7));
  assert.equal(report.paperOnly, true);
  assert.equal(report.liveMoneyAuthorized, false);
});

test('WheelHeatmapAnalyticsEngine identifica ausência de números frios', () => {
  const engine = new WheelHeatmapAnalyticsEngine();
  const history = Array.from({ length: 30 }, () => 7);

  const report = engine.analyze(history, {
    recentWindow: 10,
    coldThreshold: 35,
  });

  const zero = report.numbers.find((item) => item.number === 0);

  assert.ok(zero);
  assert.equal(zero.count, 0);
  assert.equal(zero.lastSeenDistance, null);
  assert.equal(zero.absenceScore, 100);
  assert.ok(report.coldNumbers.some((item) => item.number === 0));
});

test('WheelHeatmapAnalyticsEngine calcula pressão de vizinhos', () => {
  const engine = new WheelHeatmapAnalyticsEngine();
  const history = [
    7, 28, 12, 35, 3, 26,
    7, 28, 12, 35, 3, 26,
    7, 28, 12, 35, 3, 26,
  ];

  const report = engine.analyze(history, {
    recentWindow: 12,
    neighborRadius: 2,
  });

  const seven = report.numbers.find((item) => item.number === 7);

  assert.ok(seven);
  assert.ok(seven.neighborPressureScore > 50);
  assert.ok(report.fusionPressureScore >= 0);
});

test('WheelHeatmapAnalyticsEngine calcula setores quentes e frios', () => {
  const engine = new WheelHeatmapAnalyticsEngine();
  const history = [
    27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33,
    27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33,
  ];

  const report = engine.analyze(history, {
    recentWindow: 12,
    hotThreshold: 55,
  });

  const tiers = report.sectorSummaries.find((sector) => sector.sectorId === 'TIERS');

  assert.ok(tiers);
  assert.ok(tiers.totalHits >= 24);
  assert.ok(report.hotSectors.some((sector) => sector.sectorId === 'TIERS'));
});

test('WheelHeatmapAnalyticsEngine ignora valores inválidos', () => {
  const engine = new WheelHeatmapAnalyticsEngine();

  const report = engine.analyze([1, 2, 37, -1, 3, 99, 0]);

  assert.equal(report.sampleSize, 4);
});

test('WheelHeatmapAnalyticsEngine gera texto de auditoria para HUD futuro', () => {
  const engine = new WheelHeatmapAnalyticsEngine();

  const report = engine.analyze([7, 7, 28, 12, 35, 3, 26]);

  assert.ok(report.auditText.includes('WHEEL HEATMAP ANALYTICS'));
  assert.ok(report.auditText.includes('HOT_NUMBERS='));
  assert.ok(report.auditText.includes('COLD_NUMBERS='));
  assert.ok(report.auditText.includes('paperOnly=true'));
  assert.ok(report.auditText.includes('liveMoneyAuthorized=false'));
});

test('WheelHeatmapAnalyticsEngine mantém governança PAPER only', () => {
  const engine = new WheelHeatmapAnalyticsEngine();

  const report = engine.analyze(Array.from({ length: 100 }, () => 7));

  assert.equal(report.paperOnly, true);
  assert.equal(report.liveMoneyAuthorized, false);
  assert.equal(report.productionMoneyAllowed, false);
});
