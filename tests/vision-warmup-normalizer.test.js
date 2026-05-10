const test = require('node:test');
const assert = require('node:assert/strict');
const { VisionWarmupNormalizer } = require('../dist/domain/vision/VisionWarmupNormalizer');

test('VisionWarmupNormalizer extracts valid roulette numbers from JSON markdown', () => {
  const normalizer = new VisionWarmupNormalizer();
  const result = normalizer.normalize('```json\n{"total":3,"sequencia":[0,18,"36"]}\n```');

  assert.equal(result.success, true);
  assert.deepEqual(result.value.values, [0, 18, 36]);
  assert.equal(result.value.accepted, 3);
  assert.equal(result.value.rejected, 0);
});

test('VisionWarmupNormalizer reports rejected OCR values without guessing', () => {
  const normalizer = new VisionWarmupNormalizer();
  const result = normalizer.normalize({ total: 4, history: [1, 2, 99, 'x'] });

  assert.equal(result.success, true);
  assert.deepEqual(result.value.values, [1, 2]);
  assert.equal(result.value.rejected, 2);
  assert.ok(result.value.warnings.some((warning) => warning.startsWith('DECLARED_TOTAL_MISMATCH')));
});

test('VisionWarmupNormalizer rejects payload without sequence', () => {
  const normalizer = new VisionWarmupNormalizer();
  const result = normalizer.normalize({ total: 100 });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'VISION_SEQUENCE_MISSING');
});


test('VisionWarmupNormalizer reads object values and exposes reliability review', () => {
  const normalizer = new VisionWarmupNormalizer();
  const payload = {
    total: 100,
    sequencia: Array.from({ length: 100 }, (_, index) => ({ value: index % 37, confidence: 0.61 }))
  };
  const result = normalizer.normalize(payload);

  assert.equal(result.success, true);
  assert.equal(result.value.values.length, 100);
  assert.equal(result.value.reliability.status, 'REVIEW');
  assert.ok(result.value.warnings.includes('OCR_LOW_ITEM_CONFIDENCE'));
});
