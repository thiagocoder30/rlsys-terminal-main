'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCertificationSnapshot,
  formatCertificationReport,
  parseArgs,
  parseNumber,
} = require('../../../install/quality/repository-certification-engine.cjs');

test('repository certification parses numeric options safely', () => {
  assert.equal(parseNumber('10', 0), 10);
  assert.equal(parseNumber('bad', 7), 7);

  const args = parseArgs([
    '--audit-json',
    'audit.json',
    '--global-test-total',
    '1354',
    '--global-test-pass',
    '1354',
    '--global-test-fail',
    '0',
    '--old-global-test-baseline',
    '1349',
  ]);

  assert.equal(args.auditJsonPath, 'audit.json');
  assert.equal(args.globalTestTotal, 1354);
  assert.equal(args.globalTestPass, 1354);
  assert.equal(args.globalTestFail, 0);
  assert.equal(args.oldGlobalTestBaseline, 1349);
});

test('current repository certification snapshot becomes paper platform ready candidate', () => {
  const snapshot = createCertificationSnapshot(process.cwd(), {
    auditJsonPath: 'artifacts/dependency-governance/sprint-250-npm-audit.json',
    globalTestTotal: 1349,
    globalTestPass: 1349,
    globalTestFail: 0,
    oldGlobalTestBaseline: 1349,
  });

  assert.equal(snapshot.status, 'CERTIFIED');
  assert.equal(snapshot.repositoryCertified, true);
  assert.equal(snapshot.paperPlatformReadyCandidate, true);
  assert.equal(snapshot.productionMoneyAllowed, false);
  assert.equal(snapshot.liveMoneyAuthorization, false);
  assert.equal(snapshot.automaticExecutionAllowed, false);
  assert.equal(snapshot.automaticSuggestionAllowed, true);
  assert.equal(snapshot.automaticBetExecutionAllowed, false);
  assert.equal(snapshot.humanSupervisionRequired, true);
  assert.equal(snapshot.failedCheckCount, 0);
});

test('repository certification report is audit friendly', () => {
  const snapshot = createCertificationSnapshot(process.cwd(), {
    auditJsonPath: 'artifacts/dependency-governance/sprint-250-npm-audit.json',
    globalTestTotal: 1349,
    globalTestPass: 1349,
    globalTestFail: 0,
    oldGlobalTestBaseline: 1349,
  });

  const report = formatCertificationReport(snapshot);

  assert.match(report, /RL\.SYS CORE Repository Certification Report/);
  assert.match(report, /RepositoryCertified: true/);
  assert.match(report, /PaperPlatformReadyCandidate: true/);
  assert.match(report, /AutomaticSuggestionAllowed: true/);
  assert.match(report, /AutomaticBetExecutionAllowed: false/);
});

test('repository certification fails when global tests fail', () => {
  const snapshot = createCertificationSnapshot(process.cwd(), {
    auditJsonPath: 'artifacts/dependency-governance/sprint-250-npm-audit.json',
    globalTestTotal: 1349,
    globalTestPass: 1348,
    globalTestFail: 1,
    oldGlobalTestBaseline: 1349,
  });

  assert.equal(snapshot.repositoryCertified, false);
  assert.equal(snapshot.paperPlatformReadyCandidate, false);
  assert.ok(snapshot.failedChecks.some((check) => check.name === 'GlobalTests'));
});
