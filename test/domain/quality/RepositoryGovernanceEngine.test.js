'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  collectTrackedGeneratedFiles,
  createGovernanceSnapshot,
  formatGovernanceReport,
  isTrackedGeneratedFile,
} = require('../../../install/quality/repository-governance-engine.cjs');

test('repository governance identifies generated runtime files deterministically', () => {
  assert.equal(isTrackedGeneratedFile('logs/runtime.log'), true);
  assert.equal(isTrackedGeneratedFile('dist/index.js'), true);
  assert.equal(isTrackedGeneratedFile('data/session/current.json'), true);
  assert.equal(isTrackedGeneratedFile('src/domain/session/PaperSessionSupervisorV2.js'), false);
  assert.deepEqual(
    collectTrackedGeneratedFiles([
      'src/index.js',
      'logs/a.log',
      'coverage/out.json',
      'test/domain/quality/RepositoryGovernanceEngine.test.js',
    ]),
    ['logs/a.log', 'coverage/out.json']
  );
});

test('repository governance snapshot passes after repository professionalization', () => {
  const snapshot = createGovernanceSnapshot(process.cwd());

  assert.equal(snapshot.paperOnly, true);
  assert.equal(snapshot.productionMoneyAllowed, false);
  assert.equal(snapshot.liveMoneyAuthorization, false);
  assert.equal(snapshot.automaticExecutionAllowed, false);
  assert.equal(snapshot.humanSupervisionRequired, true);
  assert.equal(snapshot.trackedGeneratedFileCount, 0);
  assert.equal(snapshot.nestedLegacyTestCount, 0);
  assert.equal(snapshot.missingRequiredFileCount, 0);
  assert.equal(snapshot.status, 'PASS');
  assert.equal(snapshot.repositoryGovernanceScore, 100);
});

test('repository governance report is human-readable and audit friendly', () => {
  const snapshot = createGovernanceSnapshot(process.cwd());
  const report = formatGovernanceReport(snapshot);

  assert.match(report, /RL\.SYS CORE Repository Governance Report/);
  assert.match(report, /Status: PASS/);
  assert.match(report, /RepositoryGovernanceScore: 100/);
  assert.match(report, /PaperOnly: true/);
  assert.match(report, /LiveMoneyAuthorization: false/);
});
