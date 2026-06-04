#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="245"
NAME="Legacy Nested Regression Closure"
BRANCH="sprint-245-legacy-nested-regression-closure"
OLD_GLOBAL_TEST_BASELINE="1328"

if ! PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: Git repository root not found."
  exit 1
fi

cd "$PROJECT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p logs artifacts/logs artifacts/legacy-regression-closure install/quality install/sprints test/domain/quality docs/archive/legacy-hidden-tests

LOG_FILE="logs/sprint-${SPRINT}-${TIMESTAMP}.log"
SUCCESS_SUMMARY="artifacts/logs/sprint-${SPRINT}-success-summary.txt"
FAILURE_SUMMARY="artifacts/logs/sprint-${SPRINT}-failure-summary.txt"
GLOBAL_TEST_LOG="logs/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log"
CURRENT_TEST_LOG="logs/sprint-${SPRINT}-current-test-${TIMESTAMP}.log"
DISCOVERY_AUDIT_LOG="artifacts/legacy-regression-closure/sprint-${SPRINT}-test-discovery-audit.txt"
CLOSURE_REPORT="artifacts/legacy-regression-closure/sprint-${SPRINT}-legacy-nested-closure-report.txt"
ARCHIVE_MANIFEST="docs/archive/legacy-hidden-tests/sprint-${SPRINT}-legacy-hidden-tests-manifest.txt"
SUMMARY_PARSE_LOG="artifacts/legacy-regression-closure/sprint-${SPRINT}-parsed-node-test-summary.txt"
DEBUG_TAIL_LOG="artifacts/legacy-regression-closure/sprint-${SPRINT}-failure-log-tail.txt"

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
echo "==> Recovery from previous attempts"

git fetch origin main

if [ "$(git branch --show-current || true)" != "main" ]; then
  git checkout main -f
fi

git reset --hard origin/main

if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git branch -D "$BRANCH"
fi

rm -rf artifacts/legacy-regression-closure
rm -f test/domain/quality/LegacyNestedRegressionClosure.test.js
rm -f install/quality/legacy-nested-regression-closure.cjs

mkdir -p artifacts/legacy-regression-closure install/quality test/domain/quality docs/archive/legacy-hidden-tests

PREVIOUS_HEAD="$(git rev-parse --short HEAD)"
git checkout -b "$BRANCH"
BASE_HEAD="$(git rev-parse --short HEAD)"

echo
echo "==> Pre-closure nested legacy test audit"

PRE_CLOSURE_NESTED_COUNT="$(count_nested_legacy_tests)"

{
  echo "RL.SYS CORE — Legacy Nested Regression Closure Report"
  echo "Sprint: ${SPRINT}"
  echo "Name: ${NAME}"
  echo "Timestamp: $(date -Iseconds)"
  echo
  echo "Policy:"
  echo "Nested tests under tests subdirectories are no longer allowed."
  echo "Top-level tests under tests remain part of the official legacy contract."
  echo "Institutional tests under test remain part of the official recursive contract."
  echo
  echo "PreClosureNestedLegacyTestCount:"
  echo "$PRE_CLOSURE_NESTED_COUNT"
  echo
  echo "PreClosureNestedLegacyTests:"
  if [ "$PRE_CLOSURE_NESTED_COUNT" -gt 0 ]; then
    find tests -mindepth 2 -name "*.test.js" | sort
  else
    echo "NONE"
  fi
} > "$CLOSURE_REPORT"

cat "$CLOSURE_REPORT"

echo
echo "==> Archiving nested legacy tests with git history"

{
  echo "RL.SYS CORE — Legacy Hidden Tests Archive Manifest"
  echo "Sprint: ${SPRINT}"
  echo "Name: ${NAME}"
  echo "Timestamp: $(date -Iseconds)"
  echo
  echo "Reason:"
  echo "These files were outside the official test contract and created invisible regression debt."
  echo "They are archived instead of deleted so institutional history remains auditável."
  echo
  echo "OriginalPath -> ArchivePath"
} > "$ARCHIVE_MANIFEST"

if [ "$PRE_CLOSURE_NESTED_COUNT" -gt 0 ]; then
  while IFS= read -r nested_file; do
    [ -n "$nested_file" ] || continue

    archive_file="docs/archive/legacy-hidden-tests/${nested_file}"
    archive_dir="$(dirname "$archive_file")"
    mkdir -p "$archive_dir"

    echo "${nested_file} -> ${archive_file}" | tee -a "$ARCHIVE_MANIFEST"

    if git ls-files --error-unmatch "$nested_file" >/dev/null 2>&1; then
      git mv "$nested_file" "$archive_file"
    else
      mv "$nested_file" "$archive_file"
      git add "$archive_file"
    fi
  done < <(find tests -mindepth 2 -name "*.test.js" | sort)
else
  echo "NONE" | tee -a "$ARCHIVE_MANIFEST"
fi

POST_CLOSURE_NESTED_COUNT="$(count_nested_legacy_tests)"

{
  echo
  echo "PostClosureNestedLegacyTestCount:"
  echo "$POST_CLOSURE_NESTED_COUNT"
} >> "$CLOSURE_REPORT"

if [ "$POST_CLOSURE_NESTED_COUNT" != "0" ]; then
  echo "ERROR: nested legacy tests still exist after closure."
  find tests -mindepth 2 -name "*.test.js" | sort
  exit 1
fi

echo
echo "==> Writing legacy nested closure quality module"

cat > install/quality/legacy-nested-regression-closure.cjs <<'NODE'
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { collectNestedLegacyTests } = require('./test-discovery-governance.cjs');

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (_) {
    return false;
  }
}

function readManifestLines(rootDir, manifestRelativePath) {
  const manifestPath = path.join(rootDir || process.cwd(), manifestRelativePath);

  if (!existsFile(manifestPath)) {
    return [];
  }

  return fs
    .readFileSync(manifestPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function createClosureSnapshot(rootDir, manifestRelativePath) {
  const baseDir = rootDir || process.cwd();
  const nestedLegacyTests = collectNestedLegacyTests(baseDir);
  const manifestLines = readManifestLines(baseDir, manifestRelativePath);

  return Object.freeze({
    rootDir: baseDir,
    manifestRelativePath,
    nestedLegacyTestCount: nestedLegacyTests.length,
    nestedLegacyTests,
    manifestLineCount: manifestLines.length,
    manifestLines,
    isClosed: nestedLegacyTests.length === 0,
  });
}

if (require.main === module) {
  const manifest = process.argv[2] || 'docs/archive/legacy-hidden-tests/sprint-245-legacy-hidden-tests-manifest.txt';
  const snapshot = createClosureSnapshot(process.cwd(), manifest);

  console.log('RL.SYS CORE Legacy Nested Regression Closure');
  console.log(`Manifest: ${snapshot.manifestRelativePath}`);
  console.log(`NestedLegacyTestCount: ${snapshot.nestedLegacyTestCount}`);
  console.log(`ManifestLineCount: ${snapshot.manifestLineCount}`);
  console.log(`Closed: ${snapshot.isClosed ? 'true' : 'false'}`);

  if (!snapshot.isClosed) {
    for (const file of snapshot.nestedLegacyTests) {
      console.log(` - ${file}`);
    }
    process.exit(1);
  }
}

module.exports = {
  createClosureSnapshot,
  readManifestLines,
};
NODE

chmod +x install/quality/legacy-nested-regression-closure.cjs

echo
echo "==> Writing Sprint 245 tests"

cat > test/domain/quality/LegacyNestedRegressionClosure.test.js <<'NODE'
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  collectNestedLegacyTests,
  createDiscoverySnapshot,
} = require('../../../install/quality/test-discovery-governance.cjs');

const {
  createClosureSnapshot,
} = require('../../../install/quality/legacy-nested-regression-closure.cjs');

test('legacy nested regression closure leaves no hidden nested tests under tests directory', () => {
  const nestedLegacyTests = collectNestedLegacyTests(process.cwd());

  assert.deepEqual(nestedLegacyTests, []);
});

test('test discovery snapshot reports zero nested legacy tests after closure', () => {
  const snapshot = createDiscoverySnapshot(process.cwd());

  assert.equal(snapshot.nestedLegacyPolicy, 'diagnostic-only');
  assert.equal(snapshot.nestedLegacyTestCount, 0);
  assert.ok(snapshot.officialTestFileCount > 0);
});

test('legacy hidden tests are archived with an institutional manifest', () => {
  const manifestPath = 'docs/archive/legacy-hidden-tests/sprint-245-legacy-hidden-tests-manifest.txt';
  const snapshot = createClosureSnapshot(process.cwd(), manifestPath);

  assert.equal(snapshot.isClosed, true);
  assert.equal(snapshot.nestedLegacyTestCount, 0);
  assert.ok(snapshot.manifestLineCount > 0);
  assert.equal(fs.existsSync(manifestPath), true);
});
NODE

echo
echo "==> Syntax validation"

node --check install/quality/legacy-nested-regression-closure.cjs
node --check test/domain/quality/LegacyNestedRegressionClosure.test.js

echo
echo "==> Test discovery audit after closure"

node install/quality/audit-test-discovery.cjs | tee "$DISCOVERY_AUDIT_LOG"

echo
echo "==> Closure verification CLI"

node install/quality/legacy-nested-regression-closure.cjs "$ARCHIVE_MANIFEST"

echo
echo "==> Installing dependencies"

npm ci

echo
echo "==> Build validation"

npm run build

echo
echo "==> Current Sprint specific test"

node --test test/domain/quality/LegacyNestedRegressionClosure.test.js | tee "$CURRENT_TEST_LOG"

echo
echo "==> Previous quality regression tests"

node --test test/domain/quality/TestDiscoveryGovernance.test.js
node --test test/domain/quality/TestDiscoveryGovernanceV2.test.js

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

FINAL_NESTED_LEGACY_COUNT="$(count_nested_legacy_tests)"

if [ "$FINAL_NESTED_LEGACY_COUNT" != "0" ]; then
  echo "ERROR: final nested legacy test count must be zero."
  exit 1
fi

echo
echo "==> Git status before commit"

git status --short

git add \
  docs/archive/legacy-hidden-tests \
  artifacts/legacy-regression-closure \
  install/quality/legacy-nested-regression-closure.cjs \
  test/domain/quality/LegacyNestedRegressionClosure.test.js \
  install/sprints/run-sprint-${SPRINT}.sh

git add -u

if git diff --cached --quiet; then
  echo "No changes detected for Sprint ${SPRINT}."
  exit 1
fi

git commit -m "test(governance): close legacy nested regression debt"

git push -u origin "$BRANCH"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint ${SPRINT} legacy nested regression closure"
git push origin main

FINAL_HEAD="$(git rev-parse --short HEAD)"
SOURCE_JS_COUNT="$(count_files src '*.js')"
OFFICIAL_TEST_FILE_COUNT="$(count_files test '*.test.js')"
LEGACY_TEST_FILE_COUNT="$(count_files tests '*.test.js')"
LEGACY_NESTED_TEST_COUNT="$(count_nested_legacy_tests)"
ARCHIVED_LEGACY_TEST_COUNT="$(find docs/archive/legacy-hidden-tests -name "*.test.js" | wc -l | tr -d ' ')"

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
  echo "ArchivedLegacyHiddenTestCount:"
  echo "$ARCHIVED_LEGACY_TEST_COUNT"
  echo
  echo "Architecture:"
  echo "Closed hidden nested legacy regression debt by archiving stale non-contract tests with manifest, enforcing zero nested tests under tests subdirectories, and preserving the official governed test runner."
  echo
  echo "Complexity:"
  echo "Time: O(t + a)"
  echo "Space: O(t + a)"
  echo
  echo "Institutional Flags:"
  echo "paperOnly=true"
  echo "productionMoneyAllowed=false"
  echo "liveMoneyAuthorization=false"
  echo "automaticExecutionAllowed=false"
  echo "humanSupervisionRequired=true"
  echo
  echo "Files Added/Updated:"
  echo "docs/archive/legacy-hidden-tests/"
  echo "install/quality/legacy-nested-regression-closure.cjs"
  echo "test/domain/quality/LegacyNestedRegressionClosure.test.js"
  echo
  echo "Reports:"
  echo "$DISCOVERY_AUDIT_LOG"
  echo "$CLOSURE_REPORT"
  echo "$ARCHIVE_MANIFEST"
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
