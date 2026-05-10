const test = require('node:test');
const assert = require('node:assert/strict');
const { VisionReliabilityInspector } = require('../dist/domain/vision/VisionReliabilityInspector');

test('VisionReliabilityInspector accepts complete high-quality warmup extraction', () => {
  const inspector = new VisionReliabilityInspector();
  const values = Array.from({ length: 100 }, (_, index) => index % 37);
  const report = inspector.inspect({ values, rejected: 0, declaredTotal: 100 });

  assert.equal(report.status, 'ACCEPTED');
  assert.equal(report.risk, 'LOW');
  assert.equal(report.correctionRequired, false);
  assert.equal(report.accepted, 100);
});

test('VisionReliabilityInspector requires manual review for low item confidence', () => {
  const inspector = new VisionReliabilityInspector();
  const values = Array.from({ length: 100 }, (_, index) => index % 37);
  const report = inspector.inspect({ values, rejected: 1, declaredTotal: 100, itemConfidences: Array(100).fill(0.6) });

  assert.equal(report.status, 'REVIEW');
  assert.equal(report.correctionRequired, true);
  assert.ok(report.issues.some((issue) => issue.code === 'OCR_LOW_ITEM_CONFIDENCE'));
});

test('VisionReliabilityInspector rejects incomplete high-rejection extraction', () => {
  const inspector = new VisionReliabilityInspector();
  const values = Array.from({ length: 75 }, (_, index) => index % 37);
  const report = inspector.inspect({ values, rejected: 25, declaredTotal: 100 });

  assert.equal(report.status, 'REJECTED');
  assert.equal(report.risk, 'HIGH');
  assert.ok(report.issues.some((issue) => issue.severity === 'BLOCKER'));
});
