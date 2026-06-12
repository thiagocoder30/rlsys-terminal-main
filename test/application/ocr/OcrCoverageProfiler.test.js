const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  OcrCoverageProfiler,
} = require('../../../dist/application/ocr/OcrCoverageProfiler.js');

test('OcrCoverageProfiler bypassa verificação se arquivo não existe (CI/CD ou manual)', () => {
  const profiler = new OcrCoverageProfiler();
  const rawPath = path.join(os.tmpdir(), 'missing-file.json');
  
  const audit = profiler.evaluate(rawPath, 50);
  
  assert.equal(audit.isApproved, true);
  assert.equal(audit.coveragePercentage, 1);
  assert.match(audit.message, /\[BYPASS\]/);
});

test('OcrCoverageProfiler reprova extrações com menos de 60% de cobertura', () => {
  const profiler = new OcrCoverageProfiler();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-test-'));
  const rawPath = path.join(tmpDir, '.extracted.json');
  
  const rawData = { rounds: Array.from({ length: 200 }, () => 0) };
  fs.writeFileSync(rawPath, JSON.stringify(rawData), 'utf8');

  const audit = profiler.evaluate(rawPath, 100);
  
  assert.equal(audit.isApproved, false);
  assert.equal(audit.coveragePercentage, 0.5);
  assert.equal(audit.discardedCount, 100);
  assert.match(audit.message, /Qualidade de imagem corrompida/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
