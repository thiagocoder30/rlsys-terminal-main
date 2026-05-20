const test = require('node:test');
const assert = require('node:assert/strict');
const { OcrReliabilityMesh } = require('../dist/domain/ocr');

test('OcrReliabilityMesh accepts consensus when quorum and confidence are valid', () => {
  const mesh = new OcrReliabilityMesh();

  const assessment = mesh.assess([
    { frameId: 'a', value: 17, confidence: 0.91, latencyMs: 90, capturedAtEpochMs: 1 },
    { frameId: 'b', value: 17, confidence: 0.93, latencyMs: 100, capturedAtEpochMs: 2 },
    { frameId: 'c', value: 17, confidence: 0.89, latencyMs: 95, capturedAtEpochMs: 3 },
  ]);

  assert.equal(assessment.verdict, 'OCR_ACCEPTED');
  assert.equal(assessment.acceptedValue, 17);
  assert.equal(assessment.quorumCount, 3);
});

test('OcrReliabilityMesh rejects contradictory OCR frames', () => {
  const mesh = new OcrReliabilityMesh();

  const assessment = mesh.assess([
    { frameId: 'a', value: 1, confidence: 0.95, latencyMs: 90, capturedAtEpochMs: 1 },
    { frameId: 'b', value: 2, confidence: 0.95, latencyMs: 90, capturedAtEpochMs: 2 },
    { frameId: 'c', value: 3, confidence: 0.95, latencyMs: 90, capturedAtEpochMs: 3 },
  ]);

  assert.equal(assessment.verdict, 'OCR_REJECTED');
  assert.equal(assessment.acceptedValue, null);
});

test('OcrReliabilityMesh blocks insufficient frames', () => {
  const mesh = new OcrReliabilityMesh();

  const assessment = mesh.assess([
    { frameId: 'a', value: 12, confidence: 0.95, latencyMs: 90, capturedAtEpochMs: 1 },
  ]);

  assert.equal(assessment.verdict, 'BLOCKED');
});

test('OcrReliabilityMesh reviews low confidence consensus', () => {
  const mesh = new OcrReliabilityMesh();

  const assessment = mesh.assess([
    { frameId: 'a', value: 22, confidence: 0.50, latencyMs: 90, capturedAtEpochMs: 1 },
    { frameId: 'b', value: 22, confidence: 0.55, latencyMs: 90, capturedAtEpochMs: 2 },
    { frameId: 'c', value: 22, confidence: 0.60, latencyMs: 90, capturedAtEpochMs: 3 },
  ]);

  assert.equal(assessment.verdict, 'OCR_REVIEW');
  assert.equal(assessment.acceptedValue, null);
});

test('OcrReliabilityMesh ignores invalid roulette values', () => {
  const mesh = new OcrReliabilityMesh();

  const assessment = mesh.assess([
    { frameId: 'a', value: 99, confidence: 0.95, latencyMs: 90, capturedAtEpochMs: 1 },
    { frameId: 'b', value: 17, confidence: 0.95, latencyMs: 90, capturedAtEpochMs: 2 },
    { frameId: 'c', value: 17, confidence: 0.95, latencyMs: 90, capturedAtEpochMs: 3 },
  ]);

  assert.equal(assessment.verdict, 'BLOCKED');
});
