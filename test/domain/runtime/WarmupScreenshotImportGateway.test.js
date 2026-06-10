'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');

const {
  WarmupScreenshotImportGateway,
} = require('../../../dist/application/runtime/WarmupScreenshotImportGateway.js');

const {
  PaperTestOperatorConsole,
} = require('../../../dist/application/runtime/PaperTestOperatorConsole.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

function rounds(size = 200) {
  return Array.from({ length: size }, (_, index) => {
    if (index % 17 === 0) return 0;
    return index % 2 === 0 ? 'P' : 'V';
  });
}

test('warmup screenshot import gateway imports extracted JSON sidecar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-warmup-screenshot-'));

  try {
    const screenshotDir = join(dir, 'screens');
    const outputDir = join(dir, 'out');
    const screenshotPath = join(screenshotDir, 'mesa.png');
    const sidecarPath = join(screenshotDir, 'mesa.extracted.json');

    await mkdir(screenshotDir, { recursive: true });
    await writeFile(screenshotPath, 'fake-image', 'utf8');
    await writeFile(sidecarPath, JSON.stringify({ rounds: rounds() }), 'utf8');

    const gateway = new WarmupScreenshotImportGateway({ screenshotDir, outputDir });
    const result = gateway.import({ screenshotPath: 'latest' });

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'WARMUP_SCREENSHOT_IMPORTED');
    assert.equal(result.value.acceptedRounds, 200);
    assert.equal(result.value.outputWarmupPath.endsWith('warmup-screenshot-imported-rounds.txt'), true);

    const warmup = await readFile(result.value.outputWarmupPath, 'utf8');
    assert.match(warmup, /P/);
    assert.match(warmup, /V/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('warmup screenshot import gateway reports extraction required when only image exists', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-warmup-screenshot-'));

  try {
    const screenshotDir = join(dir, 'screens');
    const outputDir = join(dir, 'out');
    const screenshotPath = join(screenshotDir, 'mesa.png');

    await mkdir(screenshotDir, { recursive: true });
    await writeFile(screenshotPath, 'fake-image', 'utf8');

    const gateway = new WarmupScreenshotImportGateway({ screenshotDir, outputDir });
    const result = gateway.import({ screenshotPath: 'latest' });

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'WARMUP_SCREENSHOT_NEEDS_EXTRACTION');
    assert.equal(result.value.extractionRequired, true);
    assert.match(result.value.extractorCommand, /extrator_gemini.py/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('warmup screenshot import gateway blocks undersized extraction', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-warmup-screenshot-'));

  try {
    const outputDir = join(dir, 'out');
    const gateway = new WarmupScreenshotImportGateway({ outputDir, minimumRounds: 100 });
    const result = gateway.import({ extractedPayload: JSON.stringify({ rounds: rounds(50) }) });

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'WARMUP_SCREENSHOT_BLOCKED');
    assert.equal(result.value.acceptedRounds, 50);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper test operator console imports warmup from screenshot sidecar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-console-screenshot-'));

  try {
    const ledgerFile = join(dir, 'paper-entry-ledger.jsonl');
    const screenshotDir = join(dir, 'warmup-screenshots');
    const screenshotPath = join(screenshotDir, 'mesa.png');
    const sidecarPath = join(screenshotDir, 'mesa.extracted.json');

    await mkdir(screenshotDir, { recursive: true });
    await writeFile(screenshotPath, 'fake-image', 'utf8');
    await writeFile(sidecarPath, JSON.stringify({ rounds: rounds() }), 'utf8');

    const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath: ledgerFile });
    const consoleEngine = new PaperTestOperatorConsole({
      repository,
      dataDir: dir,
      repeatSessionId: 'PAPER_TEST_001',
    });

    await consoleEngine.execute('start', 1760000010000);

    const result = await consoleEngine.execute('warmup-screenshot latest', 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.state.warmupLoaded, true);
    assert.equal(result.state.totalWarmupRounds >= 200, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('warmup screenshot import CLI prints json report', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-warmup-screenshot-cli-'));

  try {
    const screenshotDir = join(dir, 'screens');
    const outputDir = join(dir, 'out');
    const screenshotPath = join(screenshotDir, 'mesa.png');
    const sidecarPath = join(screenshotDir, 'mesa.extracted.json');

    await mkdir(screenshotDir, { recursive: true });
    await writeFile(screenshotPath, 'fake-image', 'utf8');
    await writeFile(sidecarPath, JSON.stringify({ rounds: rounds() }), 'utf8');

    const result = spawnSync(
      process.execPath,
      [
        'scripts/warmup-screenshot-import-gateway.js',
        '--screenshotDir', screenshotDir,
        '--outputDir', outputDir,
        '--screenshotPath', 'latest',
        '--format', 'json',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.report.status, 'WARMUP_SCREENSHOT_IMPORTED');
    assert.equal(parsed.report.acceptedRounds, 200);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
