'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OperatorEntrySupervisionController,
} = require('../../../dist/application/runtime/OperatorEntrySupervisionController.js');

const {
  PaperEntrySupervisionLedgerExporter,
} = require('../../../dist/application/runtime/PaperEntrySupervisionLedgerExporter.js');

function supervision(overrides = {}) {
  const controller = new OperatorEntrySupervisionController();

  const result = controller.supervise({
    supervisionId: 'supervision-282',
    generatedAtEpochMs: 1760000000000,
    sessionId: 'paper-session-282',
    strategyName: 'Triplicação',
    hudRecommendation: 'ENTRAR',
    hudRenderedText: 'RL.SYS CORE — PAPER HUD\nRecomendação: ENTRAR ✅',
    operatorDecision: 'CONFIRMAR',
    operatorNote: 'Operador confirmou entrada PAPER supervisionada.',
    requestedStake: 3.5,
    confidencePercent: 92,
    evidence: ['BANKROLL_SAFE', 'DAILY_LOCK_RELEASED', 'TRIPLICACAO_FAVORABLE'],
    ...overrides,
  });

  assert.equal(result.ok, true);
  return result.value;
}

test('paper entry supervision ledger exporter exports deterministic JSON', () => {
  const exporter = new PaperEntrySupervisionLedgerExporter();

  const first = exporter.export({
    exportId: 'export-282',
    generatedAtEpochMs: 1760000001000,
    format: 'JSON',
    supervision: supervision(),
  });

  const second = exporter.export({
    exportId: 'export-282',
    generatedAtEpochMs: 1760000001000,
    format: 'JSON',
    supervision: supervision(),
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.value.ledgerEntry.checksum, second.value.ledgerEntry.checksum);
  assert.equal(first.value.ledgerEntry.paperEntryAuthorized, true);
  assert.equal(first.value.ledgerEntry.automaticExecutionAllowed, false);
  assert.match(first.value.payload, /"status":"PAPER_ENTRY_AUTHORIZED"/);
});

test('paper entry supervision ledger exporter exports text payload', () => {
  const exporter = new PaperEntrySupervisionLedgerExporter();

  const result = exporter.export({
    exportId: 'export-282-text',
    generatedAtEpochMs: 1760000001000,
    format: 'TEXT',
    supervision: supervision(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.format, 'TEXT');
  assert.match(result.value.payload, /PAPER ENTRY SUPERVISION LEDGER/);
  assert.match(result.value.payload, /Automatic execution allowed: false/);
});

test('paper entry supervision ledger exporter records operator rejection', () => {
  const exporter = new PaperEntrySupervisionLedgerExporter();

  const result = exporter.export({
    exportId: 'export-282-rejected',
    generatedAtEpochMs: 1760000001000,
    format: 'JSON',
    supervision: supervision({
      operatorDecision: 'RECUSAR',
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.ledgerEntry.status, 'PAPER_ENTRY_REJECTED_BY_OPERATOR');
  assert.equal(result.value.ledgerEntry.paperEntryAuthorized, false);
  assert.equal(result.value.ledgerEntry.authorizedStake, 0);
});

test('paper entry supervision ledger exporter records HUD denial', () => {
  const exporter = new PaperEntrySupervisionLedgerExporter();

  const result = exporter.export({
    exportId: 'export-282-denied',
    generatedAtEpochMs: 1760000001000,
    format: 'JSON',
    supervision: supervision({
      hudRecommendation: 'AGUARDAR',
      hudRenderedText: 'RL.SYS CORE — PAPER HUD\nRecomendação: AGUARDAR ❌',
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.ledgerEntry.status, 'PAPER_ENTRY_DENIED_BY_HUD');
  assert.equal(result.value.ledgerEntry.paperEntryAuthorized, false);
});

test('paper entry supervision ledger exporter rejects invalid export id', () => {
  const exporter = new PaperEntrySupervisionLedgerExporter();

  const result = exporter.export({
    exportId: '',
    generatedAtEpochMs: 1760000001000,
    format: 'JSON',
    supervision: supervision(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_PAPER_ENTRY_SUPERVISION_LEDGER_EXPORT_INPUT');
});

test('paper entry supervision ledger exporter preserves PAPER-only governance semantics', () => {
  const exporter = new PaperEntrySupervisionLedgerExporter();

  const result = exporter.export({
    exportId: 'export-282-semantics',
    generatedAtEpochMs: 1760000001000,
    format: 'JSON',
    supervision: supervision(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.ledgerEntry.paperOnly, true);
  assert.equal(result.value.ledgerEntry.operatorDecisionRequired, true);
  assert.equal(result.value.ledgerEntry.supervisedRecommendationOnly, true);
  assert.equal(result.value.ledgerEntry.institutionalAnalysisMode, true);
  assert.equal(result.value.ledgerEntry.automaticExecutionAllowed, false);
  assert.equal(result.value.ledgerEntry.automaticBetExecutionAllowed, false);
  assert.equal(result.value.ledgerEntry.liveMoneyAuthorization, false);
});
