#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="244"
NAME="Test Discovery Governance & Summary Parser V5"
BRANCH="sprint-244-test-discovery-governance-summary-parser"
OLD_GLOBAL_TEST_BASELINE="1323"

if ! PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: Git repository root not found."
  exit 1
fi

cd "$PROJECT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p logs artifacts/logs artifacts/test-discovery install/quality install/sprints test/domain/quality

LOG_FILE="logs/sprint-${SPRINT}-${TIMESTAMP}.log"
SUCCESS_SUMMARY="artifacts/logs/sprint-${SPRINT}-success-summary.txt"
FAILURE_SUMMARY="artifacts/logs/sprint-${SPRINT}-failure-summary.txt"
GLOBAL_TEST_LOG="logs/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log"
CURRENT_TEST_LOG="logs/sprint-${SPRINT}-current-test-${TIMESTAMP}.log"
DISCOVERY_AUDIT_LOG="artifacts/test-discovery/sprint-${SPRINT}-test-discovery-audit.txt"
SUMMARY_PARSE_LOG="artifacts/test-discovery/sprint-${SPRINT}-parsed-node-test-summary.txt"
DEBUG_TAIL_LOG="artifacts/test-discovery/sprint-${SPRINT}-failure-log-tail.txt"

exec > >(tee -a "$LOG_FILE") 2>&1

write_failure_summary() {
  local exit_code="$?"
  tail -160 "$LOG_FILE" > "$DEBUG_TAIL_LOG" 2>/dev/null || true

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
echo "==> Recovery from failed previous attempts"

git fetch origin main

if [ "$(git branch --show-current || true)" != "main" ]; then
  git checkout main -f
fi

git reset --hard origin/main

if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git branch -D "$BRANCH"
fi

rm -rf artifacts/test-discovery
rm -f test/domain/quality/TestDiscoveryGovernanceV2.test.js

mkdir -p artifacts/test-discovery install/quality test/domain/quality

PREVIOUS_HEAD="$(git rev-parse --short HEAD)"
git checkout -b "$BRANCH"
BASE_HEAD="$(git rev-parse --short HEAD)"

echo
echo "==> Writing test discovery governance module"

cat > install/quality/test-discovery-governance.cjs <<'NODE'
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function existsDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch (_) {
    return false;
  }
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function collectTopLevelLegacyTests(rootDir) {
  const baseDir = rootDir || process.cwd();
  const legacyRoot = path.join(baseDir, 'tests');

  if (!existsDirectory(legacyRoot)) {
    return [];
  }

  return fs
    .readdirSync(legacyRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
    .map((entry) => path.join('tests', entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function collectRecursiveTests(rootDir, relativeDirectory) {
  const baseDir = rootDir || process.cwd();
  const targetRoot = path.join(baseDir, relativeDirectory);

  if (!existsDirectory(targetRoot)) {
    return [];
  }

  const stack = [targetRoot];
  const files = [];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.sort((left, right) => right.name.localeCompare(left.name));

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
        files.push(path.relative(baseDir, absolutePath));
      }
    }
  }

  return uniqueSorted(files);
}

function collectInstitutionalTests(rootDir) {
  return collectRecursiveTests(rootDir || process.cwd(), 'test');
}

function collectAllLegacyTests(rootDir) {
  return collectRecursiveTests(rootDir || process.cwd(), 'tests');
}

function collectNestedLegacyTests(rootDir) {
  const baseDir = rootDir || process.cwd();
  const topLevel = new Set(collectTopLevelLegacyTests(baseDir));

  return collectAllLegacyTests(baseDir).filter((file) => !topLevel.has(file));
}

function discoverOfficialTestFiles(rootDir) {
  const baseDir = rootDir || process.cwd();

  return uniqueSorted([
    ...collectTopLevelLegacyTests(baseDir),
    ...collectInstitutionalTests(baseDir),
  ]);
}

function createDiscoverySnapshot(rootDir) {
  const baseDir = rootDir || process.cwd();
  const topLevelLegacyTests = collectTopLevelLegacyTests(baseDir);
  const institutionalTests = collectInstitutionalTests(baseDir);
  const nestedLegacyTests = collectNestedLegacyTests(baseDir);
  const officialTestFiles = uniqueSorted([...topLevelLegacyTests, ...institutionalTests]);

  return Object.freeze({
    rootDir: baseDir,
    officialPolicy: 'tests top-level plus institutional recursive tests',
    nestedLegacyPolicy: 'diagnostic-only',
    officialTestFileCount: officialTestFiles.length,
    topLevelLegacyTestCount: topLevelLegacyTests.length,
    institutionalTestCount: institutionalTests.length,
    nestedLegacyTestCount: nestedLegacyTests.length,
    officialTestFiles,
    topLevelLegacyTests,
    institutionalTests,
    nestedLegacyTests,
  });
}

module.exports = {
  collectTopLevelLegacyTests,
  collectInstitutionalTests,
  collectAllLegacyTests,
  collectNestedLegacyTests,
  createDiscoverySnapshot,
  discoverOfficialTestFiles,
  uniqueSorted,
};
NODE

chmod +x install/quality/test-discovery-governance.cjs

echo
echo "==> Writing official governed test runner"

cat > install/quality/run-all-tests.cjs <<'NODE'
#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const { createDiscoverySnapshot } = require('./test-discovery-governance.cjs');

const ROOT_DIR = process.cwd();
const snapshot = createDiscoverySnapshot(ROOT_DIR);

if (snapshot.officialTestFiles.length === 0) {
  console.error('No official test files discovered.');
  process.exit(1);
}

console.log('RL.SYS CORE Test Discovery Governance');
console.log(`OfficialPolicy: ${snapshot.officialPolicy}`);
console.log(`NestedLegacyPolicy: ${snapshot.nestedLegacyPolicy}`);
console.log(`DiscoveredTestFiles: ${snapshot.officialTestFileCount}`);
console.log(`TopLevelLegacyTestCount: ${snapshot.topLevelLegacyTestCount}`);
console.log(`InstitutionalTestCount: ${snapshot.institutionalTestCount}`);
console.log(`NestedLegacyTestCount: ${snapshot.nestedLegacyTestCount}`);

const result = spawnSync(process.execPath, ['--test', ...snapshot.officialTestFiles], {
  stdio: 'inherit',
  cwd: ROOT_DIR,
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
NODE

chmod +x install/quality/run-all-tests.cjs

echo
echo "==> Writing robust Node test summary parser"

cat > install/quality/parse-node-test-summary.cjs <<'NODE'
#!/usr/bin/env node
'use strict';

const fs = require('fs');

const SUMMARY_KEYS = new Set([
  'tests',
  'suites',
  'pass',
  'fail',
  'cancelled',
  'skipped',
  'todo',
  'duration_ms',
]);

function parseNumericValue(rawValue) {
  const parsed = Number(String(rawValue).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSummaryLine(line) {
  return String(line || '')
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/^ℹ\s*/, '')
    .replace(/^info\s+/i, '');
}

function parseNodeTestSummary(rawOutput) {
  const summary = {
    tests: null,
    suites: null,
    pass: null,
    fail: null,
    cancelled: null,
    skipped: null,
    todo: null,
    duration_ms: null,
  };

  const lines = String(rawOutput || '').split(/\r?\n/);

  for (const line of lines) {
    const normalized = normalizeSummaryLine(line);
    const match = normalized.match(/^([a-z_]+)\s+([0-9]+(?:\.[0-9]+)?)$/i);

    if (!match) {
      continue;
    }

    const key = match[1].toLowerCase();

    if (!SUMMARY_KEYS.has(key)) {
      continue;
    }

    summary[key] = parseNumericValue(match[2]);
  }

  return summary;
}

function formatSummaryLines(summary) {
  return [
    `GlobalTestTotal=${summary.tests === null ? 'UNKNOWN' : summary.tests}`,
    `GlobalTestPass=${summary.pass === null ? 'UNKNOWN' : summary.pass}`,
    `GlobalTestFail=${summary.fail === null ? 'UNKNOWN' : summary.fail}`,
  ];
}

if (require.main === module) {
  const filePath = process.argv[2];
  const input = filePath ? fs.readFileSync(filePath, 'utf8') : fs.readFileSync(0, 'utf8');
  const summary = parseNodeTestSummary(input);

  for (const line of formatSummaryLines(summary)) {
    console.log(line);
  }
}

module.exports = {
  parseNodeTestSummary,
  formatSummaryLines,
  normalizeSummaryLine,
};
NODE

chmod +x install/quality/parse-node-test-summary.cjs

echo
echo "==> Writing test discovery audit CLI"

cat > install/quality/audit-test-discovery.cjs <<'NODE'
#!/usr/bin/env node
'use strict';

const { createDiscoverySnapshot } = require('./test-discovery-governance.cjs');

function printSnapshot(snapshot) {
  console.log('RL.SYS CORE Test Discovery Audit');
  console.log(`OfficialPolicy: ${snapshot.officialPolicy}`);
  console.log(`NestedLegacyPolicy: ${snapshot.nestedLegacyPolicy}`);
  console.log(`OfficialTestFileCount: ${snapshot.officialTestFileCount}`);
  console.log(`TopLevelLegacyTestCount: ${snapshot.topLevelLegacyTestCount}`);
  console.log(`InstitutionalTestCount: ${snapshot.institutionalTestCount}`);
  console.log(`NestedLegacyTestCount: ${snapshot.nestedLegacyTestCount}`);

  if (snapshot.nestedLegacyTests.length > 0) {
    console.log('NestedLegacyTests:');

    for (const file of snapshot.nestedLegacyTests) {
      console.log(` - ${file}`);
    }
  }
}

if (require.main === module) {
  printSnapshot(createDiscoverySnapshot(process.cwd()));
}

module.exports = { printSnapshot };
NODE

chmod +x install/quality/audit-test-discovery.cjs

echo
echo "==> Writing Sprint 244 tests"

cat > test/domain/quality/TestDiscoveryGovernanceV2.test.js <<'NODE'
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  createDiscoverySnapshot,
  discoverOfficialTestFiles,
  collectNestedLegacyTests,
} = require('../../../install/quality/test-discovery-governance.cjs');

const {
  parseNodeTestSummary,
  formatSummaryLines,
  normalizeSummaryLine,
} = require('../../../install/quality/parse-node-test-summary.cjs');

test('test discovery governance V2 exposes deterministic official contract', () => {
  const snapshot = createDiscoverySnapshot(process.cwd());

  assert.equal(snapshot.officialPolicy, 'tests top-level plus institutional recursive tests');
  assert.equal(snapshot.nestedLegacyPolicy, 'diagnostic-only');
  assert.ok(snapshot.officialTestFileCount > 0);
  assert.equal(snapshot.officialTestFileCount, snapshot.officialTestFiles.length);
  assert.deepEqual(snapshot.officialTestFiles, discoverOfficialTestFiles(process.cwd()));
});

test('nested legacy tests remain diagnostic-only and outside official discovery', () => {
  const snapshot = createDiscoverySnapshot(process.cwd());
  const nestedLegacyTests = collectNestedLegacyTests(process.cwd());
  const official = new Set(snapshot.officialTestFiles);

  assert.deepEqual(snapshot.nestedLegacyTests, nestedLegacyTests);

  for (const nestedTest of nestedLegacyTests) {
    assert.equal(official.has(nestedTest), false);
  }
});

test('official runner exists and depends on shared discovery governance', () => {
  const runner = fs.readFileSync('install/quality/run-all-tests.cjs', 'utf8');

  assert.match(runner, /test-discovery-governance\.cjs/);
  assert.match(runner, /createDiscoverySnapshot/);
});

test('node test summary parser handles TAP hash summary output', () => {
  const parsed = parseNodeTestSummary(`
# tests 1323
# suites 0
# pass 1323
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9850.42
`);

  assert.equal(parsed.tests, 1323);
  assert.equal(parsed.pass, 1323);
  assert.equal(parsed.fail, 0);
  assert.deepEqual(formatSummaryLines(parsed), [
    'GlobalTestTotal=1323',
    'GlobalTestPass=1323',
    'GlobalTestFail=0',
  ]);
});

test('node test summary parser handles Node 24 info symbol summary output', () => {
  assert.equal(normalizeSummaryLine('ℹ tests 1327'), 'tests 1327');

  const parsed = parseNodeTestSummary(`
ℹ tests 1327
ℹ suites 0
ℹ pass 1327
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 22292.274129
`);

  assert.equal(parsed.tests, 1327);
  assert.equal(parsed.pass, 1327);
  assert.equal(parsed.fail, 0);
  assert.deepEqual(formatSummaryLines(parsed), [
    'GlobalTestTotal=1327',
    'GlobalTestPass=1327',
    'GlobalTestFail=0',
  ]);
});
NODE

echo
echo "==> Ensuring package.json uses governed runner"

node <<'NODE'
'use strict';

const fs = require('fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.scripts = packageJson.scripts || {};
packageJson.scripts.test = 'node install/quality/run-all-tests.cjs';
packageJson.scripts['test:audit'] = 'node install/quality/audit-test-discovery.cjs';
fs.writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
NODE

echo
echo "==> Syntax validation"

node --check install/quality/test-discovery-governance.cjs
node --check install/quality/run-all-tests.cjs
node --check install/quality/parse-node-test-summary.cjs
node --check install/quality/audit-test-discovery.cjs
node --check test/domain/quality/TestDiscoveryGovernanceV2.test.js

echo
echo "==> Test discovery audit"

node install/quality/audit-test-discovery.cjs | tee "$DISCOVERY_AUDIT_LOG"

echo
echo "==> Installing dependencies"

npm ci

echo
echo "==> Build validation"

npm run build

echo
echo "==> Current Sprint specific test"

node --test test/domain/quality/TestDiscoveryGovernanceV2.test.js | tee "$CURRENT_TEST_LOG"

echo
echo "==> Previous quality regression test"

node --test test/domain/quality/TestDiscoveryGovernance.test.js

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
  install/quality/test-discovery-governance.cjs \
  install/quality/run-all-tests.cjs \
  install/quality/parse-node-test-summary.cjs \
  install/quality/audit-test-discovery.cjs \
  test/domain/quality/TestDiscoveryGovernanceV2.test.js \
  artifacts/test-discovery \
  install/sprints/run-sprint-${SPRINT}.sh

git add -u

if git diff --cached --quiet; then
  echo "No changes detected for Sprint ${SPRINT}."
  exit 1
fi

git commit -m "test(governance): harden discovery runner and summary parser"

git push -u origin "$BRANCH"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint ${SPRINT} test discovery governance summary parser"
git push origin main

FINAL_HEAD="$(git rev-parse --short HEAD)"
SOURCE_JS_COUNT="$(count_files src '*.js')"
OFFICIAL_TEST_FILE_COUNT="$(count_files test '*.test.js')"
LEGACY_TEST_FILE_COUNT="$(count_files tests '*.test.js')"
LEGACY_NESTED_TEST_COUNT="$(count_nested_legacy_tests)"

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
  echo "PreviousQualityRegressionTest:"
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
  echo "Architecture:"
  echo "Centralized O(n) iterative test discovery, restored official runner, non-gating nested legacy audit, and robust Node TAP summary parser compatible with hash and Node 24 info-symbol summaries."
  echo
  echo "Complexity:"
  echo "Time: O(t + l)"
  echo "Space: O(t + l)"
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
  echo "install/quality/test-discovery-governance.cjs"
  echo "install/quality/run-all-tests.cjs"
  echo "install/quality/parse-node-test-summary.cjs"
  echo "install/quality/audit-test-discovery.cjs"
  echo "test/domain/quality/TestDiscoveryGovernanceV2.test.js"
  echo
  echo "Reports:"
  echo "$DISCOVERY_AUDIT_LOG"
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

cat "$SUCCESS_SUMMARY"

echo
echo "Sprint ${SPRINT} completed successfully."
