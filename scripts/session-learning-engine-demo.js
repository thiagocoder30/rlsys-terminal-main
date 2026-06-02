#!/usr/bin/env node
'use strict';

const { SessionLearningEngine } = require('../dist/infrastructure/paper-operational/session-learning-engine');

const engine = new SessionLearningEngine();

const result = engine.analyze({
  sessionId: 'paper-learning-demo',
  tableId: 'mesa-demo',
  strategyId: 'fusion',
  startedAtEpochMs: 1717200060000,
  finishedAtEpochMs: 1717200160000,
  roundCount: 24,
  operatorStatus: 'OPERATOR_STABLE',
  consensusDecision: 'PAPER_CONSENSUS_READY',
  strategyReputation: 'REPUTATION_STRONG',
  tableReputation: 'TABLE_REPUTATION_STRONG',
  suggestions: [
    { status: 'PAPER_FAVORAVEL', finalConfidence: 86, manualUseAllowed: true, occurredAtEpochMs: 1717200070000 },
    { status: 'PAPER_OBSERVAR', finalConfidence: 72, manualUseAllowed: false, occurredAtEpochMs: 1717200080000 },
    { status: 'PAPER_CERTIFICADO', finalConfidence: 89, manualUseAllowed: true, occurredAtEpochMs: 1717200090000 },
  ],
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
  process.exitCode = result.value.sessionRecord.finalStatus === 'PAPER_LEARNING_CAUTION' ? 1 : 0;
}
