#!/usr/bin/env node
'use strict';

const { InstitutionalSuggestionComposer } = require('../dist/infrastructure/paper-operational/institutional-suggestion-composer');

const composer = new InstitutionalSuggestionComposer();

const result = composer.compose({
  sessionId: 'paper-suggestion-demo',
  tableId: 'mesa-demo',
  strategyId: 'fusion',
  finalConfidence: 89.4,
  consensusDecision: 'PAPER_CONSENSUS_CERTIFIED',
  confidenceDecision: 'PAPER_CERTIFICADO',
  strategyReputation: 'REPUTATION_STRONG',
  tableReputation: 'TABLE_REPUTATION_STRONG',
  readinessStatus: 'PAPER_CERTIFIED',
  operatorStatus: 'OPERATOR_STABLE',
  explanationItems: [
    'Mesa com reputação forte.',
    'Estratégia com reputação forte.',
    'Operador estável.',
    'Consenso institucional certificado.',
  ],
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
  process.exitCode = result.value.status === 'PAPER_NAO_UTILIZAR' ? 1 : 0;
}
