'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { OcrEvidenceQuarantineGate } = require('../../../src/domain/ocr/OcrEvidenceQuarantineGate');

test('allows valid OCR evidence but never enables production money', () => {
  const gate = new OcrEvidenceQuarantineGate({ minConfidence: 0.8, minNumbers: 3 });

  const decision = gate.evaluate({
    numbers: [0, 32, 15, 19, 4, 21],
    confidence: 0.91,
    source: 'warmup-ocr'
  });

  assert.equal(decision.status, 'ALLOW');
  assert.equal(decision.allowed, true);
  assert.equal(decision.productionMoneyAllowed, false);
  assert.equal(decision.acceptedNumbers, 6);
  assert.deepEqual(decision.reasons, []);
});

test('quarantines OCR evidence with low confidence', () => {
  const gate = new OcrEvidenceQuarantineGate({ minConfidence: 0.9, minNumbers: 3 });

  const decision = gate.evaluate({
    numbers: [1, 2, 3],
    confidence: 0.7
  });

  assert.equal(decision.status, 'QUARANTINE');
  assert.equal(decision.allowed, false);
  assert.equal(decision.productionMoneyAllowed, false);
  assert.ok(decision.reasons.includes('low_ocr_confidence'));
});

test('quarantines invalid roulette numbers', () => {
  const gate = new OcrEvidenceQuarantineGate({ minConfidence: 0.8, minNumbers: 3 });

  const decision = gate.evaluate({
    numbers: [12, 37, 5],
    confidence: 0.95
  });

  assert.equal(decision.status, 'QUARANTINE');
  assert.ok(decision.reasons.includes('roulette_number_out_of_range'));
});

test('quarantines incomplete OCR samples', () => {
  const gate = new OcrEvidenceQuarantineGate({ minConfidence: 0.8, minNumbers: 10 });

  const decision = gate.evaluate({
    numbers: [7, 8, 9],
    confidence: 0.99
  });

  assert.equal(decision.status, 'QUARANTINE');
  assert.ok(decision.reasons.includes('insufficient_ocr_numbers'));
});

test('keeps evaluation deterministic and idempotent', () => {
  const gate = new OcrEvidenceQuarantineGate({ minConfidence: 0.8, minNumbers: 3 });
  const candidate = {
    numbers: [1, 2, 3],
    confidence: 0.99
  };

  const first = gate.evaluate(candidate);
  const second = gate.evaluate(candidate);

  assert.deepEqual(first, second);
});
