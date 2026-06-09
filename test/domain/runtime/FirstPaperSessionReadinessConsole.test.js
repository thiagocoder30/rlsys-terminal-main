'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FirstPaperSessionReadinessConsole } = require('../../../dist/application/runtime/FirstPaperSessionReadinessConsole.js');

test('Readiness console aggregates blocked and allowed gates', () => {
  const consoleEngine = new FirstPaperSessionReadinessConsole();
  const input = {
    presentationId: 'readiness-278',
    generatedAtEpochMs: Date.now(),
    bankrollGate: {
      verdict: 'BLOCKED',
      reason: 'Stop Loss diário atingido',
      allowedStake: 0,
      remainingLossBudget: 0,
      remainingProfitTarget: 0,
    },
    dailyRiskLock: {
      presentationId: 'lock-278',
      generatedAtEpochMs: Date.now(),
      status: 'PRESENTATION_BLOCKED',
      title: 'Sessão PAPER bloqueada',
      subtitle: 'Trava diária de banca ativa',
      mainMessage: 'Stop Loss diário atingido.',
      reasonLabel: 'Stop Loss diário atingido',
      actionLabel: 'Não iniciar nova sessão PAPER.',
      unlockAtEpochMs: Date.now() + 3600000,
      renderedText: '',
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
      institutionalAnalysisMode: true,
    },
    paperCertification: {
      status: 'PAPER_CERTIFIED',
      certificationId: 'cert-001',
      campaignId: 'camp-001',
      report: {},
    },
  };

  const result = consoleEngine.generate(input);
  assert.equal(result.ready, false);
  assert.ok(result.summaryText.includes('Stop Loss diário atingido'));
});
