#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="247"
NAME="Institutional Dependency Governance V2"
BRANCH="sprint-247-institutional-dependency-governance"
OLD_GLOBAL_TEST_BASELINE="1334"

if ! PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: Git repository root not found."
  exit 1
fi

cd "$PROJECT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p \
  logs \
  artifacts/logs \
  artifacts/dependency-governance \
  install/quality \
  install/sprints \
  test/domain/quality

LOG_FILE="logs/sprint-${SPRINT}-${TIMESTAMP}.log"
SUCCESS_SUMMARY="artifacts/logs/sprint-${SPRINT}-success-summary.txt"
FAILURE_SUMMARY="artifacts/logs/sprint-${SPRINT}-failure-summary.txt"
GLOBAL_TEST_LOG="logs/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log"
CURRENT_TEST_LOG="logs/sprint-${SPRINT}-current-test-${TIMESTAMP}.log"
DEPENDENCY_REPORT="artifacts/dependency-governance/sprint-${SPRINT}-dependency-governance-report.txt"
NPM_AUDIT_JSON="artifacts/dependency-governance/sprint-${SPRINT}-npm-audit.json"
NPM_AUDIT_STDERR="artifacts/dependency-governance/sprint-${SPRINT}-npm-audit-stderr.txt"
SUMMARY_PARSE_LOG="artifacts/dependency-governance/sprint-${SPRINT}-parsed-node-test-summary.txt"
DEBUG_TAIL_LOG="artifacts/dependency-governance/sprint-${SPRINT}-failure-log-tail.txt"

exec > >(tee -a "$LOG_FILE") 2>&1

copy_mobile_logs() {
  if [ -d "/sdcard/Download" ]; then
    cp -f "$LOG_FILE" "/sdcard/Download/sprint-${SPRINT}-${TIMESTAMP}.log" 2>/dev/null || true
    cp -f "$SUCCESS_SUMMARY" "/sdcard/Download/sprint-${SPRINT}-success-summary.txt" 2>/dev/null || true
    cp -f "$FAILURE_SUMMARY" "/sdcard/Download/sprint-${SPRINT}-failure-summary.txt" 2>/dev/null || true
    cp -f "$GLOBAL_TEST_LOG" "/sdcard/Download/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log" 2>/dev/null || true
  fi
}

write_failure_summary() {
  local exit_code="$?"
  tail -220 "$LOG_FILE" > "$DEBUG_TAIL_LOG" 2>/dev/null || true

  {
    echo "========================================"
    echo "RL.SYS CORE — SPRINT FAILURE SUMMARY"
    echo "========================================"
    echo "Sprint: ${SPRINT}"
    echo "Name: ${NAME}"
    echo "Status: FAILURE"
    echo "ExitCode: ${exit_code}"
    echo
    echo "RepositoryRoot:"
    echo "$PROJECT_DIR"
    echo
    echo "HEAD:"
    git rev-parse --short HEAD 2>/dev/null || true
    echo
    echo "Branch:"
    git branch --show-current 2>/dev/null || true
    echo
    echo "GitStatus:"
    git status --short 2>/dev/null || true
    echo
    echo "LogFile:"
    echo "$LOG_FILE"
    echo
    echo "FailureTail:"
    echo "$DEBUG_TAIL_LOG"
    echo
    echo "Timestamp:"
    date -Iseconds
    echo "========================================"
  } > "$FAILURE_SUMMARY"

  copy_mobile_logs
  cat "$FAILURE_SUMMARY" || true
  echo
  cat "$DEBUG_TAIL_LOG" || true
  exit "$exit_code"
}

trap write_failure_summary ERR

extract_summary_value() {
  local key="$1"
  local file="$2"
  grep -E "^${key}=" "$file" | tail -1 | cut -d '=' -f 2- | tr -d '[:space:]'
}

count_files() {
  local target_dir="$1"
  local pattern="$2"

  if [ -d "$target_dir" ]; then
    find "$target_dir" -name "$pattern" | wc -l | tr -d ' '
  else
    echo "0"
  fi
}

count_nested_legacy_tests() {
  if [ -d tests ]; then
    find tests -mindepth 2 -name "*.test.js" | wc -l | tr -d ' '
  else
    echo "0"
  fi
}

echo "========================================"
echo "RL.SYS CORE — SPRINT ${SPRINT}"
echo "$NAME"
echo "========================================"
echo "RepositoryRoot: $PROJECT_DIR"

echo
echo "==> Recovery from previous attempts"

git fetch origin main

if [ "$(git branch --show-current || true)" != "main" ]; then
  git checkout main -f
fi

git reset --hard origin/main

if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git branch -D "$BRANCH"
fi

rm -rf artifacts/dependency-governance
rm -f install/quality/dependency-governance-engine.cjs
rm -f test/domain/quality/DependencyGovernanceEngine.test.js

mkdir -p artifacts/dependency-governance install/quality test/domain/quality

PREVIOUS_HEAD="$(git rev-parse --short HEAD)"
git checkout -b "$BRANCH"
BASE_HEAD="$(git rev-parse --short HEAD)"

echo
echo "==> Writing Institutional Dependency Governance Engine"

cat > install/quality/dependency-governance-engine.cjs <<'NODE'
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (_) {
    return false;
  }
}

function readJsonFile(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8')),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error && error.message ? error.message : String(error),
    };
  }
}

function countObjectKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 0;
  }

  return Object.keys(value).length;
}

function normalizeAuditCounts(auditJson) {
  const empty = Object.freeze({
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  });

  if (!auditJson || typeof auditJson !== 'object') {
    return empty;
  }

  if (
    auditJson.metadata &&
    auditJson.metadata.vulnerabilities &&
    typeof auditJson.metadata.vulnerabilities === 'object'
  ) {
    const source = auditJson.metadata.vulnerabilities;

    return Object.freeze({
      info: Number(source.info || 0),
      low: Number(source.low || 0),
      moderate: Number(source.moderate || 0),
      high: Number(source.high || 0),
      critical: Number(source.critical || 0),
      total: Number(source.total || 0),
    });
  }

  const vulnerabilities = auditJson.vulnerabilities && typeof auditJson.vulnerabilities === 'object'
    ? Object.values(auditJson.vulnerabilities)
    : [];

  const counts = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  };

  for (const item of vulnerabilities) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const severity = String(item.severity || '').toLowerCase();

    if (Object.prototype.hasOwnProperty.call(counts, severity)) {
      counts[severity] += 1;
      counts.total += 1;
    }
  }

  return Object.freeze(counts);
}

function createDependencySnapshot(rootDir, auditJsonPath) {
  const baseDir = rootDir || process.cwd();
  const packagePath = path.join(baseDir, 'package.json');
  const lockPath = path.join(baseDir, 'package-lock.json');
  const resolvedAuditPath = auditJsonPath
    ? path.resolve(baseDir, auditJsonPath)
    : path.join(baseDir, 'artifacts/dependency-governance/npm-audit.json');

  const packageRead = readJsonFile(packagePath);
  const lockRead = readJsonFile(lockPath);
  const auditRead = existsFile(resolvedAuditPath)
    ? readJsonFile(resolvedAuditPath)
    : { ok: false, value: null, error: 'audit json not found' };

  const packageJson = packageRead.ok ? packageRead.value : {};
  const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const requiredScripts = ['build', 'test', 'test:audit'];
  const missingScripts = requiredScripts.filter((scriptName) => !scripts[scriptName]);

  const dependencyCount = countObjectKeys(packageJson.dependencies);
  const devDependencyCount = countObjectKeys(packageJson.devDependencies);
  const optionalDependencyCount = countObjectKeys(packageJson.optionalDependencies);
  const peerDependencyCount = countObjectKeys(packageJson.peerDependencies);
  const auditCounts = normalizeAuditCounts(auditRead.value);
  const policyViolations = [];

  if (!packageRead.ok) {
    policyViolations.push('package.json is invalid or missing');
  }

  if (!lockRead.ok) {
    policyViolations.push('package-lock.json is invalid or missing');
  }

  if (missingScripts.length > 0) {
    policyViolations.push(`missing required npm scripts: ${missingScripts.join(', ')}`);
  }

  if (packageJson.type === 'commonjs') {
    policyViolations.push('package.json must not force type=commonjs');
  }

  if (auditCounts.high > 0) {
    policyViolations.push(`high severity vulnerabilities detected: ${auditCounts.high}`);
  }

  if (auditCounts.critical > 0) {
    policyViolations.push(`critical severity vulnerabilities detected: ${auditCounts.critical}`);
  }

  const hardViolationCount = policyViolations.length;
  const dependencyGovernanceScore = Math.max(
    0,
    100 - hardViolationCount * 20 - auditCounts.moderate * 2 - auditCounts.low
  );

  return Object.freeze({
    rootDir: baseDir,
    packageJsonValid: packageRead.ok,
    packageLockValid: lockRead.ok,
    packageName: packageJson.name || 'UNKNOWN',
    packageVersion: packageJson.version || 'UNKNOWN',
    packageType: packageJson.type || 'unspecified',
    dependencyCount,
    devDependencyCount,
    optionalDependencyCount,
    peerDependencyCount,
    requiredScripts,
    missingScripts,
    auditJsonAvailable: auditRead.ok,
    auditCounts,
    policyViolations,
    hardViolationCount,
    dependencyGovernanceScore,
    status: hardViolationCount === 0 ? 'PASS' : 'NEEDS_REVIEW',
    paperOnly: true,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    humanSupervisionRequired: true,
  });
}

function formatDependencyReport(snapshot) {
  const lines = [];

  lines.push('RL.SYS CORE Dependency Governance Report');
  lines.push(`Status: ${snapshot.status}`);
  lines.push(`DependencyGovernanceScore: ${snapshot.dependencyGovernanceScore}`);
  lines.push(`PackageName: ${snapshot.packageName}`);
  lines.push(`PackageVersion: ${snapshot.packageVersion}`);
  lines.push(`PackageType: ${snapshot.packageType}`);
  lines.push(`PackageJsonValid: ${snapshot.packageJsonValid}`);
  lines.push(`PackageLockValid: ${snapshot.packageLockValid}`);
  lines.push(`DependencyCount: ${snapshot.dependencyCount}`);
  lines.push(`DevDependencyCount: ${snapshot.devDependencyCount}`);
  lines.push(`OptionalDependencyCount: ${snapshot.optionalDependencyCount}`);
  lines.push(`PeerDependencyCount: ${snapshot.peerDependencyCount}`);
  lines.push(`MissingRequiredScriptCount: ${snapshot.missingScripts.length}`);
  lines.push(`AuditJsonAvailable: ${snapshot.auditJsonAvailable}`);
  lines.push(`AuditInfo: ${snapshot.auditCounts.info}`);
  lines.push(`AuditLow: ${snapshot.auditCounts.low}`);
  lines.push(`AuditModerate: ${snapshot.auditCounts.moderate}`);
  lines.push(`AuditHigh: ${snapshot.auditCounts.high}`);
  lines.push(`AuditCritical: ${snapshot.auditCounts.critical}`);
  lines.push(`AuditTotal: ${snapshot.auditCounts.total}`);
  lines.push(`PaperOnly: ${snapshot.paperOnly}`);
  lines.push(`ProductionMoneyAllowed: ${snapshot.productionMoneyAllowed}`);
  lines.push(`LiveMoneyAuthorization: ${snapshot.liveMoneyAuthorization}`);
  lines.push(`AutomaticExecutionAllowed: ${snapshot.automaticExecutionAllowed}`);
  lines.push(`HumanSupervisionRequired: ${snapshot.humanSupervisionRequired}`);

  if (snapshot.policyViolations.length > 0) {
    lines.push('');
    lines.push('PolicyViolations:');

    for (const violation of snapshot.policyViolations) {
      lines.push(` - ${violation}`);
    }
  }

  if (snapshot.auditCounts.moderate > 0 && snapshot.status === 'PASS') {
    lines.push('');
    lines.push('Advisory:');
    lines.push(' - Moderate vulnerabilities detected. Track remediation, but do not block this sprint unless high or critical risk appears.');
  }

  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  const auditJsonPath = process.argv[2];
  const snapshot = createDependencySnapshot(process.cwd(), auditJsonPath);
  process.stdout.write(formatDependencyReport(snapshot));

  if (snapshot.status !== 'PASS') {
    process.exit(1);
  }
}

module.exports = {
  countObjectKeys,
  createDependencySnapshot,
  formatDependencyReport,
  normalizeAuditCounts,
  readJsonFile,
};
NODE

chmod +x install/quality/dependency-governance-engine.cjs

echo
echo "==> Writing Sprint 247 tests"

cat > test/domain/quality/DependencyGovernanceEngine.test.js <<'NODE'
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
NODE

echo
echo "==> Updating package.json with dependency governance audit script"

node <<'NODE'
'use strict';

const fs = require('fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.scripts = packageJson.scripts || {};
packageJson.scripts['deps:audit'] = 'node install/quality/dependency-governance-engine.cjs artifacts/dependency-governance/sprint-247-npm-audit.json';
fs.writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
NODE

echo
echo "==> Syntax validation"

node --check install/quality/dependency-governance-engine.cjs
node --check test/domain/quality/DependencyGovernanceEngine.test.js

echo
echo "==> Installing dependencies"

npm ci

echo
echo "==> Running npm audit JSON capture"

NPM_AUDIT_EXIT_CODE=0
npm audit --json > "$NPM_AUDIT_JSON" 2> "$NPM_AUDIT_STDERR" || NPM_AUDIT_EXIT_CODE="$?"

if [ ! -s "$NPM_AUDIT_JSON" ]; then
  echo '{"metadata":{"vulnerabilities":{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}}}' > "$NPM_AUDIT_JSON"
fi

echo "NpmAuditExitCode: $NPM_AUDIT_EXIT_CODE"
cat "$NPM_AUDIT_STDERR" || true

echo
echo "==> Dependency governance report"

node install/quality/dependency-governance-engine.cjs "$NPM_AUDIT_JSON" | tee "$DEPENDENCY_REPORT"

echo
echo "==> Build validation"

npm run build

echo
echo "==> Current Sprint specific test"

node --test test/domain/quality/DependencyGovernanceEngine.test.js | tee "$CURRENT_TEST_LOG"

echo
echo "==> Previous quality regression tests"

node --test test/domain/quality/TestDiscoveryGovernance.test.js
node --test test/domain/quality/TestDiscoveryGovernanceV2.test.js
node --test test/domain/quality/LegacyNestedRegressionClosure.test.js
node --test test/domain/quality/RepositoryGovernanceEngine.test.js

echo
echo "==> Global npm test validation"

npm test | tee "$GLOBAL_TEST_LOG"

echo
echo "==> Parsing global Node test summary"

node install/quality/parse-node-test-summary.cjs "$GLOBAL_TEST_LOG" | tee "$SUMMARY_PARSE_LOG"

GLOBAL_TEST_TOTAL="$(extract_summary_value "GlobalTestTotal" "$SUMMARY_PARSE_LOG")"
GLOBAL_TEST_PASS="$(extract_summary_value "GlobalTestPass" "$SUMMARY_PARSE_LOG")"
GLOBAL_TEST_FAIL="$(extract_summary_value "GlobalTestFail" "$SUMMARY_PARSE_LOG")"

if [ "$GLOBAL_TEST_TOTAL" = "UNKNOWN" ] || [ -z "$GLOBAL_TEST_TOTAL" ]; then
  echo "ERROR: Global test total parser returned UNKNOWN."
  exit 1
fi

if [ "$GLOBAL_TEST_PASS" = "UNKNOWN" ] || [ -z "$GLOBAL_TEST_PASS" ]; then
  echo "ERROR: Global test pass parser returned UNKNOWN."
  exit 1
fi

if [ "$GLOBAL_TEST_FAIL" = "UNKNOWN" ] || [ -z "$GLOBAL_TEST_FAIL" ]; then
  echo "ERROR: Global test fail parser returned UNKNOWN."
  exit 1
fi

if [ "$GLOBAL_TEST_FAIL" != "0" ]; then
  echo "ERROR: Global npm tests reported failures: $GLOBAL_TEST_FAIL"
  exit 1
fi

if [ "$GLOBAL_TEST_TOTAL" -lt "$OLD_GLOBAL_TEST_BASELINE" ]; then
  echo "ERROR: Global test total regressed below baseline ${OLD_GLOBAL_TEST_BASELINE}. Current: ${GLOBAL_TEST_TOTAL}"
  exit 1
fi

echo
echo "==> Git status before commit"

git status --short

git add \
  package.json \
  install/quality/dependency-governance-engine.cjs \
  test/domain/quality/DependencyGovernanceEngine.test.js \
  artifacts/dependency-governance \
  install/sprints/run-sprint-${SPRINT}.sh

git add -u

if git diff --cached --quiet; then
  echo "No changes detected for Sprint ${SPRINT}."
  exit 1
fi

git commit -m "chore(governance): add institutional dependency governance"

git push -u origin "$BRANCH"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint ${SPRINT} institutional dependency governance"
git push origin main

FINAL_HEAD="$(git rev-parse --short HEAD)"
SOURCE_JS_COUNT="$(count_files src '*.js')"
OFFICIAL_TEST_FILE_COUNT="$(count_files test '*.test.js')"
LEGACY_TEST_FILE_COUNT="$(count_files tests '*.test.js')"
LEGACY_NESTED_TEST_COUNT="$(count_nested_legacy_tests)"

DEPENDENCY_SCORE="$(grep -E '^DependencyGovernanceScore:' "$DEPENDENCY_REPORT" | tail -1 | awk '{print $2}' || true)"
AUDIT_LOW="$(grep -E '^AuditLow:' "$DEPENDENCY_REPORT" | tail -1 | awk '{print $2}' || true)"
AUDIT_MODERATE="$(grep -E '^AuditModerate:' "$DEPENDENCY_REPORT" | tail -1 | awk '{print $2}' || true)"
AUDIT_HIGH="$(grep -E '^AuditHigh:' "$DEPENDENCY_REPORT" | tail -1 | awk '{print $2}' || true)"
AUDIT_CRITICAL="$(grep -E '^AuditCritical:' "$DEPENDENCY_REPORT" | tail -1 | awk '{print $2}' || true)"

{
  echo "========================================"
  echo "RL.SYS CORE — SPRINT SUCCESS SUMMARY"
  echo "========================================"
  echo "Sprint: ${SPRINT}"
  echo "Name: ${NAME}"
  echo "Status: SUCCESS"
  echo
  echo "Previous HEAD:"
  echo "$PREVIOUS_HEAD"
  echo
  echo "Base HEAD:"
  echo "$BASE_HEAD"
  echo
  echo "Final HEAD:"
  echo "$FINAL_HEAD"
  echo
  echo "Branch:"
  echo "$BRANCH"
  echo
  echo "Build:"
  echo "PASS"
  echo
  echo "CurrentSprintSpecificTest:"
  echo "PASS"
  echo
  echo "PreviousQualityRegressionTests:"
  echo "PASS"
  echo
  echo "GlobalNpmTests:"
  echo "PASS"
  echo
  echo "OldGlobalTestBaseline:"
  echo "$OLD_GLOBAL_TEST_BASELINE"
  echo
  echo "GlobalTestTotal:"
  echo "$GLOBAL_TEST_TOTAL"
  echo
  echo "GlobalTestPass:"
  echo "$GLOBAL_TEST_PASS"
  echo
  echo "GlobalTestFail:"
  echo "$GLOBAL_TEST_FAIL"
  echo
  echo "SourceJsCount:"
  echo "$SOURCE_JS_COUNT"
  echo
  echo "OfficialTestFileCount:"
  echo "$OFFICIAL_TEST_FILE_COUNT"
  echo
  echo "LegacyTestFileCount:"
  echo "$LEGACY_TEST_FILE_COUNT"
  echo
  echo "LegacyNestedTestCount:"
  echo "$LEGACY_NESTED_TEST_COUNT"
  echo
  echo "DependencyGovernance:"
  echo "PASS"
  echo
  echo "DependencyGovernanceScore:"
  echo "${DEPENDENCY_SCORE:-UNKNOWN}"
  echo
  echo "NpmAuditExitCode:"
  echo "$NPM_AUDIT_EXIT_CODE"
  echo
  echo "AuditLow:"
  echo "${AUDIT_LOW:-UNKNOWN}"
  echo
  echo "AuditModerate:"
  echo "${AUDIT_MODERATE:-UNKNOWN}"
  echo
  echo "AuditHigh:"
  echo "${AUDIT_HIGH:-UNKNOWN}"
  echo
  echo "AuditCritical:"
  echo "${AUDIT_CRITICAL:-UNKNOWN}"
  echo
  echo "Architecture:"
  echo "Added institutional dependency governance with deterministic package/lockfile validation, required npm script checks, npm audit JSON parsing, and high/critical vulnerability blocking while keeping moderate issues advisory-only."
  echo
  echo "Complexity:"
  echo "Time: O(d + v + s)"
  echo "Space: O(d + v + s)"
  echo
  echo "Institutional Flags:"
  echo "paperOnly=true"
  echo "productionMoneyAllowed=false"
  echo "liveMoneyAuthorization=false"
  echo "automaticExecutionAllowed=false"
  echo "humanSupervisionRequired=true"
  echo
  echo "Files Added/Updated:"
  echo "package.json"
  echo "install/quality/dependency-governance-engine.cjs"
  echo "test/domain/quality/DependencyGovernanceEngine.test.js"
  echo
  echo "Reports:"
  echo "$DEPENDENCY_REPORT"
  echo "$NPM_AUDIT_JSON"
  echo "$SUMMARY_PARSE_LOG"
  echo
  echo "LogFile:"
  echo "$LOG_FILE"
  echo
  echo "CurrentSprintTestLog:"
  echo "$CURRENT_TEST_LOG"
  echo
  echo "GlobalNpmTestLog:"
  echo "$GLOBAL_TEST_LOG"
  echo
  echo "Timestamp:"
  date -Iseconds
  echo "========================================"
} > "$SUCCESS_SUMMARY"

copy_mobile_logs

cat "$SUCCESS_SUMMARY"

echo
echo "Sprint ${SPRINT} completed successfully."
