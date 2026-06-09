'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PaperSessionHudFinalizer } = require('../../../dist/application/runtime/PaperSessionHudFinalizer.js');

test('HUD finalizer bloqueia entrada corretamente', () => {
  const finalizer = new PaperSessionHudFinalizer();
  const input = {
    presentationId: 'hud-final-280',
    generatedAtEpochMs: Date.now(),
    bankrollGate: { verdict: 'BLOCKED', reason: 'Stop Loss diário atingido', allowedStake: 0, remainingLossBudget: 0, remainingProfitTarget: 0 },
    dailyRiskLock: { status: 'PRESENTATION_BLOCKED', reasonLabel: 'Trava diária ativa', presentationId: 'lock-280', generatedAtEpochMs: Date.now(), title: '', subtitle: '', mainMessage: '', actionLabel: '', unlockAtEpochMs: Date.now(), renderedText: '', operatorDecisionRequired: true, supervisedRecommendationOnly: true, institutionalAnalysisMode: true },
    triplicacaoStatus: { trigger: 'FAVORABLE', confidence: 95 },
    paperCertification: { status: 'PAPER_CERTIFIED', certificationId: 'cert-001', campaignId: 'camp-001', report: {} },
    requestedStake: 5,
  };
  const output = finalizer.generate(input);
  assert.ok(output.includes('AGUARDAR ❌'));
});
