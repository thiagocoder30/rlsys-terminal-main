const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SessionReplayStudio
} = require('../dist/domain/replay/SessionReplayStudio.js');

function replayEvent(overrides = {}) {
  return {
    eventId: 'evt-1',
    sessionId: 'session-1',
    spinIndex: 1,
    verdict: 'NO_GO',
    trigger: 'DRAWDOWN_LOCK',
    reason: 'velocity exceeded',
    timestamp: 1710000000000,
    latencyMs: 12,
    ...overrides
  };
}

test('SessionReplayStudio stores only bounded counters and last verdict', async () => {
  const replay = new SessionReplayStudio();

  await replay.append(replayEvent());

  assert.equal(replay.getLastVerdict(), 'NO_GO');
  assert.equal(replay.countVerdict('NO_GO'), 1);
});

test('SessionReplayStudio counts verdict occurrences without exposing full event array', async () => {
  const replay = new SessionReplayStudio();

  await replay.append(replayEvent({ eventId: 'evt-1', verdict: 'NO_GO' }));
  await replay.append(replayEvent({ eventId: 'evt-2', spinIndex: 2, verdict: 'NO_GO' }));
  await replay.append(replayEvent({ eventId: 'evt-3', spinIndex: 3, verdict: 'FREEZE' }));

  assert.equal(replay.countVerdict('NO_GO'), 2);
  assert.equal(replay.countVerdict('FREEZE'), 1);
  assert.equal(replay.getLastVerdict(), 'FREEZE');
});
