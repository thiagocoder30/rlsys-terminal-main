#!/usr/bin/env node
'use strict';

const { StrategyConfidenceWeightingEngine } = require('../dist/infrastructure/paper-operational/strategy-confidence-weighting-engine');

const engine = new StrategyConfidenceWeightingEngine();

const result = engine.evaluate({
  strategyId: 'fusion',
  tableId: 'mesa-demo',
  rawConfidence: 84,
  baseWeight: 1,
  tableHistory: {
    sampleSize: 120,
    recentHitRate: 0.62,
    recentDrawdownPercent: 3,
    consistencyScore: 0.74,
    volatilityScore: 0.22,
  },
  readinessScore: 0.95,
  operatorScore: 0.92,
  performanceScore: 0.86,
  consensusScore: 0.9,
  minimumConfidenceForFavoravel: 80,
  minimumConfidenceForCertificado: 88,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
  process.exitCode = result.value.decision === 'PAPER_NAO_UTILIZAR' ? 1 : 0;
}
