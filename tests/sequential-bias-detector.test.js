const test = require('node:test');
const assert = require('node:assert/strict');
const { SequentialBiasDetector, valueToState } = require('../dist/domain/sequential/SequentialBiasDetector');

test('valueToState maps roulette values to institutional states', () => {
  assert.equal(valueToState(0), 'zero');
  assert.equal(valueToState(12), 'low');
  assert.equal(valueToState(24), 'mid');
  assert.equal(valueToState(36), 'high');
});

test('SequentialBiasDetector returns low evidence for rotating balanced states', () => {
  const detector = new SequentialBiasDetector();
  const values = Array.from({ length: 600 }, (_, index) => [1, 14, 27, 2, 15, 28][index % 6]);
  const report = detector.analyze(values);
  assert.equal(report.sampleSize, 600);
  assert.ok(report.sequentialBiasScore >= 0);
  assert.ok(report.sequentialBiasScore <= 1);
  assert.equal(report.temporalClustering.label, 'none');
});

test('SequentialBiasDetector flags persistent temporal clusters', () => {
  const detector = new SequentialBiasDetector();
  const values = [
    ...Array.from({ length: 260 }, () => 3),
    ...Array.from({ length: 80 }, (_, index) => 13 + (index % 12)),
    ...Array.from({ length: 260 }, () => 31)
  ];
  const report = detector.analyze(values);
  assert.ok(['MODERATE_TEMPORAL_EVIDENCE', 'STRONG_TEMPORAL_EVIDENCE'].includes(report.verdict));
  assert.ok(report.runLength.maxStateRun >= 200);
  assert.ok(report.temporalClustering.burstScore > 0.4);
});
