const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const {
  StreamingRuntimeJournalQueryEngine,
} = require('../dist/application/journal');

function event(id, type, verdict, lifecycleState) {
  return JSON.stringify({
    eventId: id,
    sessionId: 'session-1',
    sequence: Number(id.replace('event-', '')),
    timestampEpochMs: 1000,
    type,
    lifecycleState,
    verdict,
    reason: 'test event',
    payload: { id },
  });
}

test('StreamingRuntimeJournalQueryEngine filters journal by type without loading full file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-journal-query-'));
  const file = join(dir, 'runtime-session.jsonl');

  try {
    await writeFile(file, [
      event('event-1', 'COMMAND', 'NO_GO', 'NO_GO'),
      event('event-2', 'HUD', 'REVIEW', 'REVIEW'),
      event('event-3', 'HUD', 'NO_GO', 'NO_GO'),
    ].join('\n'));

    const engine = new StreamingRuntimeJournalQueryEngine();
    const result = await engine.query(file, {
      type: 'HUD',
      limit: 10,
    });

    assert.equal(result.events.length, 2);
    assert.equal(result.summary.scannedLines, 3);
    assert.equal(result.summary.parsedEvents, 3);
    assert.equal(result.summary.matchedEvents, 2);
    assert.equal(result.summary.invalidLines, 0);
    assert.equal(result.summary.truncated, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('StreamingRuntimeJournalQueryEngine applies strict result limit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-journal-query-'));
  const file = join(dir, 'runtime-session.jsonl');

  try {
    await writeFile(file, [
      event('event-1', 'HUD', 'NO_GO', 'NO_GO'),
      event('event-2', 'HUD', 'NO_GO', 'NO_GO'),
      event('event-3', 'HUD', 'NO_GO', 'NO_GO'),
    ].join('\n'));

    const engine = new StreamingRuntimeJournalQueryEngine();
    const result = await engine.query(file, {
      type: 'HUD',
      limit: 2,
    });

    assert.equal(result.events.length, 2);
    assert.equal(result.summary.matchedEvents, 3);
    assert.equal(result.summary.truncated, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('StreamingRuntimeJournalQueryEngine tolerates invalid JSONL lines', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-journal-query-'));
  const file = join(dir, 'runtime-session.jsonl');

  try {
    await writeFile(file, [
      event('event-1', 'COMMAND', 'NO_GO', 'NO_GO'),
      '{invalid-json',
      event('event-2', 'SHUTDOWN', 'SHUTDOWN', 'SHUTDOWN'),
    ].join('\n'));

    const engine = new StreamingRuntimeJournalQueryEngine();
    const result = await engine.query(file, {
      limit: 10,
    });

    assert.equal(result.events.length, 2);
    assert.equal(result.summary.invalidLines, 1);
    assert.equal(result.summary.parsedEvents, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('StreamingRuntimeJournalQueryEngine filters by verdict and lifecycle state', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-journal-query-'));
  const file = join(dir, 'runtime-session.jsonl');

  try {
    await writeFile(file, [
      event('event-1', 'STATE_TRANSITION', 'NO_GO', 'NO_GO'),
      event('event-2', 'STATE_TRANSITION', 'FREEZE', 'FREEZE'),
      event('event-3', 'STATE_TRANSITION', 'FREEZE', 'REVIEW'),
    ].join('\n'));

    const engine = new StreamingRuntimeJournalQueryEngine();
    const result = await engine.query(file, {
      verdict: 'FREEZE',
      lifecycleState: 'FREEZE',
      limit: 10,
    });

    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].eventId, 'event-2');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
