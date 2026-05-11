const assert = require('node:assert/strict');
const test = require('node:test');
const { InternalEventBus } = require('../dist/domain/events/InternalEventBus');

test('InternalEventBus delivers events to observers in a typed deterministic report', () => {
  const bus = new InternalEventBus({ idempotencyCacheSize: 16 });
  const received = [];

  const subscription = bus.subscribe({
    id: 'statistics-observer',
    topic: 'session.round.ingested',
    handle: (event) => {
      received.push(event.payload.value);
      return { success: true, value: { observerId: 'statistics-observer', accepted: true, reason: 'stats updated' } };
    }
  });

  assert.equal(subscription.success, true);
  const published = bus.publish({
    topic: 'session.round.ingested',
    eventId: 'spin-1',
    occurredAtSpin: 1,
    priority: 'NORMAL',
    payload: { value: 17 }
  });

  assert.equal(published.success, true);
  assert.equal(published.value.status, 'DELIVERED');
  assert.equal(published.value.deliveredObservers, 1);
  assert.deepEqual(received, [17]);
  assert.match(published.value.checksum, /^[a-f0-9]{64}$/);
});

test('InternalEventBus preserves idempotency for duplicate event ids', () => {
  const bus = new InternalEventBus({ idempotencyCacheSize: 16 });
  let calls = 0;

  bus.subscribe({
    id: 'decision-observer',
    topic: 'decision.requested',
    handle: () => {
      calls += 1;
      return { success: true, value: { observerId: 'decision-observer', accepted: true } };
    }
  });

  const event = { topic: 'decision.requested', eventId: 'decision-1', occurredAtSpin: 100, priority: 'HIGH', payload: { ready: true } };
  const first = bus.publish(event);
  const second = bus.publish(event);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.status, 'DELIVERED');
  assert.equal(second.value.status, 'DUPLICATE_IGNORED');
  assert.equal(calls, 1);
  assert.equal(bus.snapshot().duplicateEvents, 1);
});

test('InternalEventBus isolates observer failures without throwing through publisher', () => {
  const bus = new InternalEventBus();

  bus.subscribe({
    id: 'audit-ok',
    topic: 'system.audit.recorded',
    handle: () => ({ success: true, value: { observerId: 'audit-ok', accepted: true } })
  });
  bus.subscribe({
    id: 'audit-reject',
    topic: 'system.audit.recorded',
    handle: () => ({ success: false, error: new Error('observer failed safely') })
  });

  const report = bus.publish({
    topic: 'system.audit.recorded',
    eventId: 'audit-1',
    occurredAtSpin: 0,
    priority: 'LOW',
    payload: { message: 'decision audited' }
  });

  assert.equal(report.success, true);
  assert.equal(report.value.deliveredObservers, 1);
  assert.equal(report.value.failedObservers, 1);
  assert.equal(bus.snapshot().totalObserverFailures, 1);
});

test('InternalEventBus rejects malformed events without silent failure', () => {
  const bus = new InternalEventBus();
  const result = bus.publish({ topic: 'session.round.ingested', eventId: '', occurredAtSpin: -1, priority: 'FAST', payload: null });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'EVENT_BUS_INVALID_EVENT');
});
