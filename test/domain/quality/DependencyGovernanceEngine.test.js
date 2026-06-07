'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createDependencySnapshot,
  formatDependencyReport,
  normalizeAuditCounts,
} = require('../../../install/quality/dependency-governance-engine.cjs');

function createTempRepoFixture(packageJson, lockJson, auditJson) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-deps-'));
  const auditPath = path.join(root, 'audit.json');

  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  fs.writeFileSync(path.join(root, 'package-lock.json'), `${JSON.stringify(lockJson, null, 2)}\n`);
  fs.writeFileSync(auditPath, `${JSON.stringify(auditJson, null, 2)}\n`);

  return { root, auditPath };
}

test('dependency governance normalizes npm audit metadata counts', () => {
  const counts = normalizeAuditCounts({
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 1,
        moderate: 2,
        high: 0,
        critical: 0,
        total: 3,
      },
    },
  });

  assert.equal(counts.low, 1);
  assert.equal(counts.moderate, 2);
  assert.equal(counts.high, 0);
  assert.equal(counts.critical, 0);
  assert.equal(counts.total, 3);
});

test('dependency governance passes controlled fixture with moderate-only advisory risk', () => {
  const fixture = createTempRepoFixture(
    {
      name: 'fixture',
      version: '1.0.0',
      scripts: {
        build: 'echo build',
        test: 'echo test',
        'test:audit': 'echo audit',
      },
      dependencies: {
        alpha: '1.0.0',
      },
      devDependencies: {
        beta: '1.0.0',
      },
    },
    {
      name: 'fixture',
      lockfileVersion: 3,
      packages: {},
    },
    {
      metadata: {
        vulnerabilities: {
          info: 0,
          low: 0,
          moderate: 2,
          high: 0,
          critical: 0,
          total: 2,
        },
      },
    }
  );

  const snapshot = createDependencySnapshot(fixture.root, fixture.auditPath);

  assert.equal(snapshot.status, 'PASS');
  assert.equal(snapshot.auditCounts.moderate, 2);
  assert.equal(snapshot.auditCounts.high, 0);
  assert.equal(snapshot.auditCounts.critical, 0);
  assert.equal(snapshot.dependencyCount, 1);
  assert.equal(snapshot.devDependencyCount, 1);
});

test('dependency governance blocks high and critical vulnerabilities', () => {
  const fixture = createTempRepoFixture(
    {
      name: 'fixture',
      version: '1.0.0',
      scripts: {
        build: 'echo build',
        test: 'echo test',
        'test:audit': 'echo audit',
      },
    },
    {
      name: 'fixture',
      lockfileVersion: 3,
      packages: {},
    },
    {
      metadata: {
        vulnerabilities: {
          info: 0,
          low: 0,
          moderate: 0,
          high: 1,
          critical: 1,
          total: 2,
        },
      },
    }
  );

  const snapshot = createDependencySnapshot(fixture.root, fixture.auditPath);

  assert.equal(snapshot.status, 'NEEDS_REVIEW');
  assert.equal(snapshot.hardViolationCount, 2);
  assert.match(snapshot.policyViolations.join('\n'), /high severity/);
  assert.match(snapshot.policyViolations.join('\n'), /critical severity/);
});

test('current repository dependency governance report is audit friendly', () => {
  const snapshot = createDependencySnapshot(
    process.cwd(),
    'artifacts/dependency-governance/sprint-247-npm-audit.json'
  );
  const report = formatDependencyReport(snapshot);

  assert.equal(snapshot.packageJsonValid, true);
  assert.equal(snapshot.packageLockValid, true);
  assert.equal(snapshot.missingScripts.length, 0);
  assert.equal(snapshot.productionMoneyAllowed, false);
  assert.equal(snapshot.liveMoneyAuthorization, false);
  assert.match(report, /RL\.SYS CORE Dependency Governance Report/);
});
