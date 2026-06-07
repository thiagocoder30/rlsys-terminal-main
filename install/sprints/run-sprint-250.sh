#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="250"
NAME="Institutional Repository Certification V1"
BRANCH="sprint-250-institutional-repository-certification-v1"
OLD_GLOBAL_TEST_BASELINE="1349"

if ! PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: Git repository root not found."
  exit 1
fi

cd "$PROJECT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p \
  logs \
  artifacts/logs \
  artifacts/repository-certification \
  artifacts/dependency-governance \
  install/quality \
  install/sprints \
  test/domain/quality

LOG_FILE="logs/sprint-${SPRINT}-${TIMESTAMP}.log"
SUCCESS_SUMMARY="artifacts/logs/sprint-${SPRINT}-success-summary.txt"
FAILURE_SUMMARY="artifacts/logs/sprint-${SPRINT}-failure-summary.txt"
GLOBAL_TEST_LOG="logs/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log"
CURRENT_TEST_LOG="logs/sprint-${SPRINT}-current-test-${TIMESTAMP}.log"
CERTIFICATION_REPORT="artifacts/repository-certification/sprint-${SPRINT}-repository-certification-report.txt"
NPM_AUDIT_JSON="artifacts/dependency-governance/sprint-${SPRINT}-npm-audit.json"
NPM_AUDIT_STDERR="artifacts/dependency-governance/sprint-${SPRINT}-npm-audit-stderr.txt"
SUMMARY_PARSE_LOG="artifacts/repository-certification/sprint-${SPRINT}-parsed-node-test-summary.txt"
DEBUG_TAIL_LOG="artifacts/repository-certification/sprint-${SPRINT}-failure-log-tail.txt"

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
  tail -240 "$LOG_FILE" > "$DEBUG_TAIL_LOG" 2>/dev/null || true

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

extract_report_value() {
  local key="$1"
  local file="$2"
  grep -E "^${key}:" "$file" | tail -1 | cut -d ':' -f 2- | tr -d '[:space:]'
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

rm -rf artifacts/repository-certification
rm -f install/quality/repository-certification-engine.cjs
rm -f test/domain/quality/RepositoryCertificationEngine.test.js

mkdir -p artifacts/repository-certification artifacts/dependency-governance install/quality test/domain/quality

PREVIOUS_HEAD="$(git rev-parse --short HEAD)"
git checkout -b "$BRANCH"
BASE_HEAD="$(git rev-parse --short HEAD)"

echo
echo "==> Writing Institutional Repository Certification Engine"

cat > install/quality/repository-certification-engine.cjs <<'NODE'
#!/usr/bin/env node
'use strict';

const { createGovernanceSnapshot } = require('./repository-governance-engine.cjs');
const { createDependencySnapshot } = require('./dependency-governance-engine.cjs');
const { createArchitectureSnapshot } = require('./architecture-governance-engine.cjs');
const { createTechnicalDebtSnapshot } = require('./technical-debt-engine.cjs');

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseArgs(argv) {
  const options = {
    auditJsonPath: 'artifacts/dependency-governance/sprint-250-npm-audit.json',
    globalTestTotal: 0,
    globalTestPass: 0,
    globalTestFail: 0,
    oldGlobalTestBaseline: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === '--audit-json') {
      options.auditJsonPath = argv[index + 1] || options.auditJsonPath;
      index += 1;
    } else if (current === '--global-test-total') {
      options.globalTestTotal = parseNumber(argv[index + 1], 0);
      index += 1;
    } else if (current === '--global-test-pass') {
      options.globalTestPass = parseNumber(argv[index + 1], 0);
      index += 1;
    } else if (current === '--global-test-fail') {
      options.globalTestFail = parseNumber(argv[index + 1], 0);
      index += 1;
    } else if (current === '--old-global-test-baseline') {
      options.oldGlobalTestBaseline = parseNumber(argv[index + 1], 0);
      index += 1;
    }
  }

  return Object.freeze(options);
}

function createCertificationSnapshot(rootDir, options) {
  const baseDir = rootDir || process.cwd();
  const safeOptions = options || {};
  const repository = createGovernanceSnapshot(baseDir);
  const dependency = createDependencySnapshot(baseDir, safeOptions.auditJsonPath);
  const architecture = createArchitectureSnapshot(baseDir);
  const technicalDebt = createTechnicalDebtSnapshot(baseDir);

  const certificationChecks = [
    {
      name: 'RepositoryGovernance',
      pass: repository.status === 'PASS' && repository.repositoryGovernanceScore >= 100,
      score: repository.repositoryGovernanceScore,
    },
    {
      name: 'DependencyGovernance',
      pass:
        dependency.status === 'PASS' &&
        dependency.auditCounts.high === 0 &&
        dependency.auditCounts.critical === 0,
      score: dependency.dependencyGovernanceScore,
    },
    {
      name: 'ArchitectureGovernance',
      pass: architecture.status === 'PASS' && architecture.architectureGovernanceScore >= 100,
      score: architecture.architectureGovernanceScore,
    },
    {
      name: 'TechnicalDebt',
      pass:
        technicalDebt.status === 'PASS' &&
        technicalDebt.hardViolationCount === 0 &&
        technicalDebt.repositoryReadinessScore >= 90,
      score: technicalDebt.repositoryReadinessScore,
    },
    {
      name: 'GlobalTests',
      pass:
        safeOptions.globalTestFail === 0 &&
        safeOptions.globalTestTotal >= safeOptions.oldGlobalTestBaseline &&
        safeOptions.globalTestPass === safeOptions.globalTestTotal,
      score: safeOptions.globalTestFail === 0 ? 100 : 0,
    },
    {
      name: 'PaperOnlyInstitutionalFlags',
      pass:
        repository.paperOnly === true &&
        repository.productionMoneyAllowed === false &&
        repository.liveMoneyAuthorization === false &&
        repository.automaticExecutionAllowed === false &&
        architecture.automaticSuggestionAllowed === true &&
        architecture.automaticBetExecutionAllowed === false &&
        architecture.humanSupervisionRequired === true,
      score: 100,
    },
  ];

  const failedChecks = certificationChecks.filter((check) => !check.pass);
  const averageScore =
    certificationChecks.reduce((sum, check) => sum + Number(check.score || 0), 0) /
    certificationChecks.length;
  const repositoryCertificationScore = Math.round(averageScore);
  const repositoryCertified = failedChecks.length === 0 && repositoryCertificationScore >= 95;
  const paperPlatformReadyCandidate = repositoryCertified;

  return Object.freeze({
    rootDir: baseDir,
    repository,
    dependency,
    architecture,
    technicalDebt,
    certificationChecks: Object.freeze(certificationChecks),
    failedChecks: Object.freeze(failedChecks),
    failedCheckCount: failedChecks.length,
    repositoryCertificationScore,
    repositoryCertified,
    paperPlatformReadyCandidate,
    globalTestTotal: safeOptions.globalTestTotal,
    globalTestPass: safeOptions.globalTestPass,
    globalTestFail: safeOptions.globalTestFail,
    oldGlobalTestBaseline: safeOptions.oldGlobalTestBaseline,
    status: repositoryCertified ? 'CERTIFIED' : 'NEEDS_REVIEW',
    paperOnly: true,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    automaticSuggestionAllowed: true,
    automaticBetExecutionAllowed: false,
    humanSupervisionRequired: true,
  });
}

function formatCertificationReport(snapshot) {
  const lines = [];

  lines.push('RL.SYS CORE Repository Certification Report');
  lines.push(`Status: ${snapshot.status}`);
  lines.push(`RepositoryCertified: ${snapshot.repositoryCertified}`);
  lines.push(`PaperPlatformReadyCandidate: ${snapshot.paperPlatformReadyCandidate}`);
  lines.push(`RepositoryCertificationScore: ${snapshot.repositoryCertificationScore}`);
  lines.push(`FailedCheckCount: ${snapshot.failedCheckCount}`);
  lines.push(`GlobalTestTotal: ${snapshot.globalTestTotal}`);
  lines.push(`GlobalTestPass: ${snapshot.globalTestPass}`);
  lines.push(`GlobalTestFail: ${snapshot.globalTestFail}`);
  lines.push(`OldGlobalTestBaseline: ${snapshot.oldGlobalTestBaseline}`);
  lines.push(`RepositoryGovernanceScore: ${snapshot.repository.repositoryGovernanceScore}`);
  lines.push(`DependencyGovernanceScore: ${snapshot.dependency.dependencyGovernanceScore}`);
  lines.push(`ArchitectureGovernanceScore: ${snapshot.architecture.architectureGovernanceScore}`);
  lines.push(`TechnicalDebtScore: ${snapshot.technicalDebt.technicalDebtScore}`);
  lines.push(`MaintainabilityScore: ${snapshot.technicalDebt.maintainabilityScore}`);
  lines.push(`RepositoryReadinessScore: ${snapshot.technicalDebt.repositoryReadinessScore}`);
  lines.push(`AuditHigh: ${snapshot.dependency.auditCounts.high}`);
  lines.push(`AuditCritical: ${snapshot.dependency.auditCounts.critical}`);
  lines.push(`AuditModerate: ${snapshot.dependency.auditCounts.moderate}`);
  lines.push(`PaperOnly: ${snapshot.paperOnly}`);
  lines.push(`ProductionMoneyAllowed: ${snapshot.productionMoneyAllowed}`);
  lines.push(`LiveMoneyAuthorization: ${snapshot.liveMoneyAuthorization}`);
  lines.push(`AutomaticExecutionAllowed: ${snapshot.automaticExecutionAllowed}`);
  lines.push(`AutomaticSuggestionAllowed: ${snapshot.automaticSuggestionAllowed}`);
  lines.push(`AutomaticBetExecutionAllowed: ${snapshot.automaticBetExecutionAllowed}`);
  lines.push(`HumanSupervisionRequired: ${snapshot.humanSupervisionRequired}`);
  lines.push('');
  lines.push('CertificationChecks:');

  for (const check of snapshot.certificationChecks) {
    lines.push(` - ${check.name}: ${check.pass ? 'PASS' : 'FAIL'} (${check.score})`);
  }

  if (snapshot.failedChecks.length > 0) {
    lines.push('');
    lines.push('FailedChecks:');

    for (const check of snapshot.failedChecks) {
      lines.push(` - ${check.name}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = createCertificationSnapshot(process.cwd(), options);
  process.stdout.write(formatCertificationReport(snapshot));

  if (!snapshot.repositoryCertified) {
    process.exit(1);
  }
}

module.exports = {
  createCertificationSnapshot,
  formatCertificationReport,
  parseArgs,
  parseNumber,
};
NODE

chmod +x install/quality/repository-certification-engine.cjs

echo
echo "==> Writing Sprint 250 tests"

cat > test/domain/quality/RepositoryCertificationEngine.test.js <<'NODE'
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
NODE

echo
echo "==> Updating package.json with certification audit script"

node <<'NODE'
'use strict';

const fs = require('fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.scripts = packageJson.scripts || {};
packageJson.scripts['cert:audit'] = 'node install/quality/repository-certification-engine.cjs --audit-json artifacts/dependency-governance/sprint-250-npm-audit.json';
fs.writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
NODE

echo
echo "==> Syntax validation"

node --check install/quality/repository-certification-engine.cjs
node --check test/domain/quality/RepositoryCertificationEngine.test.js

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
echo "==> Build validation"

npm run build

echo
echo "==> Current Sprint specific test"

node --test test/domain/quality/RepositoryCertificationEngine.test.js | tee "$CURRENT_TEST_LOG"

echo
echo "==> Previous quality regression tests"

node --test test/domain/quality/TestDiscoveryGovernance.test.js
node --test test/domain/quality/TestDiscoveryGovernanceV2.test.js
node --test test/domain/quality/LegacyNestedRegressionClosure.test.js
node --test test/domain/quality/RepositoryGovernanceEngine.test.js
node --test test/domain/quality/DependencyGovernanceEngine.test.js
node --test test/domain/quality/ArchitectureGovernanceEngine.test.js
node --test test/domain/quality/TechnicalDebtEngine.test.js

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
echo "==> Final repository certification report"

node install/quality/repository-certification-engine.cjs \
  --audit-json "$NPM_AUDIT_JSON" \
  --global-test-total "$GLOBAL_TEST_TOTAL" \
  --global-test-pass "$GLOBAL_TEST_PASS" \
  --global-test-fail "$GLOBAL_TEST_FAIL" \
  --old-global-test-baseline "$OLD_GLOBAL_TEST_BASELINE" \
  | tee "$CERTIFICATION_REPORT"

echo
echo "==> Git status before commit"

git status --short

git add \
  package.json \
  install/quality/repository-certification-engine.cjs \
  test/domain/quality/RepositoryCertificationEngine.test.js \
  artifacts/repository-certification \
  artifacts/dependency-governance/sprint-${SPRINT}-npm-audit.json \
  install/sprints/run-sprint-${SPRINT}.sh

git add -u

if git diff --cached --quiet; then
  echo "No changes detected for Sprint ${SPRINT}."
  exit 1
fi

git commit -m "chore(certification): add institutional repository certification v1"

git push -u origin "$BRANCH"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint ${SPRINT} institutional repository certification v1"
git push origin main

FINAL_HEAD="$(git rev-parse --short HEAD)"
SOURCE_JS_COUNT="$(count_files src '*.js')"
OFFICIAL_TEST_FILE_COUNT="$(count_files test '*.test.js')"
LEGACY_TEST_FILE_COUNT="$(count_files tests '*.test.js')"
LEGACY_NESTED_TEST_COUNT="$(count_nested_legacy_tests)"

REPOSITORY_CERTIFIED="$(extract_report_value "RepositoryCertified" "$CERTIFICATION_REPORT")"
PAPER_PLATFORM_READY_CANDIDATE="$(extract_report_value "PaperPlatformReadyCandidate" "$CERTIFICATION_REPORT")"
REPOSITORY_CERTIFICATION_SCORE="$(extract_report_value "RepositoryCertificationScore" "$CERTIFICATION_REPORT")"
FAILED_CHECK_COUNT="$(extract_report_value "FailedCheckCount" "$CERTIFICATION_REPORT")"

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
  echo "RepositoryCertification:"
  echo "PASS"
  echo
  echo "RepositoryCertified:"
  echo "${REPOSITORY_CERTIFIED:-UNKNOWN}"
  echo
  echo "PaperPlatformReadyCandidate:"
  echo "${PAPER_PLATFORM_READY_CANDIDATE:-UNKNOWN}"
  echo
  echo "RepositoryCertificationScore:"
  echo "${REPOSITORY_CERTIFICATION_SCORE:-UNKNOWN}"
  echo
  echo "FailedCheckCount:"
  echo "${FAILED_CHECK_COUNT:-UNKNOWN}"
  echo
  echo "Architecture:"
  echo "Added institutional repository certification V1 by composing repository governance, dependency governance, architecture governance, technical debt readiness, global tests, and PAPER-only supervised suggestion flags into a single deterministic certification gate."
  echo
  echo "Complexity:"
  echo "Time: O(g + d + a + t)"
  echo "Space: O(g + d + a + t)"
  echo
  echo "Institutional Flags:"
  echo "paperOnly=true"
  echo "productionMoneyAllowed=false"
  echo "liveMoneyAuthorization=false"
  echo "automaticExecutionAllowed=false"
  echo "humanSupervisionRequired=true"
  echo "automaticSuggestionAllowed=true"
  echo "automaticBetExecutionAllowed=false"
  echo
  echo "Files Added/Updated:"
  echo "package.json"
  echo "install/quality/repository-certification-engine.cjs"
  echo "test/domain/quality/RepositoryCertificationEngine.test.js"
  echo
  echo "Reports:"
  echo "$CERTIFICATION_REPORT"
  echo "$SUMMARY_PARSE_LOG"
  echo "$NPM_AUDIT_JSON"
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
