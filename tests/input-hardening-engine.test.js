const assert = require('node:assert/strict');
const test = require('node:test');
const { InputHardeningEngine } = require('../dist/domain/security/InputHardeningEngine');

function engine() {
  return new InputHardeningEngine();
}

test('InputHardeningEngine accepts bounded manual roulette payloads', () => {
  const result = engine().inspect({
    inputId: 'manual-001',
    channel: 'MANUAL_ROUND',
    payload: { eventId: 'spin-1', value: 17, source: 'operator' }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'ACCEPT');
  assert.equal(result.value.action, 'ALLOW');
  assert.equal(result.value.descriptor.invalidRouletteValues, 0);
  assert.equal(result.value.auditChecksum.length, 64);
});

test('InputHardeningEngine rejects invalid roulette values before domain processing', () => {
  const result = engine().inspect({
    inputId: 'ocr-001',
    channel: 'VISION_OCR',
    payload: { sequence: [0, 1, 36, 99] }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'REJECT');
  assert.equal(result.value.action, 'DROP_INPUT');
  assert.ok(result.value.violations.some((violation) => violation.code === 'INVALID_ROULETTE_VALUE'));
});

test('InputHardeningEngine rejects suspicious tokens and prototype pollution keys', () => {
  const result = engine().inspect({
    inputId: 'api-001',
    channel: 'API_PAYLOAD',
    payload: {
      safe: 'ok',
      constructor: 'polluted',
      note: '<script>alert(1)</script>'
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'REJECT');
  assert.equal(result.value.descriptor.suspiciousTokenHits > 0, true);
  assert.equal(result.value.descriptor.prototypeKeyHits > 0, true);
  assert.ok(result.value.sanitizedPreview.some((field) => field.preview.includes('[redacted]')));
});

test('InputHardeningEngine sanitizes long strings without mutating payload', () => {
  const payload = { operatorNote: 'A'.repeat(300) };
  const result = engine().inspect({
    inputId: 'snapshot-001',
    channel: 'SESSION_SNAPSHOT',
    payload
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'SANITIZE');
  assert.equal(result.value.action, 'ALLOW_SANITIZED');
  assert.equal(payload.operatorNote.length, 300);
  assert.ok(result.value.sanitizedPreview.some((field) => field.preview.endsWith('…')));
});

test('InputHardeningEngine rejects payloads exceeding bounded array policy', () => {
  const result = engine().inspect({
    inputId: 'event-bus-001',
    channel: 'EVENT_BUS',
    payload: { events: Array.from({ length: 300 }, (_, index) => ({ eventId: `e-${index}` })) }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'REJECT');
  assert.ok(result.value.violations.some((violation) => violation.code === 'ARRAY_LIMIT_EXCEEDED'));
});

test('InputHardeningEngine returns typed Result error for malformed request', () => {
  const result = engine().inspect({
    inputId: '',
    channel: 'API_PAYLOAD',
    payload: {}
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INPUT_HARDENING_FAILED');
});
