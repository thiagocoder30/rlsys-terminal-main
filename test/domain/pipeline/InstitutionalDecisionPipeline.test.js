'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  InstitutionalDecisionPipeline,
} = require('../../../dist/application/pipeline/InstitutionalDecisionPipeline.js');

const now = 1760000000000;

function memorySample(id, overrides = {}) {
  return {
    memoryId: `memory-${id}`,
    contextKey: 'fusion:a14:stable',
    strategyId: 'fusion',
    tableId: 'mesa-a14',
    occurredAtEpochMs: now + id,
    paperSignals: 12,
    favorableSignals: 9,
    blockedSignals: 1,
    wins: 7,
    losses: 2,
    neutralOutcomes: 1,
    confidenceScore: 0.86,
    consensusScore: 0.88,
    maxDrawdownUnits: 2,
    operatorViolationCount: 0,
    certificationFailureCount: 0,
    ...overrides,
  };
}

function patternSample(id, overrides = {}) {
  return {
    sampleId: `pattern-${id}`,
    patternKey: 'fusion-pattern-stable',
    strategyId: 'fusion',
    tableId: 'mesa-a14',
    occurredAtEpochMs: now + id,
    memoryScore: 0.88,
    similarityScore: 0.84,
    correlationScore: 0.82,
    outcomeScore: 0.81,
    riskScore: 0.22,
    operatorScore: 0.9,
    blocked: false,
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    pipelineId: 'pipeline-251',
    recommendationId: 'recommendation-251',
    sessionId: 'session-251',
    strategyId: 'fusion',
    tableId: 'mesa-a14',
    generatedAtEpochMs: now,
    memorySamples: [memorySample(1), memorySample(2), memorySample(3)],
    patternSamples: [patternSample(1), patternSample(2), patternSample(3)],
    certificationApproved: true,
    riskApproved: true,
    operatorApproved: true,
    consensusScore: 0.88,
    calibratedConfidence: 0.86,
    strategyReputationScore: 0.84,
    tableReputationScore: 0.82,
    similarityScore: 0.84,
    correlationScore: 0.82,
    learningWeightScore: 0.86,
    learningValidationScore: 0.88,
    learningValidationStatus: 'LEARNING_TRUSTED',
    ...overrides,
  };
}

test('institutional decision pipeline returns PAPER_FAVORAVEL for aligned PAPER context', () => {
  const pipeline = new InstitutionalDecisionPipeline();
  const result = pipeline.run(baseInput());

  assert.equal(result.ok, true);
  assert.equal(result.value.finalDecision, 'PAPER_FAVORAVEL');
  assert.equal(result.value.status, 'PIPELINE_READY');
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.recommendation.paperOnly, true);
  assert.equal(result.value.traceability.paperOnly, true);
  assert.equal(result.value.explainability.paperOnly, true);
});

test('institutional decision pipeline blocks when certification gate is blocked', () => {
  const pipeline = new InstitutionalDecisionPipeline();
  const result = pipeline.run(baseInput({
    certificationApproved: false,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.finalDecision, 'NAO_UTILIZAR');
  assert.equal(result.value.status, 'PIPELINE_BLOCKED');
  assert.equal(result.value.recommendation.defensiveBlock, true);
});

test('institutional decision pipeline is deterministic and idempotent for same input', () => {
  const pipeline = new InstitutionalDecisionPipeline();
  const input = baseInput();

  const first = pipeline.run(input);
  const second = pipeline.run(input);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value, second.value);
});

test('institutional decision pipeline validates required identity fields', () => {
  const pipeline = new InstitutionalDecisionPipeline();
  const result = pipeline.run(baseInput({
    pipelineId: '',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.code, 'INVALID_INSTITUTIONAL_DECISION_PIPELINE_INPUT');
});

test('institutional decision pipeline returns review or block for degraded learning context', () => {
  const pipeline = new InstitutionalDecisionPipeline();
  const result = pipeline.run(baseInput({
    memorySamples: [
      memorySample(1, { favorableSignals: 2, blockedSignals: 6, wins: 1, losses: 8, confidenceScore: 0.42, consensusScore: 0.44, maxDrawdownUnits: 9 }),
      memorySample(2, { favorableSignals: 2, blockedSignals: 6, wins: 1, losses: 8, confidenceScore: 0.42, consensusScore: 0.44, maxDrawdownUnits: 9 }),
      memorySample(3, { favorableSignals: 2, blockedSignals: 6, wins: 1, losses: 8, confidenceScore: 0.42, consensusScore: 0.44, maxDrawdownUnits: 9 }),
    ],
    patternSamples: [
      patternSample(1, { memoryScore: 0.35, similarityScore: 0.36, correlationScore: 0.34, outcomeScore: 0.35, riskScore: 0.82, operatorScore: 0.4, blocked: true }),
      patternSample(2, { memoryScore: 0.35, similarityScore: 0.36, correlationScore: 0.34, outcomeScore: 0.35, riskScore: 0.82, operatorScore: 0.4, blocked: true }),
      patternSample(3, { memoryScore: 0.35, similarityScore: 0.36, correlationScore: 0.34, outcomeScore: 0.35, riskScore: 0.82, operatorScore: 0.4, blocked: true }),
    ],
    learningValidationStatus: 'LEARNING_UNCERTAIN',
    learningValidationScore: 0.42,
    learningWeightScore: 0.4,
  }));

  assert.equal(result.ok, true);
  assert.notEqual(result.value.finalDecision, 'PAPER_FAVORAVEL');
});
