'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  WarmupQualificationRuntimePipeline,
} = require('../dist/application/warmup/WarmupQualificationRuntimePipeline');

function balancedWarmup(size) {
  return Array.from({ length: size }, (_, index) => index % 37);
}

test('WarmupQualificationRuntimePipeline qualifies complete manual 200-round warmup without opening money gates', () => {
  const pipeline = new WarmupQualificationRuntimePipeline();

  const report = pipeline.qualify({
    source: 'manual',
    requiredWarmupSize: 200,
    values: balancedWarmup(200),
  });

  assert.equal(report.service, 'WarmupQualificationRuntimePipeline');
  assert.equal(report.schemaVersion, '1.0.0');
  assert.equal(report.status, 'QUALIFIED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.decision.liveMoneyAllowed, false);
  assert.equal(report.decision.productionMoneyAllowed, false);
  assert.equal(report.decision.requiresHumanReview, true);
  assert.equal(report.extraction.accepted, 200);
  assert.equal(report.warmup.sample.used, 200);
});

test('WarmupQualificationRuntimePipeline blocks incomplete warmup defensively', () => {
  const pipeline = new WarmupQualificationRuntimePipeline();

  const report = pipeline.qualify({
    source: 'manual',
    requiredWarmupSize: 200,
    values: balancedWarmup(70),
  });

  assert.equal(report.status, 'BLOCKED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.decision.supervisedOperationAllowed, false);
  assert.equal(report.decision.productionMoneyAllowed, false);
});

test('WarmupQualificationRuntimePipeline supports vision raw payload using real normalizer', () => {
  const pipeline = new WarmupQualificationRuntimePipeline();

  const report = pipeline.qualify({
    source: 'vision',
    requiredWarmupSize: 200,
    visionRaw: JSON.stringify({
      total: 200,
      sequencia: balancedWarmup(200),
    }),
  });

  assert.equal(report.source, 'vision');
  assert.equal(report.extraction.accepted, 200);
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.decision.productionMoneyAllowed, false);
});

test('warmup qualification cli writes report and keeps live money blocked', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-warmup-qualification-'));
  const outputPath = path.join(dir, 'warmup-qualification-report.json');

  const result = spawnSync(process.execPath, ['scripts/warmup-qualification-runtime.js'], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: {
      ...process.env,
      RLSYS_WARMUP_QUALIFICATION_REPORT_PATH: outputPath,
    },
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;

  assert.equal(result.status, 0, output);
  assert.match(output, /RL\.SYS CORE WARMUP QUALIFICATION RUNTIME/);
  assert.match(output, /productionMoneyAllowed: false/);
  assert.equal(fs.existsSync(outputPath), true);

  const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(report.decision.liveMoneyAllowed, false);
});
