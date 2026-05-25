'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { recoverPaperRuntimeSnapshot, classify } = require('../scripts/paper-runtime-snapshot-recovery');

function snapshotPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-s103-'));
  return path.join(dir, 'session-snapshot.json');
}

test('classifies abrupt running recovery', () => {
  assert.equal(classify('RUNNING', false), 'ABRUPT_RUNNING');
});

test('recovers running snapshot as paused', () => {
  const file = snapshotPath();

  fs.writeFileSync(file, JSON.stringify({
    sessionId: 's103',
    state: 'RUNNING',
    gracefulShutdown: false
  }));

  process.env.RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH = file;
  const result = recoverPaperRuntimeSnapshot();
  delete process.env.RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH;

  const restored = JSON.parse(fs.readFileSync(file, 'utf8'));

  assert.equal(result.recovered, true);
  assert.equal(result.decision, 'ABRUPT_RUNNING');
  assert.equal(result.action, 'RESTORE_AS_PAUSED');
  assert.equal(restored.state, 'PAUSED');
  assert.equal(restored.recovery.requiresHumanConfirmation, true);
});
