const test = require('node:test');
const assert = require('node:assert/strict');
const { IncrementalStatisticsEngine } = require('../dist/domain/statistics/IncrementalStatisticsEngine');

test('IncrementalStatisticsEngine updates bounded rolling metrics without recompute over full history', () => {
  const engine = new IncrementalStatisticsEngine({ windowSize: 8, idempotencyCacheSize: 16 });
  for (let index = 0; index < 12; index += 1) {
    const result = engine.ingest({ value: index % 6, sequence: index });
    assert.equal(result.success, true);
  }

  const snapshot = engine.snapshot();
  assert.equal(snapshot.windowSize, 8);
  assert.equal(snapshot.activeSize, 8);
  assert.equal(snapshot.totalAccepted, 12);
  assert.equal(snapshot.duplicateEvents, 0);
  assert.ok(snapshot.uniqueNumbers <= 6);
  assert.ok(snapshot.normalizedEntropy > 0);
  assert.ok(snapshot.checksum.length >= 32);
});

test('IncrementalStatisticsEngine preserves idempotency for duplicate round events', () => {
  const engine = new IncrementalStatisticsEngine({ windowSize: 16 });
  const first = engine.ingest({ value: 17, eventId: 'spin-17' });
  const duplicate = engine.ingest({ value: 17, eventId: 'spin-17' });

  assert.equal(first.success, true);
  assert.equal(duplicate.success, true);
  assert.equal(duplicate.value.status, 'DUPLICATE_IGNORED');
  assert.equal(duplicate.value.snapshot.activeSize, 1);
  assert.equal(duplicate.value.snapshot.duplicateEvents, 1);
});

test('IncrementalStatisticsEngine detects concentrated low-entropy windows', () => {
  const engine = new IncrementalStatisticsEngine({ windowSize: 20 });
  const values = [7, 1, 7, 2, 7, 3, 7, 4, 7, 5, 7, 6, 7, 8, 7, 9, 7, 10, 7, 11];
  for (let index = 0; index < values.length; index += 1) {
    const result = engine.ingest({ value: values[index], sequence: index });
    assert.equal(result.success, true);
  }

  const snapshot = engine.snapshot();
  assert.equal(snapshot.trend, 'CONCENTRATING');
  assert.ok(snapshot.maxNumberConcentration >= 0.5);
  assert.ok(snapshot.hotNumbers.includes(7));
});

test('IncrementalStatisticsEngine replays deterministically with matching checksum', () => {
  const commands = Array.from({ length: 32 }, (_, index) => ({ value: (index * 3) % 37, sequence: index }));
  const left = new IncrementalStatisticsEngine({ windowSize: 24 });
  const right = new IncrementalStatisticsEngine({ windowSize: 24 });

  const leftReplay = left.replay(commands);
  const rightReplay = right.replay(commands);

  assert.equal(leftReplay.success, true);
  assert.equal(rightReplay.success, true);
  assert.equal(leftReplay.value.checksum, rightReplay.value.checksum);
  assert.deepEqual(leftReplay.value.sectors, rightReplay.value.sectors);
});

test('IncrementalStatisticsEngine rejects malformed roulette values without silent failure', () => {
  const engine = new IncrementalStatisticsEngine();
  const result = engine.ingest({ value: 99 });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INCREMENTAL_STATS_INVALID_SPIN');
});
