const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  SessionReplayStudio
} = require('../dist/domain/replay/SessionReplayStudio.js');
const {
  JsonLinesReplayRepository
} = require('../dist/infrastructure/replay/JsonLinesReplayRepository.js');
const {
  RuntimeReplayRecorder
} = require('../dist/application/live/RuntimeReplayRecorder.js');

test('JsonLinesReplayRepository persists replay events as append-only JSONL', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-replay-'));
  const repository = new JsonLinesReplayRepository(dir);
  const replayStudio = new SessionReplayStudio(repository);
  const recorder = new RuntimeReplayRecorder(replayStudio);

  await recorder.record({
    sessionId: 'session-a',
    spinIndex: 1,
    verdict: 'FREEZE',
    trigger: 'HEARTBEAT_FAILURE',
    reason: 'heartbeat lost',
    latencyMs: 25,
    timestamp: 1710000000000
  });

  const content = fs.readFileSync(repository.getPath(), 'utf8').trim();
  const event = JSON.parse(content);

  assert.equal(event.sessionId, 'session-a');
  assert.equal(event.verdict, 'FREEZE');
  assert.equal(event.trigger, 'HEARTBEAT_FAILURE');
  assert.equal(replayStudio.getLastVerdict(), 'FREEZE');
  assert.equal(replayStudio.countVerdict('FREEZE'), 1);

  fs.rmSync(dir, { recursive: true, force: true });
});
