const test = require('node:test');
const assert = require('node:assert/strict');
const { DeterministicReplayStudio } = require('../dist/domain/replay/DeterministicReplayStudio');
const { LiveSessionRuntime } = require('../dist/domain/session/LiveSessionRuntime');
const { SessionPersistenceEngine } = require('../dist/domain/session/SessionPersistenceEngine');

function commands(sessionId = 'replay-1', count = 9) {
  return Array.from({ length: count }, (_, index) => ({
    sessionId,
    value: index % 37,
    eventId: `replay-event-${index}`,
    sequence: index,
    occurredAt: `2026-05-12T03:00:0${index}.000Z`
  }));
}

function buildRecord() {
  const runtime = new LiveSessionRuntime({ warmupSize: 5, maxHistorySize: 12, decisionWindowSize: 5 });
  const journal = [];
  let snapshot;
  for (const command of commands('record-replay-1')) {
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
  const persistence = new SessionPersistenceEngine({ warmupSize: 5, maxHistorySize: 12, decisionWindowSize: 5 });
  const record = persistence.createRecord(snapshot, journal, '2026-05-12T03:10:00.000Z');
  assert.equal(record.success, true);
  return record.value;
}

test('DeterministicReplayStudio replays command streams with stable checksums', () => {
  const studio = new DeterministicReplayStudio({ warmupSize: 5, maxHistorySize: 12, decisionWindowSize: 5 });
  const first = studio.replay({ sessionId: 'replay-1', commands: commands('replay-1', 25) });
  const second = studio.replay({ sessionId: 'replay-1', commands: commands('replay-1', 25) });

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.status, 'REPLAYED');
  assert.equal(first.value.frameCount, 25);
  assert.equal(first.value.acceptedEvents, 25);
  assert.equal(first.value.deterministicRunChecksum, second.value.deterministicRunChecksum);
  assert.equal(first.value.frames.at(-1).readyForDecision, true);
});

test('DeterministicReplayStudio preserves idempotency for duplicate frame events', () => {
  const studio = new DeterministicReplayStudio({ warmupSize: 5, maxHistorySize: 12, decisionWindowSize: 5 });
  const base = commands('dup-replay-1');
  const replay = studio.replay({ sessionId: 'dup-replay-1', commands: [...base, base[0]] });

  assert.equal(replay.success, true);
  assert.equal(replay.value.acceptedEvents, 9);
  assert.equal(replay.value.duplicateEvents, 1);
  assert.equal(replay.value.frames.at(-1).ingestionStatus, 'DUPLICATE_IGNORED');
});

test('DeterministicReplayStudio replays verified persistence records', () => {
  const record = buildRecord();
  const studio = new DeterministicReplayStudio({ warmupSize: 5, maxHistorySize: 12, decisionWindowSize: 5 });
  const replay = studio.replay({ record });

  assert.equal(replay.success, true);
  assert.equal(replay.value.status, 'REPLAYED');
  assert.equal(replay.value.sourceKind, 'PERSISTENCE_RECORD');
  assert.equal(replay.value.finalSnapshotChecksum, record.snapshot.checksum);
  assert.equal(replay.value.blockers.length, 0);
});

test('DeterministicReplayStudio blocks checkpoint mismatches without throwing', () => {
  const studio = new DeterministicReplayStudio({ warmupSize: 5, maxHistorySize: 12, decisionWindowSize: 5 });
  const replay = studio.replay({
    sessionId: 'checkpoint-replay-1',
    commands: commands('checkpoint-replay-1'),
    checkpoints: [{ frameIndex: 3, expectedSnapshotChecksum: '00000000000000000000000000000000' }]
  });

  assert.equal(replay.success, true);
  assert.equal(replay.value.status, 'BLOCKED');
  assert.equal(replay.value.blockers.length, 1);
});

test('DeterministicReplayStudio rejects malformed requests without silent failure', () => {
  const studio = new DeterministicReplayStudio();
  const replay = studio.replay({ sessionId: 'bad', commands: [], record: buildRecord() });

  assert.equal(replay.success, false);
  assert.equal(replay.error.code, 'DETERMINISTIC_REPLAY_SOURCE_AMBIGUOUS');
});
