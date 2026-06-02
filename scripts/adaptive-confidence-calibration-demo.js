#!/usr/bin/env node
'use strict';

const { AdaptiveConfidenceCalibrationEngine } = require('../dist/infrastructure/paper-operational/adaptive-confidence-calibration-engine');

const engine = new AdaptiveConfidenceCalibrationEngine();

const result = engine.calibrate({
  strategyId: 'fusion',
  tableId: 'mesa-a',
  baseConfidence: 82,
  strategyReputationDecision: 'REPUTATION_STRONG',
  strategySuggestedWeight: 1.18,
  tableReputationDecision: 'TABLE_REPUTATION_STRONG',
  tableSuggestedWeight: 1.16,
  crossSessionDecision: 'CROSS_SESSION_STRONG',
  crossSessionSuggestedWeight: 1.2,
  trendDirection: 'TREND_IMPROVING',
  operatorStatus: 'OPERATOR_STABLE',
  consensusDecision: 'PAPER_CONSENSUS_READY',
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
  process.exitCode = result.value.decision === 'CALIBRATION_BLOCKED' ? 1 : 0;
}
