'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { OperatorHudMinimalistAdapter } = require('../../../dist/application/runtime/OperatorHudMinimalistAdapter.js');

test('HUD minimalista exibe recomendação corretamente', () => {
  const hud = new OperatorHudMinimalistAdapter();
  const input = {
    presentationId: 'hud-279',
    generatedAtEpochMs: Date.now(),
    bankrollGate: { verdict: 'SAFE', reason: '', allowedStake: 10, remainingLossBudget: 5, remainingProfitTarget: 5 },
    dailyRiskLock: { status: 'PRESENTATION_INFORMATIONAL_LOCK', reasonLabel: 'Teste informativo', presentationId: 'lock-279', generatedAtEpochMs: Date.now(), title: '', subtitle: '', mainMessage: '', actionLabel: '', unlockAtEpochMs: Date.now(), renderedText: '', operatorDecisionRequired: true, supervisedRecommendationOnly: true, institutionalAnalysisMode: true },
    triplicacaoStatus: { trigger: 'FAVORABLE', confidence: 95 },
    paperCertification: { status: 'PAPER_CERTIFIED', certificationId: 'cert-001', campaignId: 'camp-001', report: {} },
    suggestedStake: 3.5,
  };
  const output = hud.render(input);
  assert.ok(output.includes('ENTRAR ✅'));
});
