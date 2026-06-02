#!/usr/bin/env node
'use strict';

const { InstitutionalConsensusRuntime } = require('../dist/infrastructure/paper-operational/institutional-consensus-runtime');

const runtime = new InstitutionalConsensusRuntime();

const result = runtime.evaluate({
  sessionId: 'paper-consensus-demo',
  signals: [
    { id: 'sig-warmup', kind: 'WARMUP', vote: 'SUPPORT', confidence: 0.9, weight: 1, explanation: 'warmup qualificado' },
    { id: 'sig-momentum', kind: 'MOMENTUM', vote: 'SUPPORT', confidence: 0.85, weight: 1, explanation: 'momentum estável' },
    { id: 'sig-volatility', kind: 'VOLATILITY', vote: 'OBSERVE', confidence: 0.35, weight: 0.8, explanation: 'volatilidade controlada' },
    { id: 'sig-cluster', kind: 'CLUSTER', vote: 'SUPPORT', confidence: 0.8, weight: 1, explanation: 'cluster contextual favorável' },
    { id: 'sig-readiness', kind: 'READINESS_GATE', vote: 'SUPPORT', confidence: 1, weight: 1.5, explanation: 'gate paper certificado' },
    { id: 'sig-operator', kind: 'OPERATOR', vote: 'SUPPORT', confidence: 0.9, weight: 1, explanation: 'operador estável' },
    { id: 'sig-performance', kind: 'PERFORMANCE', vote: 'SUPPORT', confidence: 0.8, weight: 1, explanation: 'performance paper saudável' },
  ],
  policy: {
    minimumSignals: 5,
    minimumSupportScoreForReady: 0.55,
    minimumSupportScoreForCertified: 0.7,
    maximumBlockScoreForReady: 0.2,
    maximumObserveScoreForCertified: 0.2,
    requireReadinessGateSupport: true,
  },
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
  process.exitCode = result.value.decision === 'PAPER_CONSENSUS_BLOCKED' ? 1 : 0;
}
