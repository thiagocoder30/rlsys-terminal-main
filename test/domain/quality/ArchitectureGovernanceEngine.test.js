'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  collectForbiddenDomainDependencyViolations,
  collectForbiddenInstitutionalFlagViolations,
  createArchitectureSnapshot,
  formatArchitectureReport,
  inspectPackageArchitecture,
} = require('../../../install/quality/architecture-governance-engine.cjs');

function createFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-arch-'));

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  return root;
}

test('architecture governance detects forbidden institutional flag drift in governed runtime code', () => {
  const root = createFixture({
    'src/domain/example/BadEngine.js': `
      const policy = {
        productionMoneyAllowed: true,
        liveMoneyAuthorization: true,
        automaticExecutionAllowed: true,
        paperOnly: false
      };
      module.exports = policy;
    `,
  });

  const violations = collectForbiddenInstitutionalFlagViolations(root, ['src/domain/example/BadEngine.js']);

  assert.equal(violations.length, 4);
  assert.match(violations.join('\n'), /productionMoneyAllowed true/);
  assert.match(violations.join('\n'), /liveMoneyAuthorization true/);
  assert.match(violations.join('\n'), /automaticExecutionAllowed true/);
  assert.match(violations.join('\n'), /paperOnly false/);
});

test('architecture governance allows forbidden values inside tests as defensive fixtures', () => {
  const snapshot = createArchitectureSnapshot(process.cwd());

  assert.equal(snapshot.institutionalFlagViolationCount, 0);
  assert.equal(snapshot.status, 'PASS');
});

test('architecture governance detects forbidden domain dependencies', () => {
  const root = createFixture({
    'src/domain/example/BadEngine.js': `
      const child = require('child_process');
      const tool = require('../../../install/quality/repository-governance-engine.cjs');
      child.execSync('echo bad');
    `,
  });

  const violations = collectForbiddenDomainDependencyViolations(root, ['src/domain/example/BadEngine.js']);

  assert.ok(violations.length >= 2);
  assert.match(violations.join('\n'), /domain must/);
});

test('architecture governance validates current repository clean architecture contract', () => {
  const snapshot = createArchitectureSnapshot(process.cwd());

  assert.equal(snapshot.status, 'PASS');
  assert.equal(snapshot.architectureGovernanceScore, 100);
  assert.equal(snapshot.productionMoneyAllowed, false);
  assert.equal(snapshot.liveMoneyAuthorization, false);
  assert.equal(snapshot.automaticExecutionAllowed, false);
  assert.equal(snapshot.automaticSuggestionAllowed, true);
  assert.equal(snapshot.automaticBetExecutionAllowed, false);
  assert.equal(snapshot.paperOnly, true);
});

test('architecture governance report is deterministic and audit friendly', () => {
  const snapshot = createArchitectureSnapshot(process.cwd());
  const report = formatArchitectureReport(snapshot);

  assert.match(report, /RL\.SYS CORE Architecture Governance Report/);
  assert.match(report, /Status: PASS/);
  assert.match(report, /ArchitectureGovernanceScore: 100/);
  assert.match(report, /AutomaticSuggestionAllowed: true/);
  assert.match(report, /AutomaticBetExecutionAllowed: false/);
  assert.match(report, /HumanSupervisionRequired: true/);
});

test('package architecture inspection rejects forced commonjs policy', () => {
  const root = createFixture({
    'package.json': JSON.stringify({
      name: 'fixture',
      version: '1.0.0',
      type: 'commonjs',
      scripts: {
        build: 'echo build',
        test: 'echo test',
      },
    }),
  });

  const inspected = inspectPackageArchitecture(root);

  assert.equal(inspected.ok, true);
  assert.equal(inspected.forcesCommonJs, true);
});
