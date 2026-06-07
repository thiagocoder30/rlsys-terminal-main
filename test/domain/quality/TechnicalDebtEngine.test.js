'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  analyzeTextDebt,
  clampScore,
  collectFiles,
  createTechnicalDebtSnapshot,
  formatTechnicalDebtReport,
} = require('../../../install/quality/technical-debt-engine.cjs');

function createFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-debt-'));

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  return root;
}

test('technical debt engine collects governed files iteratively', () => {
  const root = createFixture({
    'src/domain/A.js': 'module.exports = {};\n',
    'src/domain/nested/B.js': 'module.exports = {};\n',
    'docs/archive/ignored/C.js': 'module.exports = {};\n',
  });

  const files = collectFiles(root, ['src', 'docs'], (file) => file.endsWith('.js'));

  assert.deepEqual(files, ['src/domain/A.js', 'src/domain/nested/B.js']);
});

test('technical debt engine detects text debt signals', () => {
  const root = createFixture({
    'src/domain/A.js': `console.log('debug');\n// TODO improve\n${'x'.repeat(181)}\n`,
  });

  const debt = analyzeTextDebt(root, ['src/domain/A.js']);

  assert.equal(debt.todoCount, 1);
  assert.equal(debt.longLineCount, 1);
  assert.equal(debt.consoleUsageCount, 1);
});

test('technical debt engine clamps scores safely', () => {
  assert.equal(clampScore(120), 100);
  assert.equal(clampScore(-10), 0);
  assert.equal(clampScore(91.4), 91);
});

test('current repository technical debt snapshot is certification-ready enough to audit', () => {
  const snapshot = createTechnicalDebtSnapshot(process.cwd());

  assert.equal(snapshot.status, 'PASS');
  assert.equal(snapshot.paperOnly, true);
  assert.equal(snapshot.productionMoneyAllowed, false);
  assert.equal(snapshot.liveMoneyAuthorization, false);
  assert.equal(snapshot.automaticExecutionAllowed, false);
  assert.equal(snapshot.automaticSuggestionAllowed, true);
  assert.equal(snapshot.automaticBetExecutionAllowed, false);
  assert.equal(snapshot.humanSupervisionRequired, true);
  assert.equal(snapshot.nestedLegacyTestCount, 0);
  assert.ok(snapshot.repositoryReadinessScore >= 60);
});

test('technical debt report is deterministic and audit friendly', () => {
  const snapshot = createTechnicalDebtSnapshot(process.cwd());
  const report = formatTechnicalDebtReport(snapshot);

  assert.match(report, /RL\.SYS CORE Technical Debt Report/);
  assert.match(report, /TechnicalDebtScore:/);
  assert.match(report, /MaintainabilityScore:/);
  assert.match(report, /RepositoryReadinessScore:/);
  assert.match(report, /AutomaticSuggestionAllowed: true/);
  assert.match(report, /AutomaticBetExecutionAllowed: false/);
});
