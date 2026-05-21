const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { RuntimeSessionReporter } = require('../dist/application/reporting');

function event(id, sessionId, type, verdict, lifecycleState) {
  return JSON.stringify({
    eventId: id,
    sessionId,
    sequence: Number(id.replace('event-', '')) || 1,
    timestampEpochMs: 1000,
    type,
    lifecycleState,
    verdict,
    reason: 'test event',
    payload: { id },
  });
}

test('RuntimeSessionReporter generates markdown summary for a session', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-report-'));
  const file = join(dir, 'runtime-session.jsonl');

  try {
    await writeFile(file, [
      event('event-1', 'session-1', 'COMMAND', 'NO_GO', 'NO_GO'),
      event('event-2', 'session-1', 'STATE_TRANSITION', 'NO_GO', 'NO_GO'),
      event('event-3', 'session-1', 'HUD', 'NO_GO', 'NO_GO'),
      event('event-4', 'other-session', 'HUD', 'FREEZE', 'FREEZE'),
    ].join('\n'));

    const reporter = new RuntimeSessionReporter();
    const report = await reporter.report({
      journalPath: file,
      sessionId: 'session-1',
      limit: 100,
    });

    assert.equal(report.summary.commandCount, 1);
    assert.equal(report.summary.transitionCount, 1);
    assert.equal(report.summary.hudCount, 1);
    assert.equal(report.summary.matchedEvents, 3);
    assert.match(report.markdown, /Runtime Session Report/);
    assert.match(report.markdown, /Session remained/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('RuntimeSessionReporter marks freeze sessions for review', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-report-'));
  const file = join(dir, 'runtime-session.jsonl');

  try {
    await writeFile(file, [
      event('event-1', 'session-1', 'COMMAND', 'NO_GO', 'NO_GO'),
      event('event-2', 'session-1', 'STATE_TRANSITION', 'FREEZE', 'FREEZE'),
      event('event-3', 'session-1', 'HUD', 'FREEZE', 'FREEZE'),
    ].join('\n'));

    const reporter = new RuntimeSessionReporter();
    const report = await reporter.report({
      journalPath: file,
      sessionId: 'session-1',
      limit: 100,
    });

    assert.equal(report.summary.freezeCount, 2);
    assert.match(report.markdown, /requires institutional review/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('RuntimeSessionReporter reports truncation when safety limit is reached', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-report-'));
  const file = join(dir, 'runtime-session.jsonl');

  try {
    await writeFile(file, [
      event('event-1', 'session-1', 'HUD', 'NO_GO', 'NO_GO'),
      event('event-2', 'session-1', 'HUD', 'NO_GO', 'NO_GO'),
      event('event-3', 'session-1', 'HUD', 'NO_GO', 'NO_GO'),
    ].join('\n'));

    const reporter = new RuntimeSessionReporter();
    const report = await reporter.report({
      journalPath: file,
      sessionId: 'session-1',
      limit: 2,
    });

    assert.equal(report.summary.truncated, true);
    assert.equal(report.summary.hudCount, 2);
    assert.match(report.markdown, /Report truncated/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
