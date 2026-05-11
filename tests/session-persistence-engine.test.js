const test = require('node:test');
const assert = require('node:assert/strict');
const { LiveSessionRuntime } = require('../dist/domain/session/LiveSessionRuntime');
const { SessionPersistenceEngine } = require('../dist/domain/session/SessionPersistenceEngine');

function buildSession() {
  const runtime = new LiveSessionRuntime({ warmupSize: 5, maxHistorySize: 12, decisionWindowSize: 5 });
  const journal = [];
  let snapshot;
  for (let index = 0; index < 8; index += 1) {
    const command = {
      sessionId: 'persist-1',
      value: index % 37,
      eventId: `persist-event-${index}`,
      sequence: index,
      occurredAt: `2026-05-10T00:00:0${index}.000Z`
    };
    const result = runtime.ingest(command);
    assert.equal(result.success, true);
    snapshot = result.value.snapshot;
    journal.push({
      command,
      idempotencyKey: result.value.idempotencyKey,
      accepted: result.value.status === 'ACCEPTED',
      recordedAt: command.occurredAt
    });
  }
  return { snapshot, journal };
}

test('SessionPersistenceEngine creates and verifies deterministic persistence records', () => {
  const { snapshot, journal } = buildSession();
  const engine = new SessionPersistenceEngine({ warmupSize: 5, maxHistorySize: 12, decisionWindowSize: 5 });

  const first = engine.createRecord(snapshot, journal, '2026-05-10T01:00:00.000Z');
  const second = engine.createRecord(snapshot, journal, '2026-05-10T01:00:00.000Z');

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.recordChecksum, second.value.recordChecksum);

  const verification = engine.verifyRecord(first.value);
  assert.equal(verification.success, true);
  assert.equal(verification.value.status, 'VALID');
  assert.equal(verification.value.snapshot.sessionId, 'persist-1');
});

test('SessionPersistenceEngine replays journal for crash recovery with matching checksum', () => {
  const { snapshot, journal } = buildSession();
  const engine = new SessionPersistenceEngine({ warmupSize: 5, maxHistorySize: 12, decisionWindowSize: 5 });
  const record = engine.createRecord(snapshot, journal, '2026-05-10T01:00:00.000Z');
  assert.equal(record.success, true);

  const recovered = engine.recoverFromRecord(record.value);

  assert.equal(recovered.success, true);
  assert.equal(recovered.value.status, 'REPLAYED');
  assert.equal(recovered.value.replayedEvents, 8);
  assert.equal(recovered.value.snapshot.checksum, snapshot.checksum);
  assert.deepEqual(recovered.value.snapshot.historyWindow, snapshot.historyWindow);
});

test('SessionPersistenceEngine preserves idempotency during replay', () => {
  const { snapshot, journal } = buildSession();
  const duplicatedJournal = [...journal, journal[0]];
  const engine = new SessionPersistenceEngine({ warmupSize: 5, maxHistorySize: 12, decisionWindowSize: 5 });

  const replay = engine.replay('persist-1', duplicatedJournal.map(entry => entry.command), snapshot.checksum);

  assert.equal(replay.success, true);
  assert.equal(replay.value.replayedEvents, 8);
  assert.equal(replay.value.ignoredDuplicateEvents, 1);
});

test('SessionPersistenceEngine rejects corrupted records without silent failure', () => {
  const { snapshot, journal } = buildSession();
  const engine = new SessionPersistenceEngine({ warmupSize: 5, maxHistorySize: 12, decisionWindowSize: 5 });
  const record = engine.createRecord(snapshot, journal, '2026-05-10T01:00:00.000Z');
  assert.equal(record.success, true);

  const corrupted = { ...record.value, recordChecksum: 'corrupted' };
  const verification = engine.verifyRecord(corrupted);

  assert.equal(verification.success, false);
  assert.equal(verification.error.code, 'SESSION_PERSISTENCE_RECORD_CORRUPTED');
});
