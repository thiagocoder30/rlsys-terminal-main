import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OcrReliabilityIntelligenceEngine
} from '../dist/domain/vision/ocr-reliability-intelligence-engine.js';

const engine = new OcrReliabilityIntelligenceEngine();
const values100 = Array.from({ length: 100 }, (_, index) => index % 37);

test('OcrReliabilityIntelligenceEngine accepts complete high-confidence warmup as reliable while gates stay blocked', () => {
  const report = engine.evaluate({
    sessionId: 'ocr-reliable',
    expectedCount: 100,
    frames: [
      {
        frameId: 'f1',
        timestamp: 1,
        extractedValues: values100,
        confidence: 96,
        visualDriftScore: 4,
        blurScore: 3,
        duplicatePressure: 2
      }
    ]
  });

  assert.equal(report.state, 'RELIABLE');
  assert.equal(report.canUseForWarmup, true);
  assert.equal(report.canUseForRuntime, false);
  assert.equal(report.gate, 'BLOCKED');
  assert.equal(report.liveMoneyAuthorized, false);
});

test('OcrReliabilityIntelligenceEngine marks incomplete extraction as insufficient sample', () => {
  const report = engine.evaluate({
    expectedCount: 100,
    frames: [
      {
        frameId: 'f1',
        timestamp: 1,
        extractedValues: [1, 2, 3],
        confidence: 91
      }
    ]
  });

  assert.equal(report.state, 'INSUFFICIENT_SAMPLE');
  assert.equal(report.canUseForWarmup, false);
});

test('OcrReliabilityIntelligenceEngine degrades near-complete OCR with moderate rejection pressure', () => {
  const report = engine.analyze({
    expectedCount: 100,
    frames: [
      {
        frameId: 'f1',
        timestamp: 1,
        extractedValues: values100.slice(0, 94),
        rejectedValues: [99, 98, 97, 96, 95, 94],
        confidence: 84,
        visualDriftScore: 12,
        blurScore: 12,
        duplicatePressure: 12
      }
    ]
  });

  assert.equal(report.state, 'DEGRADED');
  assert.equal(report.requiresManualReview, true);
});

test('OcrReliabilityIntelligenceEngine rejects unstable visual extraction', () => {
  const report = engine.execute({
    expectedCount: 100,
    frames: [
      {
        frameId: 'f1',
        timestamp: 1,
        extractedValues: values100.slice(0, 90),
        confidence: 52,
        visualDriftScore: 80,
        blurScore: 76,
        duplicatePressure: 55
      }
    ]
  });

  assert.equal(report.state, 'REJECTED');
  assert.equal(report.canUseForWarmup, false);
});

test('OcrReliabilityIntelligenceEngine is deterministic and bounded', () => {
  const input = {
    expectedCount: 100,
    frames: [
      {
        frameId: 'f1',
        timestamp: 1,
        extractedValues: values100.slice(0, 80),
        confidence: 70,
        visualDriftScore: 25,
        blurScore: 20
      }
    ]
  };

  const first = engine.evaluate(input);
  const second = engine.evaluate(input);

  assert.deepEqual(first, second);
  assert.ok(first.reliabilityScore >= 0 && first.reliabilityScore <= 100);
  assert.ok(first.completenessScore >= 0 && first.completenessScore <= 100);
});

test('OcrReliabilityIntelligenceEngine rejects invalid roulette values without silent failure', () => {
  assert.throws(
    () => engine.evaluate({
      frames: [
        {
          frameId: 'f1',
          timestamp: 1,
          extractedValues: [0, 37],
          confidence: 90
        }
      ]
    }),
    /INVALID_OCR_RELIABILITY_ROULETTE_VALUE/
  );
});
