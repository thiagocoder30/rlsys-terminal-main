const assert = require('node:assert/strict');
const test = require('node:test');
const { mkdtemp, writeFile, readFile, rm, mkdir } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  WarmupGeminiExtractorIntegration,
} = require('../../../dist/application/runtime/WarmupGeminiExtractorIntegration.js');

test('WarmupGeminiExtractorIntegration importa sidecar numérico', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-gemini-sidecar-'));

  try {
    const image = join(dir, 'Screenshot.jpg');
    const sidecar = join(dir, 'Screenshot.extracted.json');
    const output = join(dir, 'warmup-screenshot-imported-rounds.txt');

    await writeFile(image, 'image', 'utf8');
    await writeFile(sidecar, JSON.stringify({ rounds: Array.from({ length: 120 }, (_, i) => i % 37) }), 'utf8');

    const result = new WarmupGeminiExtractorIntegration().importLatest({ repoRoot: dir, screenshotDir: dir, minRounds: 100 });

    assert.equal(result.ok, true);
    assert.equal(result.roundCount, 120);

    const imported = await readFile(output, 'utf8');
    assert.equal(imported.split(',').length, 120);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('WarmupGeminiExtractorIntegration importa string multi-números sem zeros falsos', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-gemini-sidecar-string-'));

  try {
    const image = join(dir, 'Screenshot.jpg');
    const sidecar = join(dir, 'Screenshot.extracted.json');

    await writeFile(image, 'image', 'utf8');
    await writeFile(sidecar, JSON.stringify({
      rounds: [Array.from({ length: 130 }, (_, i) => String(i % 37)).join(' ')],
    }), 'utf8');

    const result = new WarmupGeminiExtractorIntegration().importLatest({ repoRoot: dir, screenshotDir: dir, minRounds: 100 });

    assert.equal(result.ok, true);
    assert.equal(result.roundCount, 130);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('WarmupGeminiExtractorIntegration não converte string vazia em zero', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-gemini-empty-string-'));

  try {
    const image = join(dir, 'Screenshot.jpg');
    const sidecar = join(dir, 'Screenshot.extracted.json');

    await writeFile(image, 'image', 'utf8');
    await writeFile(sidecar, JSON.stringify({ rounds: ['1 2 3', '', '   ', '4,5'] }), 'utf8');

    const result = new WarmupGeminiExtractorIntegration().importLatest({ repoRoot: dir, screenshotDir: dir, minRounds: 1 });

    assert.equal(result.ok, true);
    assert.equal(result.roundCount, 5);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('WarmupGeminiExtractorIntegration usa scripts/extrator_gemini.py', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'rlsys-gemini-repo-'));
  const shots = join(repo, 'data/paper-runtime/warmup-screenshots');
  const scripts = join(repo, 'scripts');

  try {
    await mkdir(shots, { recursive: true });
    await mkdir(scripts, { recursive: true });

    const image = join(shots, 'Screenshot.jpg');
    const extractor = join(scripts, 'extrator_gemini.py');

    await writeFile(image, 'image', 'utf8');
    await writeFile(extractor, [
      'import json, sys',
      'sidecar = sys.argv[2]',
      'rounds = [i % 37 for i in range(130)]',
      'open(sidecar, "w").write(json.dumps({"rounds": rounds}))',
    ].join('\n'), 'utf8');

    const result = new WarmupGeminiExtractorIntegration().importLatest({ repoRoot: repo, screenshotDir: shots, minRounds: 100 });

    assert.equal(result.ok, true);
    assert.equal(result.status, 'EXTRACTED_BY_GEMINI');
    assert.equal(result.roundCount, 130);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
