import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OcrSelfHealingEngine
} from '../dist/domain/vision/ocr-self-healing-engine.js';

const engine = new OcrSelfHealingEngine();

test('OcrSelfHealingEngine accepts healthy OCR only for warmup review while gates stay blocked', () => {
  const report = engine.evaluate({
    reliabilityState: 'RELIABLE',
    fusionState: 'STABLE',
    reliabilityScore: 96,
    fusionConfidenceScore: 94,
    completenessScore: 100,
    lastAcceptedCount: 100,
    expectedCount: 100
  });

  assert.equal(report.state, 'HEALTHY');
  assert.equal(report.canUseForWarmup, true);
  assert.equal(report.canUseForRuntime, false);
  assert.equal(report.gate, 'BLOCKED');
  assert.equal(report.liveMoneyAuthorized, false);
});

test('OcrSelfHealingEngine recommends retry for degraded but recoverable OCR', () => {
  const report = engine.evaluate({
    reliabilityState: 'DEGRADED',
    fusionState: 'DEGRADED',
    reliabilityScore: 78,
    fusionConfidenceScore: 80,
    completenessScore: 92,
    rejectionPressure: 4,
    retryAttempts: 1,
    lastAcceptedCount: 92,
    expectedCount: 100
  });

  assert.equal(report.state, 'RETRY_RECOMMENDED');
  assert.equal(report.canRetry, true);
  assert.ok(report.actions.includes('RETRY_OCR_EXTRACTION'));
});

test('OcrSelfHealingEngine recalibrates conflicted OCR fusion', () => {
  const report = engine.analyze({
    reliabilityState: 'RELIABLE',
    fusionState: 'CONFLICTED',
    reliabilityScore: 88,
    fusionConfidenceScore: 72,
    completenessScore: 100,
    conflictScore: 22,
    contestedPositionRatio: 35,
    lastAcceptedCount: 100,
    expectedCount: 100
  });

  assert.equal(report.state, 'RECALIBRATE');
  assert.equal(report.shouldRecalibrate, true);
  assert.ok(report.actions.includes('RECALIBRATE_REGION_OF_INTEREST'));
});

test('OcrSelfHealingEngine requires recapture under visual or rejection pressure', () => {
  const report = engine.execute({
    reliabilityState: 'UNSTABLE',
    fusionState: 'DEGRADED',
    reliabilityScore: 68,
    fusionConfidenceScore: 70,
    completenessScore: 84,
    visualPenaltyScore: 70,
    rejectionPressure: 10,
    lastAcceptedCount: 84,
    expectedCount: 100
  });

  assert.equal(report.state, 'RECAPTURE_REQUIRED');
  assert.equal(report.shouldRecapture, true);
  assert.ok(report.actions.includes('RECAPTURE_VISUAL_FRAME'));
});

test('OcrSelfHealingEngine requires manual review for insufficient OCR sample', () => {
  const report = engine.evaluate({
    reliabilityState: 'INSUFFICIENT_SAMPLE',
    fusionState: 'INSUFFICIENT_SAMPLE',
    completenessScore: 10,
    lastAcceptedCount: 10,
    expectedCount: 100
  });

  assert.equal(report.state, 'MANUAL_REVIEW_REQUIRED');
  assert.equal(report.requiresManualReview, true);
});

test('OcrSelfHealingEngine locks rejected or exhausted OCR pipeline', () => {
  const report = engine.evaluate({
    reliabilityState: 'REJECTED',
    fusionState: 'REJECTED',
    reliabilityScore: 20,
    fusionConfidenceScore: 20,
    completenessScore: 80,
    retryAttempts: 3,
    consecutiveFailures: 3,
    lastAcceptedCount: 80,
    expectedCount: 100
  });

  assert.equal(report.state, 'LOCKED');
  assert.equal(report.requiresManualReview, true);
  assert.equal(report.canRetry, false);
  assert.ok(report.actions.includes('LOCK_OCR_PIPELINE'));
});

test('OcrSelfHealingEngine is deterministic and bounded', () => {
  const input = {
    reliabilityState: 'DEGRADED',
    fusionState: 'DEGRADED',
    reliabilityScore: 76,
    fusionConfidenceScore: 78,
    completenessScore: 90,
    retryAttempts: 1,
    lastAcceptedCount: 90,
    expectedCount: 100
  };

  const first = engine.evaluate(input);
  const second = engine.evaluate(input);

  assert.deepEqual(first, second);
  assert.ok(first.healingPriorityScore >= 0 && first.healingPriorityScore <= 100);
  assert.ok(first.retryBudgetRemaining >= 0 && first.retryBudgetRemaining <= 3);
});
