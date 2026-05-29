import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ConfidenceAwareOcrFusionEngine
} from '../dist/domain/vision/confidence-aware-ocr-fusion-engine.js';

const engine = new ConfidenceAwareOcrFusionEngine();
const values100 = Array.from({ length: 100 }, (_, index) => index % 37);
const shifted100 = Array.from({ length: 100 }, (_, index) => (index + 1) % 37);

test('ConfidenceAwareOcrFusionEngine creates stable fusion from aligned high-confidence frames', () => {
  const report = engine.fuse({
    sessionId: 'fusion-stable',
    expectedCount: 100,
    frames: [
      { frameId: 'f1', timestamp: 1, extractedValues: values100, confidence: 96, visualDriftScore: 3, blurScore: 2 },
      { frameId: 'f2', timestamp: 2, extractedValues: values100, confidence: 94, visualDriftScore: 4, blurScore: 3 }
    ]
  });

  assert.equal(report.state, 'STABLE');
  assert.equal(report.fusedCount, 100);
  assert.equal(report.contestedPositionRatio, 0);
  assert.equal(report.canUseForWarmup, true);
  assert.equal(report.canUseForRuntime, false);
  assert.equal(report.gate, 'BLOCKED');
  assert.equal(report.liveMoneyAuthorized, false);
});

test('ConfidenceAwareOcrFusionEngine degrades near-complete OCR fusion', () => {
  const report = engine.evaluate({
    expectedCount: 100,
    frames: [
      {
        frameId: 'f1',
        timestamp: 1,
        extractedValues: values100.slice(0, 94),
        confidence: 87,
        visualDriftScore: 10,
        blurScore: 10,
        rejectedValues: [99, 98, 97, 96, 95, 94]
      }
    ]
  });

  assert.equal(report.state, 'DEGRADED');
  assert.equal(report.requiresManualReview, true);
});

test('ConfidenceAwareOcrFusionEngine rejects highly conflicted frame consensus', () => {
  const report = engine.execute({
    expectedCount: 100,
    frames: [
      { frameId: 'f1', timestamp: 1, extractedValues: values100, confidence: 94 },
      { frameId: 'f2', timestamp: 2, extractedValues: shifted100, confidence: 94 }
    ]
  });

  assert.equal(report.state, 'REJECTED');
  assert.ok(report.contestedPositionRatio >= 80);
  assert.equal(report.canUseForWarmup, false);
});

test('ConfidenceAwareOcrFusionEngine detects conflicted but not rejected fusion', () => {
  const partiallyShifted = values100.map((value, index) => index < 35 ? shifted100[index] : value);

  const report = engine.evaluate({
    expectedCount: 100,
    frames: [
      { frameId: 'f1', timestamp: 1, extractedValues: values100, confidence: 94 },
      { frameId: 'f2', timestamp: 2, extractedValues: partiallyShifted, confidence: 84 }
    ]
  });

  assert.equal(report.state, 'CONFLICTED');
  assert.ok(report.contestedPositionRatio >= 25);
  assert.equal(report.requiresManualReview, true);
});

test('ConfidenceAwareOcrFusionEngine is deterministic and bounded', () => {
  const input = {
    expectedCount: 100,
    frames: [
      { frameId: 'f1', timestamp: 1, extractedValues: values100, confidence: 91, visualDriftScore: 12, blurScore: 10 }
    ]
  };

  const first = engine.fuse(input);
  const second = engine.fuse(input);

  assert.deepEqual(first, second);
  assert.ok(first.fusionConfidenceScore >= 0 && first.fusionConfidenceScore <= 100);
  assert.ok(first.conflictScore >= 0 && first.conflictScore <= 100);
  assert.ok(first.contestedPositionRatio >= 0 && first.contestedPositionRatio <= 100);
  assert.ok(first.completenessScore >= 0 && first.completenessScore <= 100);
});

test('ConfidenceAwareOcrFusionEngine rejects invalid roulette values without silent failure', () => {
  assert.throws(
    () => engine.fuse({
      frames: [
        { frameId: 'f1', timestamp: 1, extractedValues: [0, 37], confidence: 90 }
      ]
    }),
    /INVALID_CONFIDENCE_AWARE_OCR_FUSION_ROULETTE_VALUE/
  );
});
