'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PaperValidationCampaignEngine,
} = require('../../../dist/application/runtime/PaperValidationCampaignEngine.js');
const {
  InstitutionalPaperCertificationEngine,
} = require('../../../dist/application/runtime/InstitutionalPaperCertificationEngine.js');

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

function buildCampaign(id, dryRuns) {
  const engine = new PaperValidationCampaignEngine();
  const result = engine.run({
    campaignId: `campaign-${id}`,
    generatedAtEpochMs: now + id * 100000,
    dryRuns,
  });

  assert.equal(result.ok, true);
  return result.value;
}

test('institutional paper certification engine certifies successful PAPER campaigns', () => {
  const campaign = buildCampaign(1, [
    dryRun(1),
    dryRun(2),
    dryRun(3),
  ]);

  const engine = new InstitutionalPaperCertificationEngine();
  const result = engine.certify({
    certificationId: 'paper-certification-255',
    generatedAtEpochMs: now,
    campaigns: [campaign],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_CERTIFIED');
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.humanSupervisionRequired, true);
});

test('institutional paper certification engine blocks blocked campaigns', () => {
  const campaign = buildCampaign(2, [
    dryRun(4, { certificationApproved: false }),
    dryRun(5, { certificationApproved: false }),
    dryRun(6, { certificationApproved: false }),
  ]);

  const engine = new InstitutionalPaperCertificationEngine();
  const result = engine.certify({
    certificationId: 'paper-certification-blocked-255',
    generatedAtEpochMs: now,
    campaigns: [campaign],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_BLOCKED');
  assert.ok(result.value.reasons.includes('CAMPAIGN_BLOCKED'));
});

test('institutional paper certification engine is deterministic for same campaigns', () => {
  const campaign = buildCampaign(3, [
    dryRun(7),
    dryRun(8),
    dryRun(9),
  ]);

  const engine = new InstitutionalPaperCertificationEngine();
  const payload = {
    certificationId: 'paper-certification-idempotent-255',
    generatedAtEpochMs: now,
    campaigns: [campaign],
  };

  const first = engine.certify(payload);
  const second = engine.certify(payload);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value, second.value);
});

test('institutional paper certification engine rejects duplicated campaign ids', () => {
  const campaign = buildCampaign(4, [
    dryRun(10),
    dryRun(11),
  ]);

  const engine = new InstitutionalPaperCertificationEngine();
  const result = engine.certify({
    certificationId: 'paper-certification-duplicate-255',
    generatedAtEpochMs: now,
    campaigns: [campaign, campaign],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.code, 'INVALID_INSTITUTIONAL_PAPER_CERTIFICATION_INPUT');
});

test('institutional paper certification engine preserves supervised PAPER-only semantics', () => {
  const campaign = buildCampaign(5, [
    dryRun(12),
    dryRun(13),
    dryRun(14),
  ]);

  const engine = new InstitutionalPaperCertificationEngine();
  const result = engine.certify({
    certificationId: 'paper-certification-flags-255',
    generatedAtEpochMs: now,
    campaigns: [campaign],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticExecutionAllowed, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.humanSupervisionRequired, true);
});
