const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const {
  JsonLinesReplayRepository,
} = require('../dist/infrastructure/replay');

test('JsonLinesReplayRepository resolves directory path to session-replay JSONL file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-replay-'));

  try {
    const repo = new JsonLinesReplayRepository(dir);
    assert.match(repo.getPath(), /session-replay\.jsonl$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('JsonLinesReplayRepository preserves explicit JSONL file path', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-replay-'));
  const file = join(dir, 'custom-replay.jsonl');

  try {
    const repo = new JsonLinesReplayRepository(file);
    assert.equal(repo.getPath(), file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('JsonLinesReplayRepository appends canonical replay events as JSONL', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-replay-'));

  try {
    const repo = new JsonLinesReplayRepository(dir);

    const result = await repo.append({
      eventId: 'evt-1',
      sessionId: 'session-1',
      sequence: 1,
      timestampEpochMs: 1000,
      verdict: 'NO_GO',
      trigger: 'SNAPSHOT_REVIEW',
      reason: 'snapshot under review',
      latencyMs: 12,
    });

    assert.equal(result.accepted, true);

    const content = await readFile(repo.getPath(), 'utf8');
    const lines = content.trim().split('\n');

    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]).eventId, 'evt-1');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('JsonLinesReplayRepository accepts legacy replay-like event without eventId', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-replay-'));

  try {
    const repo = new JsonLinesReplayRepository(dir);

    const result = await repo.persist({
      sessionId: 'legacy-session',
      sequence: 7,
      timestampEpochMs: 2000,
      state: 'FREEZE',
      trigger: 'EVENT_LOOP_LAG',
      message: 'legacy replay event',
      latencyMs: 44,
    });

    assert.equal(result.accepted, true);

    const content = await readFile(repo.getPath(), 'utf8');
    const event = JSON.parse(content.trim());

    assert.equal(event.sessionId, 'legacy-session');
    assert.equal(event.verdict, 'FREEZE');
    assert.equal(event.reason, 'legacy replay event');
    assert.ok(event.eventId.length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('JsonLinesReplayRepository exposes compatible append aliases', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-replay-'));

  try {
    const repo = new JsonLinesReplayRepository(dir);

    const first = await repo.appendEvent({
      eventId: 'evt-alias-1',
      sessionId: 'session-alias',
      sequence: 1,
      timestampEpochMs: 3000,
      verdict: 'REVIEW',
      trigger: 'ALIAS',
      reason: 'appendEvent alias',
      latencyMs: 1,
    });

    const second = await repo.record({
      eventId: 'evt-alias-2',
      sessionId: 'session-alias',
      sequence: 2,
      timestampEpochMs: 3001,
      verdict: 'NO_GO',
      trigger: 'ALIAS',
      reason: 'record alias',
      latencyMs: 1,
    });

    assert.equal(first.accepted, true);
    assert.equal(second.accepted, true);

    const lines = (await readFile(repo.getPath(), 'utf8')).trim().split('\n');
    assert.equal(lines.length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('JsonLinesReplayRepository is idempotent per process for same eventId', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-replay-'));

  try {
    const repo = new JsonLinesReplayRepository(dir);
    const event = {
      eventId: 'evt-dup',
      sessionId: 'session-1',
      sequence: 1,
      timestampEpochMs: 1000,
      verdict: 'FREEZE',
      trigger: 'EVENT_LOOP_LAG',
      reason: 'runtime freeze',
      latencyMs: 20,
    };

    await repo.append(event);
    const second = await repo.append(event);

    const content = await readFile(repo.getPath(), 'utf8');
    const lines = content.trim().split('\n');

    assert.equal(second.accepted, true);
    assert.match(second.reason, /already persisted/);
    assert.equal(lines.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
