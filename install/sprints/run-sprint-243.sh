#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="243"
NAME="Repository Professionalization & Hygiene Cleanup V3"
BRANCH="sprint-243-repository-professionalization-hygiene-cleanup"

if ! PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: Git repository root not found. Run this script from inside the RL.SYS CORE repository."
  exit 1
fi

cd "$PROJECT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p \
  logs \
  artifacts/logs \
  artifacts/repository-hygiene \
  docs/archive \
  docs/archive/repository-hygiene \
  install/sprints \
  data \
  data/paper-runtime \
  data/sessions

LOG_FILE="logs/sprint-${SPRINT}-${TIMESTAMP}.log"
SUCCESS_SUMMARY="artifacts/logs/sprint-${SPRINT}-success-summary.txt"
FAILURE_SUMMARY="artifacts/logs/sprint-${SPRINT}-failure-summary.txt"
GLOBAL_TEST_LOG="logs/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log"
HYGIENE_REPORT="artifacts/repository-hygiene/sprint-${SPRINT}-repository-hygiene-report.txt"
TRACKED_GENERATED_REPORT="artifacts/repository-hygiene/sprint-${SPRINT}-tracked-generated-files.txt"
HIDDEN_TEST_REPORT="artifacts/repository-hygiene/sprint-${SPRINT}-legacy-hidden-tests-audit.txt"
ROOT_FILES_REPORT="artifacts/repository-hygiene/sprint-${SPRINT}-root-files-audit.txt"
GITIGNORE_REPORT="artifacts/repository-hygiene/sprint-${SPRINT}-gitignore-policy.txt"

exec > >(tee -a "$LOG_FILE") 2>&1

write_failure_summary() {
  local exit_code="$?"
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
    echo "LogFile:"
    echo "$LOG_FILE"
    echo
    echo "GlobalNpmTestLog:"
    echo "$GLOBAL_TEST_LOG"
    echo
    echo "Timestamp:"
    date -Iseconds
    echo "========================================"
  } > "$FAILURE_SUMMARY"

  echo
  cat "$FAILURE_SUMMARY" || true
  exit "$exit_code"
}

trap write_failure_summary ERR

append_gitignore_entry() {
  local entry="$1"
  touch .gitignore
  grep -qxF "$entry" .gitignore || echo "$entry" >> .gitignore
}

safe_count_find() {
  local target_dir="$1"
  local pattern="$2"

  if [ -d "$target_dir" ]; then
    find "$target_dir" -name "$pattern" | wc -l | tr -d ' '
  else
    echo "0"
  fi
}

safe_find_tests_nested() {
  if [ -d tests ]; then
    find tests -mindepth 2 -name "*.test.js" | sort
  else
    true
  fi
}

echo "========================================"
echo "RL.SYS CORE — SPRINT ${SPRINT}"
echo "$NAME"
echo "========================================"
echo "RepositoryRoot: $PROJECT_DIR"

PREVIOUS_HEAD="$(git rev-parse --short HEAD)"
CURRENT_BRANCH="$(git branch --show-current)"

echo
echo "==> Preflight"
echo "CurrentBranch: $CURRENT_BRANCH"
echo "PreviousHEAD: $PREVIOUS_HEAD"

git checkout main
git pull origin main

if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git branch -D "$BRANCH"
fi

git checkout -b "$BRANCH"

BASE_HEAD="$(git rev-parse --short HEAD)"

echo
echo "==> Generating repository hygiene reports"

find . -maxdepth 1 -type f | sed 's#^./##' | sort > "$ROOT_FILES_REPORT"

{
  echo "RL.SYS CORE — Repository Hygiene Report"
  echo "Sprint: ${SPRINT}"
  echo "Name: ${NAME}"
  echo "Timestamp: $(date -Iseconds)"
  echo
  echo "RepositoryRoot: $PROJECT_DIR"
  echo "Branch: $(git branch --show-current)"
  echo "HEAD: $(git rev-parse --short HEAD)"
  echo
  echo "SourceJsCount: $(safe_count_find src '*.js')"
  echo "OfficialTestFileCount: $(safe_count_find test '*.test.js')"
  echo "LegacyTestFileCount: $(safe_count_find tests '*.test.js')"
  echo "LegacyNestedTestCount: $(safe_find_tests_nested | wc -l | tr -d ' ')"
  echo
  echo "RootFilesAudit:"
  cat "$ROOT_FILES_REPORT"
} > "$HYGIENE_REPORT"

{
  echo "RL.SYS CORE — Legacy Hidden Tests Audit"
  echo "Sprint: ${SPRINT}"
  echo "Name: ${NAME}"
  echo "Timestamp: $(date -Iseconds)"
  echo
  echo "Policy:"
  echo "Diagnostic only. Legacy nested tests are listed but not executed in this hygiene sprint."
  echo
  echo "Reason:"
  echo "This sprint professionalizes repository hygiene without changing the official test contract."
  echo "A dedicated Hidden Regression Closure sprint should migrate or retire these tests intentionally."
  echo
  echo "Nested legacy tests discovered:"
  if [ -d tests ]; then
    safe_find_tests_nested || true
  else
    echo "NONE"
  fi
} > "$HIDDEN_TEST_REPORT"

{
  git ls-files | grep -E '(^node_modules/|^dist/|^coverage/|^\.nyc_output/|^logs/|(^|/)terminal-buffer\.log$|(^|/)pacote_rlsys_ts\.log$|(^|/)vision_log\.png$|\.log$|\.tmp$|\.sqlite$|\.db$|^data/.*\.json$|^artifacts/logs/.*\.log$)' || true
} | sort > "$TRACKED_GENERATED_REPORT"

echo
echo "Tracked generated/runtime files detected before cleanup:"
cat "$TRACKED_GENERATED_REPORT" || true

echo
echo "==> Updating professional .gitignore"

append_gitignore_entry ""
append_gitignore_entry "# RL.SYS CORE — generated/runtime artifacts"
append_gitignore_entry "node_modules/"
append_gitignore_entry "dist/"
append_gitignore_entry "coverage/"
append_gitignore_entry ".nyc_output/"
append_gitignore_entry "logs/"
append_gitignore_entry "*.log"
append_gitignore_entry "*.tmp"
append_gitignore_entry "*.sqlite"
append_gitignore_entry "*.db"
append_gitignore_entry "data/*.db"
append_gitignore_entry "data/**/*.json"
append_gitignore_entry "artifacts/logs/*.log"
append_gitignore_entry "artifacts/tmp/"
append_gitignore_entry ".DS_Store"
append_gitignore_entry "Thumbs.db"
append_gitignore_entry "vision_log.png"
append_gitignore_entry "terminal-buffer.log"
append_gitignore_entry "pacote_rlsys_ts.log"

cp .gitignore "$GITIGNORE_REPORT"

echo
echo "==> Removing tracked generated/runtime files from Git index only"

if [ -s "$TRACKED_GENERATED_REPORT" ]; then
  while IFS= read -r tracked_file; do
    if [ -n "$tracked_file" ]; then
      git rm --cached -r --ignore-unmatch "$tracked_file" || true
    fi
  done < "$TRACKED_GENERATED_REPORT"
else
  echo "No tracked generated/runtime files detected."
fi

echo
echo "==> Creating professional placeholders"

touch \
  data/.gitkeep \
  data/paper-runtime/.gitkeep \
  data/sessions/.gitkeep \
  docs/archive/.gitkeep \
  docs/archive/repository-hygiene/.gitkeep

echo
echo "==> Dependency installation"

npm ci

echo
echo "==> Build validation"

npm run build

echo
echo "==> Global npm test validation"

npm test | tee "$GLOBAL_TEST_LOG"

GLOBAL_TEST_TOTAL="$(grep -E '^[#[:space:]]*tests[[:space:]]+[0-9]+' "$GLOBAL_TEST_LOG" | tail -1 | awk '{print $3}' || true)"
GLOBAL_TEST_PASS="$(grep -E '^[#[:space:]]*pass[[:space:]]+[0-9]+' "$GLOBAL_TEST_LOG" | tail -1 | awk '{print $3}' || true)"
GLOBAL_TEST_FAIL="$(grep -E '^[#[:space:]]*fail[[:space:]]+[0-9]+' "$GLOBAL_TEST_LOG" | tail -1 | awk '{print $3}' || true)"

GLOBAL_TEST_TOTAL="${GLOBAL_TEST_TOTAL:-UNKNOWN}"
GLOBAL_TEST_PASS="${GLOBAL_TEST_PASS:-UNKNOWN}"
GLOBAL_TEST_FAIL="${GLOBAL_TEST_FAIL:-UNKNOWN}"

if [ "$GLOBAL_TEST_FAIL" != "0" ] && [ "$GLOBAL_TEST_FAIL" != "UNKNOWN" ]; then
  echo "Global npm tests reported failures: $GLOBAL_TEST_FAIL"
  exit 1
fi

echo
echo "==> Staging institutional repository hygiene changes"

git add \
  .gitignore \
  data/.gitkeep \
  data/paper-runtime/.gitkeep \
  data/sessions/.gitkeep \
  docs/archive/.gitkeep \
  docs/archive/repository-hygiene/.gitkeep \
  artifacts/repository-hygiene \
  install/sprints/run-sprint-${SPRINT}.sh

git add -u

if git diff --cached --quiet; then
  echo "No repository hygiene changes detected. Creating audit marker."
  echo "Sprint ${SPRINT} audit executed at $(date -Iseconds)" > "artifacts/repository-hygiene/sprint-${SPRINT}-audit-marker.txt"
  git add "artifacts/repository-hygiene/sprint-${SPRINT}-audit-marker.txt"
fi

git commit -m "chore(repo): professionalize repository hygiene and diagnostics"

echo
echo "==> Pushing sprint branch"

git push -u origin "$BRANCH"

echo
echo "==> Merging sprint branch into main"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint ${SPRINT} repository professionalization hygiene cleanup"

echo
echo "==> Pushing main"

git push origin main

FINAL_HEAD="$(git rev-parse --short HEAD)"
SOURCE_JS_COUNT="$(safe_count_find src '*.js')"
OFFICIAL_TEST_FILE_COUNT="$(safe_count_find test '*.test.js')"
LEGACY_TEST_FILE_COUNT="$(safe_count_find tests '*.test.js')"
LEGACY_NESTED_TEST_COUNT="$(safe_find_tests_nested | wc -l | tr -d ' ')"
TRACKED_GENERATED_COUNT="$(wc -l < "$TRACKED_GENERATED_REPORT" | tr -d ' ')"

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
  echo "GlobalNpmTests:"
  echo "PASS"
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
  echo "TrackedGeneratedFilesDetectedBeforeCleanup:"
  echo "$TRACKED_GENERATED_COUNT"
  echo
  echo "RepositoryHygiene:"
  echo "PASS"
  echo
  echo "Architecture:"
  echo "Repository professionalization sprint with deterministic Codespaces-compatible root discovery, safe Git-index cleanup, professional .gitignore policy, institutional hygiene reports, and non-gating hidden legacy test audit."
  echo
  echo "Institutional Flags:"
  echo "paperOnly=true"
  echo "productionMoneyAllowed=false"
  echo "liveMoneyAuthorization=false"
  echo "automaticExecutionAllowed=false"
  echo "humanSupervisionRequired=true"
  echo
  echo "Reports:"
  echo "$HYGIENE_REPORT"
  echo "$TRACKED_GENERATED_REPORT"
  echo "$HIDDEN_TEST_REPORT"
  echo "$ROOT_FILES_REPORT"
  echo "$GITIGNORE_REPORT"
  echo
  echo "LogFile:"
  echo "$LOG_FILE"
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
