'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { OcrEvidenceQualityScoringEngine } = require('../../../src/domain/ocr/OcrEvidenceQualityScoringEngine');

test('scores strong OCR evidence without enabling production money', () => {
  const engine = new OcrEvidenceQualityScoringEngine({ targetNumbers: 6 });

  const result = engine.score({
    numbers: [0, 32, 15, 19, 4, 21],
    confidence: 0.96
  });

  assert.equal(result.band, 'STRONG');
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.acceptedNumbers, 6);
  assert.equal(result.reasons.length, 0);
  assert.ok(result.score >= 0.86);
});

test('penalizes OCR warnings deterministically', () => {
  const engine = new OcrEvidenceQualityScoringEngine({ targetNumbers: 4 });

  const clean = engine.score({
    numbers: [1, 2, 3, 4],
    confidence: 0.95
  });

  const warned = engine.score({
    numbers: [1, 2, 3, 4],
    confidence: 0.95,
    warnings: ['blur', 'partial-frame']
  });

  assert.ok(clean.score > warned.score);
  assert.equal(warned.warningPenalty, 0.1);
});

test('detects invalid roulette numbers and lowers integrity', () => {
  const engine = new OcrEvidenceQualityScoringEngine({ targetNumbers: 4 });

  const result = engine.score({
    numbers: [1, 2, 37, 4],
    confidence: 0.95
  });

  assert.equal(result.acceptedNumbers, 3);
  assert.ok(result.reasons.includes('invalid_roulette_numbers_present'));
  assert.ok(result.integrityComponent < 1);
  assert.equal(result.productionMoneyAllowed, false);
});

test('rejects empty candidates safely', () => {
  const engine = new OcrEvidenceQualityScoringEngine();

  const result = engine.score({
    numbers: [],
    confidence: 0.9
  });

  assert.equal(result.band, 'REJECTED');
  assert.equal(result.acceptedNumbers, 0);
  assert.ok(result.reasons.includes('empty_ocr_numbers'));
});

test('is deterministic and idempotent', () => {
  const engine = new OcrEvidenceQualityScoringEngine({ targetNumbers: 5 });
  const candidate = {
    numbers: [0, 1, 2, 3, 4],
    confidence: 0.91,
    warnings: ['minor-skew']
  };

  const first = engine.score(candidate);
  const second = engine.score(candidate);

  assert.deepEqual(first, second);
});

test('validates threshold configuration', () => {
  assert.throws(
    () => new OcrEvidenceQualityScoringEngine({
      weakThreshold: 0.8,
      acceptableThreshold: 0.7,
      strongThreshold: 0.9
    }),
    /quality thresholds/
  );
});
