'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PaperRuntimePipelineAdapter,
} = require('../../../dist/application/runtime/PaperRuntimePipelineAdapter.js');

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
    adapterId: 'adapter-252',
    sessionId: 'session-252',
    strategyId: 'fusion',
    tableId: 'mesa-a14',
    generatedAtEpochMs: now,
    rounds: [
      round(1, 7),
      round(2, 18),
      round(3, 29),
      round(4, 12),
      round(5, 33),
    ],
    certificationApproved: true,
    riskApproved: true,
    operatorApproved: true,
    ...overrides,
  };
}

test('paper runtime pipeline adapter converts observed rounds into institutional decision report', () => {
  const adapter = new PaperRuntimePipelineAdapter();
  const result = adapter.evaluate(input());

  assert.equal(result.ok, true);
  assert.equal(result.value.adapterId, 'adapter-252');
  assert.equal(result.value.roundCount, 5);
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.ok(['PAPER_FAVORAVEL', 'OBSERVAR', 'NAO_UTILIZAR'].includes(result.value.finalDecision));
  assert.equal(result.value.pipeline.paperOnly, true);
});

test('paper runtime pipeline adapter blocks invalid roulette numbers before pipeline execution', () => {
  const adapter = new PaperRuntimePipelineAdapter();
  const result = adapter.evaluate(input({
    rounds: [
      round(1, 7),
      round(2, 40),
      round(3, 29),
    ],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.code, 'INVALID_PAPER_RUNTIME_PIPELINE_ADAPTER_INPUT');
});

test('paper runtime pipeline adapter is deterministic for the same PAPER runtime input', () => {
  const adapter = new PaperRuntimePipelineAdapter();
  const payload = input();

  const first = adapter.evaluate(payload);
  const second = adapter.evaluate(payload);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value, second.value);
});

test('paper runtime pipeline adapter keeps bet execution blocked even when suggestion is allowed', () => {
  const adapter = new PaperRuntimePipelineAdapter();
  const result = adapter.evaluate(input());

  assert.equal(result.ok, true);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticExecutionAllowed, false);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.humanSupervisionRequired, true);
});

test('paper runtime pipeline adapter returns pipeline block when certification is blocked', () => {
  const adapter = new PaperRuntimePipelineAdapter();
  const result = adapter.evaluate(input({
    certificationApproved: false,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.finalDecision, 'NAO_UTILIZAR');
});
