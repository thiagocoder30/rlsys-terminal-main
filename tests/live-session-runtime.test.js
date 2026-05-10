const test = require('node:test');
const assert = require('node:assert/strict');
const { LiveSessionRuntime } = require('../dist/domain/session/LiveSessionRuntime');

test('LiveSessionRuntime ingests rounds incrementally with bounded windows', () => {
  const runtime = new LiveSessionRuntime({ warmupSize: 20, maxHistorySize: 24, decisionWindowSize: 20 });
  let report;
  for (let index = 0; index < 25; index += 1) {
    const result = runtime.ingest({ sessionId: 's1', value: index % 37, eventId: `e-${index}`, sequence: index });
    assert.equal(result.success, true);
    report = result.value;
  }

  assert.equal(report.status, 'ACCEPTED');
  assert.equal(report.snapshot.readyForDecision, true);
  assert.equal(report.snapshot.historyWindow.length, 24);
  assert.equal(report.snapshot.warmupWindow.length, 20);
  assert.equal(report.snapshot.acceptedEvents, 25);
});

test('LiveSessionRuntime is idempotent for duplicated event ids', () => {
  const runtime = new LiveSessionRuntime({ warmupSize: 3 });
  const first = runtime.ingest({ sessionId: 's2', value: 8, eventId: 'same-event' });
  const duplicate = runtime.ingest({ sessionId: 's2', value: 8, eventId: 'same-event' });

  assert.equal(first.success, true);
  assert.equal(duplicate.success, true);
  assert.equal(duplicate.value.status, 'DUPLICATE_IGNORED');
  assert.equal(duplicate.value.snapshot.roundCount, 1);
  assert.equal(duplicate.value.snapshot.duplicateEvents, 1);
});

test('LiveSessionRuntime rejects invalid roulette values without silent failure', () => {
  const runtime = new LiveSessionRuntime();
  const result = runtime.ingest({ sessionId: 's3', value: 99, eventId: 'bad' });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'LIVE_SESSION_INVALID_ROUND');
});
