'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  PaperTestOperatorConsole,
} = require('../../../dist/application/runtime/PaperTestOperatorConsole.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

async function tempConsole() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-operator-console-'));
  const ledgerFile = join(dir, 'paper-entry-ledger.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath: ledgerFile });
  const consoleEngine = new PaperTestOperatorConsole({
    repository,
    dataDir: dir,
    repeatSessionId: 'PAPER_TEST_001',
  });

  return { dir, ledgerFile, consoleEngine };
}

function warmupPayload(size = 200) {
  return Array.from({ length: size }, (_, index) => {
    if (index % 11 === 0) return '0';
    return index % 2 === 0 ? 'P' : 'V';
  }).join(',');
}

test('paper test operator console supports full paper flow', async () => {
  const { dir, consoleEngine } = await tempConsole();

  try {
    const started = await consoleEngine.execute('start', 1760000010000);
    assert.equal(started.ok, true);
    assert.equal(started.state.started, true);

    const warmup = await consoleEngine.execute(`warmup-paste ${warmupPayload()}`, 1760000010000);
    assert.equal(warmup.ok, true);
    assert.equal(warmup.state.warmupLoaded, true);
    assert.equal(warmup.state.totalWarmupRounds, 200);

    const qualified = await consoleEngine.execute('qualify', 1760000010000);
    assert.equal(qualified.ok, true);
    assert.equal(qualified.state.warmupQualified, true);

    const round = await consoleEngine.execute('round P', 1760000010000);
    assert.equal(round.ok, true);
    assert.equal(round.state.liveRounds.length, 1);

    const suggestion = await consoleEngine.execute('suggestion', 1760000010000);
    assert.equal(suggestion.ok, true);
    assert.match(suggestion.message, /Recommendation: AGUARDAR/);
    assert.match(suggestion.message, /LiveMoneyAuthorization: false/);

    const confirm = await consoleEngine.execute('confirm', 1760000010000);
    assert.equal(confirm.ok, true);
    assert.equal(confirm.state.confirms, 1);

    const win = await consoleEngine.execute('win', 1760000010000);
    assert.equal(win.ok, true);
    assert.equal(win.state.wins, 1);

    const finish = await consoleEngine.execute('finish', 1760000010000);
    assert.equal(finish.ok, true);
    assert.equal(finish.state.finished, true);

    const certify = await consoleEngine.execute('certify', 1760000010000);
    assert.equal(certify.ok, true);
    assert.equal(certify.state.certified, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper test operator console supports warmup file', async () => {
  const { dir, consoleEngine } = await tempConsole();

  try {
    const filePath = join(dir, 'warmup.txt');
    await writeFile(filePath, warmupPayload(), 'utf8');

    await consoleEngine.execute('start', 1760000010000);

    const result = await consoleEngine.execute(`warmup-file ${filePath}`, 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.state.warmupLoaded, true);
    assert.equal(result.state.totalWarmupRounds, 200);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper test operator console blocks round before warmup qualification', async () => {
  const { dir, consoleEngine } = await tempConsole();

  try {
    await consoleEngine.execute('start', 1760000010000);

    const result = await consoleEngine.execute('round P', 1760000010000);

    assert.equal(result.ok, false);
    assert.match(result.error.message, /Qualify warmup/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper test operator console rejects undersized warmup', async () => {
  const { dir, consoleEngine } = await tempConsole();

  try {
    await consoleEngine.execute('start', 1760000010000);

    const result = await consoleEngine.execute(`warmup-paste ${warmupPayload(99)}`, 1760000010000);

    assert.equal(result.ok, false);
    assert.match(result.error.message, /at least 100/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper test operator console help is self explanatory and governance safe', async () => {
  const { dir, consoleEngine } = await tempConsole();

  try {
    const result = await consoleEngine.execute('help', 1760000010000);

    assert.equal(result.ok, true);
    assert.match(result.message, /warmup-file/);
    assert.match(result.message, /round/);
    assert.match(result.message, /certify/);
    assert.match(result.message, /LiveMoneyAuthorization=false/);
    assert.match(result.message, /AutomaticBetExecutionAllowed=false/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper test operator console CLI starts and exits', async () => {
  const { dir, ledgerFile } = await tempConsole();

  try {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/paper-test-operator-console.js',
        '--ledgerFile', ledgerFile,
        '--repeatSessionId', 'PAPER_TEST_001',
      ],
      {
        cwd: process.cwd(),
        input: 'help\nexit\n',
        encoding: 'utf8',
      },
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /PAPER TEST OPERATOR CONSOLE/);
    assert.match(result.stdout, /warmup-file/);
    assert.match(result.stdout, /Paper Test Operator Console closed/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
