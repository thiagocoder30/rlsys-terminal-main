const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const {
  JsonLinesRuntimeSessionJournalRepository,
} = require('../dist/infrastructure/journal');

test('JsonLinesRuntimeSessionJournalRepository appends journal event as JSONL', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-journal-'));

  try {
    const repo = new JsonLinesRuntimeSessionJournalRepository(dir);

    const result = await repo.append({
      eventId: 'journal-1',
      sessionId: 'session-1',
      sequence: 1,
      timestampEpochMs: 1000,
      type: 'COMMAND',
      lifecycleState: 'NO_GO',
      verdict: 'NO_GO',
      reason: 'operator entered round',
      payload: { command: '17' },
    });

    assert.equal(result.accepted, true);
    assert.match(repo.getPath(), /runtime-session\.jsonl$/);

    const content = await readFile(repo.getPath(), 'utf8');
    const event = JSON.parse(content.trim());

    assert.equal(event.eventId, 'journal-1');
    assert.equal(event.payload.command, '17');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('JsonLinesRuntimeSessionJournalRepository is idempotent per process', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-journal-'));

  try {
    const repo = new JsonLinesRuntimeSessionJournalRepository(dir);
    const event = {
      eventId: 'journal-dup',
      sessionId: 'session-1',
      sequence: 1,
      timestampEpochMs: 1000,
      type: 'HUD',
      lifecycleState: 'REVIEW',
      verdict: 'REVIEW',
      reason: 'hud rendered',
      payload: { runtimeStatus: 'DEGRADED' },
    };

    await repo.append(event);
    const second = await repo.append(event);

    const lines = (await readFile(repo.getPath(), 'utf8')).trim().split('\n');

    assert.equal(second.accepted, true);
    assert.match(second.reason, /already persisted/);
    assert.equal(lines.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('JsonLinesRuntimeSessionJournalRepository rejects invalid events', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-journal-'));

  try {
    const repo = new JsonLinesRuntimeSessionJournalRepository(dir);

    const result = await repo.append({
      eventId: '',
      sessionId: 'session-1',
      sequence: 1,
      timestampEpochMs: 1000,
      type: 'ERROR',
      lifecycleState: 'BLOCKED',
      verdict: 'BLOCKED',
      reason: 'invalid event',
      payload: {},
    });

    assert.equal(result.accepted, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
