'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PaperRuntimeDryRunHarness,
} = require('../../../dist/application/runtime/PaperRuntimeDryRunHarness.js');

const now = 1760000000000;

function round(sequence, number) {
  return {
    sequence,
    number,
    occurredAtEpochMs: now + sequence * 1000,
  };
}

function input(overrides = {}) {
  return {
    dryRunId: 'dry-run-253',
    sessionId: 'session-253',
    strategyId: 'fusion',
    tableId: 'mesa-a14',
    generatedAtEpochMs: now,
    rounds: [
      round(1, 7),
      round(2, 18),
      round(3, 29),
      round(4, 12),
      round(5, 33),
      round(6, 21),
    ],
    certificationApproved: true,
    riskApproved: true,
    operatorApproved: true,
    ...overrides,
  };
}

test('paper runtime dry run harness produces supervised PAPER session report', () => {
  const harness = new PaperRuntimeDryRunHarness();
  const result = harness.run(input());

  assert.equal(result.ok, true);
  assert.equal(result.value.dryRunId, 'dry-run-253');
  assert.equal(result.value.roundCount, 6);
  assert.ok(['DRY_RUN_READY', 'DRY_RUN_REVIEW', 'DRY_RUN_BLOCKED'].includes(result.value.status));
  assert.ok(['PAPER_FAVORAVEL', 'OBSERVAR', 'NAO_UTILIZAR'].includes(result.value.finalDecision));
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.humanSupervisionRequired, true);
});

test('paper runtime dry run harness transcript is deterministic and audit friendly', () => {
  const harness = new PaperRuntimeDryRunHarness();
  const result = harness.run(input());

  assert.equal(result.ok, true);
  assert.ok(result.value.transcript.some((line) => line === 'DRY_RUN_ID=dry-run-253'));
  assert.ok(result.value.transcript.some((line) => line.startsWith('FINAL_DECISION=')));
  assert.ok(result.value.transcript.some((line) => line === 'PAPER_ONLY=true'));
  assert.ok(result.value.transcript.some((line) => line === 'AUTOMATIC_BET_EXECUTION_ALLOWED=false'));
});

test('paper runtime dry run harness is idempotent for same observed PAPER rounds', () => {
  const harness = new PaperRuntimeDryRunHarness();
  const payload = input();

  const first = harness.run(payload);
  const second = harness.run(payload);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value, second.value);
});

test('paper runtime dry run harness blocks invalid identity before adapter execution', () => {
  const harness = new PaperRuntimeDryRunHarness();
  const result = harness.run(input({
    dryRunId: '',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.code, 'INVALID_PAPER_RUNTIME_DRY_RUN_INPUT');
});

test('paper runtime dry run harness reports NAO_UTILIZAR when certification is blocked', () => {
  const harness = new PaperRuntimeDryRunHarness();
  const result = harness.run(input({
    certificationApproved: false,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.finalDecision, 'NAO_UTILIZAR');
  assert.equal(result.value.status, 'DRY_RUN_BLOCKED');
});
