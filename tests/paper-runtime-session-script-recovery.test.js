'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('paper runtime session reports recovery decision for interrupted running snapshot', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-s103-session-'));
  const snapshot = path.join(dir, 'session-snapshot.json');

  fs.writeFileSync(snapshot, JSON.stringify({
    sessionId: 'session-recovery-test',
    state: 'RUNNING',
    gracefulShutdown: false
  }));

  const result = spawnSync(process.execPath, ['scripts/paper-runtime-session.js'], {
    cwd: path.join(__dirname, '..'),
    input: 'exit\n',
    encoding: 'utf8',
    env: {
      ...process.env,
      RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH: snapshot
    }
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;

  assert.equal(result.status, 0, output);
  assert.match(output, /Recovery decision: ABRUPT_RUNNING/);
  assert.match(output, /Recovery action: RESTORE_AS_PAUSED/);
  assert.match(output, /RL\.SYS PAPER RUNTIME SESSION/);
});
