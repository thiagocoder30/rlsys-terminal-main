#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="249"
NAME="Institutional Technical Debt Engine"
BRANCH="sprint-249-institutional-technical-debt-engine"
OLD_GLOBAL_TEST_BASELINE="1344"

if ! PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: Git repository root not found."
  exit 1
fi

cd "$PROJECT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p \
  logs \
  artifacts/logs \
  artifacts/technical-debt \
  install/quality \
  install/sprints \
  test/domain/quality

LOG_FILE="logs/sprint-${SPRINT}-${TIMESTAMP}.log"
SUCCESS_SUMMARY="artifacts/logs/sprint-${SPRINT}-success-summary.txt"
FAILURE_SUMMARY="artifacts/logs/sprint-${SPRINT}-failure-summary.txt"
GLOBAL_TEST_LOG="logs/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log"
CURRENT_TEST_LOG="logs/sprint-${SPRINT}-current-test-${TIMESTAMP}.log"
TECHNICAL_DEBT_REPORT="artifacts/technical-debt/sprint-${SPRINT}-technical-debt-report.txt"
SUMMARY_PARSE_LOG="artifacts/technical-debt/sprint-${SPRINT}-parsed-node-test-summary.txt"
DEBUG_TAIL_LOG="artifacts/technical-debt/sprint-${SPRINT}-failure-log-tail.txt"

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

rm -rf artifacts/technical-debt
rm -f install/quality/technical-debt-engine.cjs
rm -f test/domain/quality/TechnicalDebtEngine.test.js

mkdir -p artifacts/technical-debt install/quality test/domain/quality

PREVIOUS_HEAD="$(git rev-parse --short HEAD)"
git checkout -b "$BRANCH"
BASE_HEAD="$(git rev-parse --short HEAD)"

echo
echo "==> Writing Institutional Technical Debt Engine"

cat > install/quality/technical-debt-engine.cjs <<'NODE'
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function isDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch (_) {
    return false;
  }
}

function existsFile(targetPath) {
  try {
    return fs.statSync(targetPath).isFile();
  } catch (_) {
    return false;
  }
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function collectFiles(rootDir, directories, predicate) {
  const baseDir = rootDir || process.cwd();
  const files = [];

  for (const relativeDirectory of directories) {
    const absoluteRoot = path.join(baseDir, relativeDirectory);

    if (!isDirectory(absoluteRoot)) {
      continue;
    }

    const stack = [absoluteRoot];

    while (stack.length > 0) {
      const current = stack.pop();
      const entries = fs.readdirSync(current, { withFileTypes: true });

      entries.sort((left, right) => right.name.localeCompare(left.name));

      for (const entry of entries) {
        const absolutePath = path.join(current, entry.name);
        const relativePath = path.relative(baseDir, absolutePath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (
            relativePath.startsWith('docs/archive') ||
            relativePath === 'node_modules' ||
            relativePath === 'dist' ||
            relativePath === 'coverage'
          ) {
            continue;
          }

          stack.push(absolutePath);
        } else if (entry.isFile() && predicate(relativePath)) {
          files.push(relativePath);
        }
      }
    }
  }

  return uniqueSorted(files);
}

function readLines(rootDir, relativePath) {
  try {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8').split(/\r?\n/);
  } catch (_) {
    return [];
  }
}

function countTopLevelLegacyTests(rootDir) {
  const testsRoot = path.join(rootDir, 'tests');

  if (!isDirectory(testsRoot)) {
    return 0;
  }

  return fs
    .readdirSync(testsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js')).length;
}

function countNestedLegacyTests(rootDir) {
  const testsRoot = path.join(rootDir, 'tests');

  if (!isDirectory(testsRoot)) {
    return 0;
  }

  const stack = [testsRoot];
  let count = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith('.test.js') && relativePath.split('/').length > 2) {
        count += 1;
      }
    }
  }

  return count;
}

function inspectPackageScripts(rootDir) {
  const packagePath = path.join(rootDir, 'package.json');

  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
    const requiredScripts = ['build', 'test', 'test:audit', 'deps:audit', 'arch:audit'];
    const missingScripts = requiredScripts.filter((scriptName) => !scripts[scriptName]);

    return Object.freeze({
      valid: true,
      requiredScripts,
      missingScripts,
      scriptCount: Object.keys(scripts).length,
    });
  } catch (_) {
    return Object.freeze({
      valid: false,
      requiredScripts: ['build', 'test', 'test:audit', 'deps:audit', 'arch:audit'],
      missingScripts: ['package.json-invalid'],
      scriptCount: 0,
    });
  }
}

function analyzeTextDebt(rootDir, files) {
  const oversizedFiles = [];
  const longLineFiles = [];
  const todoFiles = [];
  const consoleFiles = [];
  let totalLineCount = 0;
  let longLineCount = 0;
  let todoCount = 0;
  let consoleUsageCount = 0;

  for (const file of files) {
    const lines = readLines(rootDir, file);
    let fileHasLongLine = false;
    let fileHasTodo = false;
    let fileHasConsole = false;

    totalLineCount += lines.length;

    for (const line of lines) {
      if (line.length > 180) {
        longLineCount += 1;
        fileHasLongLine = true;
      }

      if (/\b(TODO|FIXME|HACK)\b/i.test(line)) {
        todoCount += 1;
        fileHasTodo = true;
      }

      if (file.startsWith('src/') && /\bconsole\.(log|warn|error|info|debug)\s*\(/.test(line)) {
        consoleUsageCount += 1;
        fileHasConsole = true;
      }
    }

    if (lines.length > 450) {
      oversizedFiles.push(`${file}:${lines.length}`);
    }

    if (fileHasLongLine) {
      longLineFiles.push(file);
    }

    if (fileHasTodo) {
      todoFiles.push(file);
    }

    if (fileHasConsole) {
      consoleFiles.push(file);
    }
  }

  return Object.freeze({
    totalLineCount,
    longLineCount,
    todoCount,
    consoleUsageCount,
    oversizedFileCount: oversizedFiles.length,
    oversizedFiles: uniqueSorted(oversizedFiles),
    longLineFileCount: longLineFiles.length,
    longLineFiles: uniqueSorted(longLineFiles),
    todoFileCount: todoFiles.length,
    todoFiles: uniqueSorted(todoFiles),
    consoleFileCount: consoleFiles.length,
    consoleFiles: uniqueSorted(consoleFiles),
  });
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function createTechnicalDebtSnapshot(rootDir) {
  const baseDir = rootDir || process.cwd();
  const sourceFiles = collectFiles(baseDir, ['src'], (file) => file.endsWith('.js'));
  const institutionalTests = collectFiles(baseDir, ['test'], (file) => file.endsWith('.test.js'));
  const topLevelLegacyTests = countTopLevelLegacyTests(baseDir);
  const nestedLegacyTests = countNestedLegacyTests(baseDir);
  const qualityFiles = collectFiles(baseDir, ['install/quality'], (file) => file.endsWith('.cjs'));
  const governedFiles = uniqueSorted([...sourceFiles, ...institutionalTests, ...qualityFiles]);
  const textDebt = analyzeTextDebt(baseDir, governedFiles);
  const packageScripts = inspectPackageScripts(baseDir);

  const sourceToTestRatio = sourceFiles.length === 0
    ? 0
    : (institutionalTests.length + topLevelLegacyTests) / sourceFiles.length;

  const hardViolations = [];

  if (sourceFiles.length === 0) {
    hardViolations.push('no source files discovered');
  }

  if (institutionalTests.length === 0) {
    hardViolations.push('no institutional tests discovered');
  }

  if (nestedLegacyTests > 0) {
    hardViolations.push(`nested legacy tests still present: ${nestedLegacyTests}`);
  }

  if (!packageScripts.valid) {
    hardViolations.push('package.json invalid');
  }

  if (packageScripts.missingScripts.length > 0) {
    hardViolations.push(`missing governance scripts: ${packageScripts.missingScripts.join(', ')}`);
  }

  const technicalDebtPenalty =
    textDebt.todoCount * 2 +
    textDebt.longLineCount +
    textDebt.oversizedFileCount * 5 +
    textDebt.consoleUsageCount * 4 +
    hardViolations.length * 20;

  const technicalDebtScore = clampScore(100 - technicalDebtPenalty);
  const maintainabilityScore = clampScore(
    100 -
      textDebt.oversizedFileCount * 4 -
      Math.min(25, textDebt.longLineCount) -
      Math.max(0, 2 - sourceToTestRatio) * 10
  );
  const repositoryReadinessScore = clampScore(
    (technicalDebtScore * 0.35) +
      (maintainabilityScore * 0.35) +
      (hardViolations.length === 0 ? 30 : 0)
  );

  return Object.freeze({
    rootDir: baseDir,
    sourceFileCount: sourceFiles.length,
    institutionalTestFileCount: institutionalTests.length,
    topLevelLegacyTestCount: topLevelLegacyTests,
    nestedLegacyTestCount: nestedLegacyTests,
    qualityFileCount: qualityFiles.length,
    governedFileCount: governedFiles.length,
    totalLineCount: textDebt.totalLineCount,
    todoCount: textDebt.todoCount,
    todoFileCount: textDebt.todoFileCount,
    longLineCount: textDebt.longLineCount,
    longLineFileCount: textDebt.longLineFileCount,
    oversizedFileCount: textDebt.oversizedFileCount,
    consoleUsageCount: textDebt.consoleUsageCount,
    sourceToTestRatio,
    packageScriptCount: packageScripts.scriptCount,
    missingScriptCount: packageScripts.missingScripts.length,
    hardViolationCount: hardViolations.length,
    hardViolations,
    technicalDebtScore,
    maintainabilityScore,
    repositoryReadinessScore,
    status: hardViolations.length === 0 ? 'PASS' : 'NEEDS_REVIEW',
    paperOnly: true,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    automaticSuggestionAllowed: true,
    automaticBetExecutionAllowed: false,
    humanSupervisionRequired: true,
  });
}

function formatTechnicalDebtReport(snapshot) {
  const lines = [];

  lines.push('RL.SYS CORE Technical Debt Report');
  lines.push(`Status: ${snapshot.status}`);
  lines.push(`TechnicalDebtScore: ${snapshot.technicalDebtScore}`);
  lines.push(`MaintainabilityScore: ${snapshot.maintainabilityScore}`);
  lines.push(`RepositoryReadinessScore: ${snapshot.repositoryReadinessScore}`);
  lines.push(`SourceFileCount: ${snapshot.sourceFileCount}`);
  lines.push(`InstitutionalTestFileCount: ${snapshot.institutionalTestFileCount}`);
  lines.push(`TopLevelLegacyTestCount: ${snapshot.topLevelLegacyTestCount}`);
  lines.push(`NestedLegacyTestCount: ${snapshot.nestedLegacyTestCount}`);
  lines.push(`QualityFileCount: ${snapshot.qualityFileCount}`);
  lines.push(`GovernedFileCount: ${snapshot.governedFileCount}`);
  lines.push(`TotalLineCount: ${snapshot.totalLineCount}`);
  lines.push(`TodoCount: ${snapshot.todoCount}`);
  lines.push(`LongLineCount: ${snapshot.longLineCount}`);
  lines.push(`OversizedFileCount: ${snapshot.oversizedFileCount}`);
  lines.push(`ConsoleUsageCount: ${snapshot.consoleUsageCount}`);
  lines.push(`SourceToTestRatio: ${snapshot.sourceToTestRatio.toFixed(2)}`);
  lines.push(`PackageScriptCount: ${snapshot.packageScriptCount}`);
  lines.push(`MissingScriptCount: ${snapshot.missingScriptCount}`);
  lines.push(`HardViolationCount: ${snapshot.hardViolationCount}`);
  lines.push(`PaperOnly: ${snapshot.paperOnly}`);
  lines.push(`ProductionMoneyAllowed: ${snapshot.productionMoneyAllowed}`);
  lines.push(`LiveMoneyAuthorization: ${snapshot.liveMoneyAuthorization}`);
  lines.push(`AutomaticExecutionAllowed: ${snapshot.automaticExecutionAllowed}`);
  lines.push(`AutomaticSuggestionAllowed: ${snapshot.automaticSuggestionAllowed}`);
  lines.push(`AutomaticBetExecutionAllowed: ${snapshot.automaticBetExecutionAllowed}`);
  lines.push(`HumanSupervisionRequired: ${snapshot.humanSupervisionRequired}`);

  if (snapshot.hardViolations.length > 0) {
    lines.push('');
    lines.push('HardViolations:');

    for (const violation of snapshot.hardViolations) {
      lines.push(` - ${violation}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  const snapshot = createTechnicalDebtSnapshot(process.cwd());
  process.stdout.write(formatTechnicalDebtReport(snapshot));

  if (snapshot.status !== 'PASS') {
    process.exit(1);
  }
}

module.exports = {
  analyzeTextDebt,
  clampScore,
  collectFiles,
  createTechnicalDebtSnapshot,
  formatTechnicalDebtReport,
  inspectPackageScripts,
  uniqueSorted,
};
NODE

chmod +x install/quality/technical-debt-engine.cjs

echo
echo "==> Writing Sprint 249 tests"

cat > test/domain/quality/TechnicalDebtEngine.test.js <<'NODE'
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
NODE

echo
echo "==> Updating package.json with technical debt audit script"

node <<'NODE'
'use strict';

const fs = require('fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.scripts = packageJson.scripts || {};
packageJson.scripts['debt:audit'] = 'node install/quality/technical-debt-engine.cjs';
fs.writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
NODE

echo
echo "==> Syntax validation"

node --check install/quality/technical-debt-engine.cjs
node --check test/domain/quality/TechnicalDebtEngine.test.js

echo
echo "==> Technical debt report"

node install/quality/technical-debt-engine.cjs | tee "$TECHNICAL_DEBT_REPORT"

echo
echo "==> Installing dependencies"

npm ci

echo
echo "==> Build validation"

npm run build

echo
echo "==> Current Sprint specific test"

node --test test/domain/quality/TechnicalDebtEngine.test.js | tee "$CURRENT_TEST_LOG"

echo
echo "==> Previous quality regression tests"

node --test test/domain/quality/TestDiscoveryGovernance.test.js
node --test test/domain/quality/TestDiscoveryGovernanceV2.test.js
node --test test/domain/quality/LegacyNestedRegressionClosure.test.js
node --test test/domain/quality/RepositoryGovernanceEngine.test.js
node --test test/domain/quality/DependencyGovernanceEngine.test.js
node --test test/domain/quality/ArchitectureGovernanceEngine.test.js

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
  install/quality/technical-debt-engine.cjs \
  test/domain/quality/TechnicalDebtEngine.test.js \
  artifacts/technical-debt \
  install/sprints/run-sprint-${SPRINT}.sh

git add -u

if git diff --cached --quiet; then
  echo "No changes detected for Sprint ${SPRINT}."
  exit 1
fi

git commit -m "chore(governance): add institutional technical debt engine"

git push -u origin "$BRANCH"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint ${SPRINT} institutional technical debt engine"
git push origin main

FINAL_HEAD="$(git rev-parse --short HEAD)"
SOURCE_JS_COUNT="$(count_files src '*.js')"
OFFICIAL_TEST_FILE_COUNT="$(count_files test '*.test.js')"
LEGACY_TEST_FILE_COUNT="$(count_files tests '*.test.js')"
LEGACY_NESTED_TEST_COUNT="$(count_nested_legacy_tests)"

TECHNICAL_DEBT_SCORE="$(extract_report_value "TechnicalDebtScore" "$TECHNICAL_DEBT_REPORT")"
MAINTAINABILITY_SCORE="$(extract_report_value "MaintainabilityScore" "$TECHNICAL_DEBT_REPORT")"
REPOSITORY_READINESS_SCORE="$(extract_report_value "RepositoryReadinessScore" "$TECHNICAL_DEBT_REPORT")"
HARD_VIOLATION_COUNT="$(extract_report_value "HardViolationCount" "$TECHNICAL_DEBT_REPORT")"

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
  echo "TechnicalDebt:"
  echo "PASS"
  echo
  echo "TechnicalDebtScore:"
  echo "${TECHNICAL_DEBT_SCORE:-UNKNOWN}"
  echo
  echo "MaintainabilityScore:"
  echo "${MAINTAINABILITY_SCORE:-UNKNOWN}"
  echo
  echo "RepositoryReadinessScore:"
  echo "${REPOSITORY_READINESS_SCORE:-UNKNOWN}"
  echo
  echo "HardViolationCount:"
  echo "${HARD_VIOLATION_COUNT:-UNKNOWN}"
  echo
  echo "Architecture:"
  echo "Added institutional technical debt scoring with iterative O(n) repository scanning for TODO/FIXME/HACK markers, oversized files, long lines, source console usage, script readiness, test structure, and paper-only certification flags."
  echo
  echo "Complexity:"
  echo "Time: O(f + l)"
  echo "Space: O(f)"
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
  echo "install/quality/technical-debt-engine.cjs"
  echo "test/domain/quality/TechnicalDebtEngine.test.js"
  echo
  echo "Reports:"
  echo "$TECHNICAL_DEBT_REPORT"
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
