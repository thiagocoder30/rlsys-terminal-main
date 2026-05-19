const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SessionReplayStudio
} = require('../dist/domain/replay/SessionReplayStudio.js');

test('stores replay events', () => {
  const replay = new SessionReplayStudio();

  replay.append({
    eventId: 'evt-1',
    sessionId: 'session-1',
    spinIndex: 1,
    verdict: 'NO_GO',
    trigger: 'DRAWDOWN_LOCK',
    reason: 'velocity exceeded',
    timestamp: Date.now(),
    latencyMs: 12
  });

  assert.equal(replay.getEvents().length, 1);
});

test('returns last verdict', () => {
  const replay = new SessionReplayStudio();

  replay.append({
    eventId: 'evt-2',
    sessionId: 'session-1',
    spinIndex: 2,
    verdict: 'FREEZE',
    trigger: 'HEARTBEAT_FAILURE',
    reason: 'heartbeat lost',
    timestamp: Date.now(),
    latencyMs: 20
  });

  assert.equal(
    replay.getLastVerdict(),
    'FREEZE'
  );
});

test('counts verdict occurrences', () => {
  const replay = new SessionReplayStudio();

  replay.append({
    eventId: 'evt-3',
    sessionId: 'session-1',
    spinIndex: 3,
    verdict: 'NO_GO',
    trigger: 'SNAPSHOT_REVOKED',
    reason: 'snapshot invalid',
    timestamp: Date.now(),
    latencyMs: 10
  });

  replay.append({
    eventId: 'evt-4',
    sessionId: 'session-1',
    spinIndex: 4,
    verdict: 'NO_GO',
    trigger: 'DRAWDOWN_LOCK',
    reason: 'drawdown exceeded',
    timestamp: Date.now(),
    latencyMs: 11
  });

  assert.equal(
    replay.countVerdict('NO_GO'),
    2
  );
});
