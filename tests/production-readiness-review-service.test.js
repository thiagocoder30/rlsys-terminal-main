'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  computeReadinessScore,
  classifyReadiness,
  writeProductionReadinessReview
} = require('../scripts/production-readiness-review-service');

test('computeReadinessScore computes integer percentage', () => {
  assert.equal(
    computeReadinessScore([
      { passed: true },
      { passed: true },
      { passed: false },
      { passed: true }
    ]),
    75
  );
});

test('classifyReadiness blocks critical failures', () => {
  assert.equal(
    classifyReadiness(100, true),
    'BLOCKED'
  );

  assert.equal(
    classifyReadiness(95, false),
    'PAPER_READY'
  );

  assert.equal(
    classifyReadiness(80, false),
    'NEEDS_REVIEW'
  );
});

test('writeProductionReadinessReview writes defensive review', () => {
  const dir =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'rlsys-readiness-'
      )
    );

  const outputPath =
    path.join(
      dir,
      'production-readiness-review.json'
    );

  process.env.RLSYS_PRODUCTION_READINESS_REVIEW_PATH =
    outputPath;

  const result =
    writeProductionReadinessReview();

  delete process.env.RLSYS_PRODUCTION_READINESS_REVIEW_PATH;

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(result.review.decision.productionMoneyAllowed, false);
  assert.equal(result.review.decision.liveOperationAllowed, false);
  assert.equal(result.review.decision.requiresHumanReview, true);
});
