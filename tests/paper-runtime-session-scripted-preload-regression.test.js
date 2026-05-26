'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function runPaperRuntime(input) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-s109-v5-'));

  const result = spawnSync(process.execPath, ['scripts/paper-runtime-session.js'], {
    cwd: path.join(__dirname, '..'),
    input,
    encoding: 'utf8',
    timeout: 60000, // FIX: Timeout aumentado de 5s para 60s para suportar ambiente Proot
    env: {
      ...process.env,
      RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH: path.join(dir, 'session-snapshot.json'),
      RLSYS_PAPER_RUNTIME_LEDGER_PATH: path.join(dir, 'paper-ledger.json'),
      RLSYS_PAPER_RUNTIME_DISCIPLINE_PATH: path.join(dir, 'operator-discipline.json'),
    },
  });

  return {
    dir,
    result,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

test('scripted paper runtime preserves ledger command preloads', () => {
  const { dir, result, output } = runPaperRuntime('win 10\nloss 3\nledger\nbankroll\nexit\n');

  assert.equal(result.status, 0, output);
  assert.equal(result.signal, null, output);
  assert.match(output, /Ledger recorded: WIN 10/);
  assert.match(output, /Ledger recorded: LOSS 3/);
  assert.match(output, /RL.SYS PAPER LEDGER/);
  assert.match(output, /balance: 7/);

  const ledger = JSON.parse(fs.readFileSync(path.join(dir, 'paper-ledger.json'), 'utf8'));
  assert.equal(ledger.summary.wins, 1);
  assert.equal(ledger.summary.losses, 1);
  assert.equal(ledger.summary.balance, 7);
});

test('scripted paper runtime preserves operator discipline preloads', () => {
  const { dir, result, output } = runPaperRuntime('loss 1\nloss 1\nresume\nexit\n');

  assert.equal(result.status, 0, output);
  assert.equal(result.signal, null, output);
  assert.match(output, /discipline block: UNSAFE_RESUME_AFTER_LOSSES/);

  const discipline = JSON.parse(fs.readFileSync(path.join(dir, 'operator-discipline.json'), 'utf8'));
  assert.equal(discipline.lock.active, true);
});

test('scripted paper runtime exits deterministically and tolerates incompatible snapshot notice', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-s109-v5-bad-snapshot-'));
  const snapshotPath = path.join(dir, 'session-snapshot.json');

  fs.writeFileSync(snapshotPath, JSON.stringify({
    schemaVersion: 'legacy-invalid',
    sessionState: 'RUNNING',
  }));

  const result = spawnSync(process.execPath, ['scripts/paper-runtime-session.js'], {
    cwd: path.join(__dirname, '..'),
    input: 'prepare\nstart\nfinish\nexit\n',
    encoding: 'utf8',
    timeout: 60000, // FIX: Timeout aumentado para 60s
    env: {
      ...process.env,
      RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH: snapshotPath,
      RLSYS_PAPER_RUNTIME_LEDGER_PATH: path.join(dir, 'paper-ledger.json'),
      RLSYS_PAPER_RUNTIME_DISCIPLINE_PATH: path.join(dir, 'operator-discipline.json'),
    },
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;

  assert.equal(result.status, 0, output);
  assert.equal(result.signal, null, output);
  assert.match(output, /snapshot/i);
  assert.match(output, /PAPER READY/);
  assert.match(output, /SESSION_STARTED/);
  assert.match(output, /SESSION_FINISHED/);
  assert.match(output, /RL.SYS paper runtime session closed./);
});
