#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = process.cwd();
const screenshotDir = process.argv[2] || path.join(repoRoot, 'data/paper-runtime/warmup-screenshots');

function normalizeRounds(values) {
  if (!Array.isArray(values)) return [];
  return values
    .flatMap((value) => String(value).split(/[^0-9]+/u).filter((part) => part.trim().length > 0).map(Number))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 36);
}

const images = fs.existsSync(screenshotDir)
  ? fs.readdirSync(screenshotDir)
    .filter((entry) => ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(screenshotDir, entry))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
  : [];

if (images.length === 0) {
  console.error(`NO_IMAGE_FOUND ${screenshotDir}`);
  process.exit(2);
}

const image = images[0];
const sidecar = path.join(path.dirname(image), `${path.basename(image, path.extname(image))}.extracted.json`);
const output = path.join(path.dirname(image), 'warmup-screenshot-imported-rounds.txt');

if (fs.existsSync(sidecar)) {
  const parsed = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
  const roundsRaw = Array.isArray(parsed) ? parsed : parsed.rounds;
  const rounds = normalizeRounds(roundsRaw);
  fs.writeFileSync(output, rounds.join(','), 'utf8');
  console.log(`SIDECAR_IMPORTED image=${image} rounds=${rounds.length} output=${output}`);
  process.exit(0);
}

const extractor = [process.env.RLSYS_GEMINI_EXTRACTOR_PATH, path.join(repoRoot, 'scripts', 'extrator_gemini.py'), path.join(repoRoot, 'extrator_gemini.py')]
  .filter(Boolean)
  .find((candidate) => fs.existsSync(candidate));

if (!extractor) {
  console.error(`EXTRATOR_GEMINI_NOT_FOUND image=${image}`);
  process.exit(3);
}

const proc = spawnSync('python3', [extractor, image, sidecar], { encoding: 'utf8' });

if (proc.status === 0 && fs.existsSync(sidecar)) {
  const parsed = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
  const roundsRaw = Array.isArray(parsed) ? parsed : parsed.rounds;
  const rounds = normalizeRounds(roundsRaw);
  fs.writeFileSync(output, rounds.join(','), 'utf8');
  console.log(`OK image=${image} rounds=${rounds.length} sidecar=${sidecar}`);
  process.exit(0);
}

console.error(`EXTRATOR_GEMINI_FAILED image=${image} extractor=${extractor}`);
console.error(proc.stdout || '');
console.error(proc.stderr || '');
process.exit(4);
