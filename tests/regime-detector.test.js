const test = require('node:test');
const assert = require('node:assert/strict');
const { RegimeDetector } = require('../dist/domain/services/RegimeDetector');

test('RegimeDetector returns bounded stability and windows', () => {
  const detector = new RegimeDetector({ windowSize: 20, stepSize: 10, minWindows: 3 });
  const history = Array.from({ length: 120 }, (_, i) => i % 37);
  const result = detector.detect(history);
  assert.ok(['RANDOM_LIKE', 'SECTOR_DRIFT', 'TRANSITIONAL', 'UNSTABLE'].includes(result.label));
  assert.ok(result.stabilityScore >= 0 && result.stabilityScore <= 1);
  assert.ok(result.windows.length >= 3);
});

test('RegimeDetector marks very small samples as unstable', () => {
  const detector = new RegimeDetector();
  const result = detector.detect([1, 2, 3, 4, 5]);
  assert.equal(result.label, 'UNSTABLE');
  assert.equal(result.stabilityScore, 0);
});
