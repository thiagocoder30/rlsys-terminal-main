'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PaperValidationCampaignEngine,
} = require('../../../dist/application/runtime/PaperValidationCampaignEngine.js');

const now = 1760000000000;

function round(sequence, number) {
  return {
    sequence,
    number,
    occurredAtEpochMs: now + sequence * 1000,
  };
}

function dryRun(id, overrides = {}) {
  return {
    dryRunId: `dry-run-${id}`,
    sessionId: `session-${id}`,
    strategyId: 'fusion',
    tableId: 'mesa-a14',
    generatedAtEpochMs: now + id * 10000,
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

function campaign(overrides = {}) {
  return {
    campaignId: 'campaign-254',
    generatedAtEpochMs: now,
    dryRuns: [
      dryRun(1),
      dryRun(2),
      dryRun(3),
    ],
    ...overrides,
  };
}

test('paper validation campaign engine consolidates multiple dry runs', () => {
  const engine = new PaperValidationCampaignEngine();
  const result = engine.run(campaign());

  assert.equal(result.ok, true);
  assert.equal(result.value.campaignId, 'campaign-254');
  assert.equal(result.value.dryRunCount, 3);
  assert.equal(result.value.successCount, 3);
  assert.equal(result.value.failureCount, 0);
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.ok(['CAMPAIGN_CERTIFIED', 'CAMPAIGN_REVIEW', 'CAMPAIGN_BLOCKED'].includes(result.value.status));
});

test('paper validation campaign engine is deterministic and idempotent for same campaign', () => {
  const engine = new PaperValidationCampaignEngine();
  const payload = campaign();

  const first = engine.run(payload);
  const second = engine.run(payload);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value, second.value);
});

test('paper validation campaign engine blocks duplicated dry run ids', () => {
  const engine = new PaperValidationCampaignEngine();
  const result = engine.run(campaign({
    dryRuns: [
      dryRun(1),
      dryRun(1),
    ],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.code, 'INVALID_PAPER_VALIDATION_CAMPAIGN_INPUT');
});

test('paper validation campaign engine returns blocked when dry run certification is blocked', () => {
  const engine = new PaperValidationCampaignEngine();
  const result = engine.run(campaign({
    dryRuns: [
      dryRun(1, { certificationApproved: false }),
      dryRun(2, { certificationApproved: false }),
      dryRun(3, { certificationApproved: false }),
    ],
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'CAMPAIGN_BLOCKED');
  assert.equal(result.value.decisionCounts.naoUtilizar, 3);
});

test('paper validation campaign engine preserves supervised PAPER-only campaign semantics', () => {
  const engine = new PaperValidationCampaignEngine();
  const result = engine.run(campaign());

  assert.equal(result.ok, true);
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticExecutionAllowed, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.humanSupervisionRequired, true);
});
