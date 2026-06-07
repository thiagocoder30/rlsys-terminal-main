#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="253"
NAME="Paper Runtime Dry Run Harness"
BRANCH="sprint-253-paper-runtime-dry-run-harness"
OLD_GLOBAL_TEST_BASELINE="1363"

if ! PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: Git repository root not found."
  exit 1
fi

cd "$PROJECT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p \
  logs \
  artifacts/logs \
  artifacts/paper-runtime-dry-run-harness \
  install/sprints \
  src/application/runtime \
  test/domain/runtime

LOG_FILE="logs/sprint-${SPRINT}-${TIMESTAMP}.log"
SUCCESS_SUMMARY="artifacts/logs/sprint-${SPRINT}-success-summary.txt"
FAILURE_SUMMARY="artifacts/logs/sprint-${SPRINT}-failure-summary.txt"
CURRENT_TEST_LOG="logs/sprint-${SPRINT}-current-test-${TIMESTAMP}.log"
GLOBAL_TEST_LOG="logs/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log"
SUMMARY_PARSE_LOG="artifacts/paper-runtime-dry-run-harness/sprint-${SPRINT}-parsed-node-test-summary.txt"
HARNESS_REPORT="artifacts/paper-runtime-dry-run-harness/sprint-${SPRINT}-harness-report.txt"
DEBUG_TAIL_LOG="artifacts/paper-runtime-dry-run-harness/sprint-${SPRINT}-failure-log-tail.txt"

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

rm -rf artifacts/paper-runtime-dry-run-harness
rm -f src/application/runtime/PaperRuntimeDryRunHarness.ts
rm -f test/domain/runtime/PaperRuntimeDryRunHarness.test.js

mkdir -p artifacts/paper-runtime-dry-run-harness src/application/runtime test/domain/runtime

PREVIOUS_HEAD="$(git rev-parse --short HEAD)"
git checkout -b "$BRANCH"
BASE_HEAD="$(git rev-parse --short HEAD)"

echo
echo "==> Writing Paper Runtime Dry Run Harness"

cat > src/application/runtime/PaperRuntimeDryRunHarness.ts <<'TS'
import {
  PaperRuntimePipelineAdapter,
  type PaperRuntimePipelineAdapterReport,
  type PaperRuntimePipelineRound,
} from './PaperRuntimePipelineAdapter.js';

export type PaperRuntimeDryRunStatus =
  | 'DRY_RUN_READY'
  | 'DRY_RUN_REVIEW'
  | 'DRY_RUN_BLOCKED';

export interface PaperRuntimeDryRunInput {
  readonly dryRunId: string;
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly generatedAtEpochMs: number;
  readonly rounds: readonly PaperRuntimePipelineRound[];
  readonly certificationApproved?: boolean;
  readonly riskApproved?: boolean;
  readonly operatorApproved?: boolean;
  readonly consensusScore?: number;
  readonly calibratedConfidence?: number;
  readonly strategyReputationScore?: number;
  readonly tableReputationScore?: number;
}

export interface PaperRuntimeDryRunReport {
  readonly dryRunId: string;
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly status: PaperRuntimeDryRunStatus;
  readonly roundCount: number;
  readonly finalDecision: 'PAPER_FAVORAVEL' | 'OBSERVAR' | 'NAO_UTILIZAR';
  readonly operatorSummary: string;
  readonly transcript: readonly string[];
  readonly adapter: PaperRuntimePipelineAdapterReport;
  readonly paperOnly: true;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticSuggestionAllowed: true;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface PaperRuntimeDryRunFailure {
  readonly code: 'INVALID_PAPER_RUNTIME_DRY_RUN_INPUT' | 'PAPER_RUNTIME_DRY_RUN_STAGE_FAILED';
  readonly stage: 'VALIDATION' | 'ADAPTER';
  readonly message: string;
}

export type PaperRuntimeDryRunResult =
  | {
      readonly ok: true;
      readonly value: PaperRuntimeDryRunReport;
    }
  | {
      readonly ok: false;
      readonly error: PaperRuntimeDryRunFailure;
    };

export interface PaperRuntimeDryRunHarnessOptions {
  readonly maxTranscriptLines?: number;
}

/**
 * Executes a deterministic supervised PAPER dry-run session.
 *
 * This harness is a testable application boundary over PaperRuntimePipelineAdapter.
 * It does not connect to casino APIs, does not mutate RuntimeKernel, and never
 * produces automatic bet execution commands.
 *
 * Complexity:
 * - Time: O(n)
 * - Space: O(n), bounded by transcript max lines and adapter bounded rounds.
 */
export class PaperRuntimeDryRunHarness {
  private readonly maxTranscriptLines: number;

  public constructor(
    private readonly adapter: PaperRuntimePipelineAdapter = new PaperRuntimePipelineAdapter(),
    options: PaperRuntimeDryRunHarnessOptions = {},
  ) {
    this.maxTranscriptLines = options.maxTranscriptLines ?? 24;
  }

  public run(input: PaperRuntimeDryRunInput): PaperRuntimeDryRunResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const adapterResult = this.adapter.evaluate({
      adapterId: `${input.dryRunId}:adapter`,
      sessionId: input.sessionId,
      strategyId: input.strategyId,
      tableId: input.tableId,
      generatedAtEpochMs: input.generatedAtEpochMs,
      rounds: input.rounds,
      certificationApproved: input.certificationApproved,
      riskApproved: input.riskApproved,
      operatorApproved: input.operatorApproved,
      consensusScore: input.consensusScore,
      calibratedConfidence: input.calibratedConfidence,
      strategyReputationScore: input.strategyReputationScore,
      tableReputationScore: input.tableReputationScore,
    });

    if (!adapterResult.ok) {
      return {
        ok: false,
        error: Object.freeze({
          code: 'PAPER_RUNTIME_DRY_RUN_STAGE_FAILED',
          stage: 'ADAPTER',
          message: adapterResult.error.message,
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        dryRunId: input.dryRunId,
        sessionId: input.sessionId,
        strategyId: input.strategyId,
        tableId: input.tableId,
        status: this.resolveStatus(adapterResult.value.finalDecision),
        roundCount: adapterResult.value.roundCount,
        finalDecision: adapterResult.value.finalDecision,
        operatorSummary: adapterResult.value.operatorSummary,
        transcript: this.composeTranscript(input, adapterResult.value),
        adapter: adapterResult.value,
        paperOnly: true,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        automaticExecutionAllowed: false,
        automaticSuggestionAllowed: true,
        automaticBetExecutionAllowed: false,
        humanSupervisionRequired: true,
      }),
    };
  }

  private validate(input: PaperRuntimeDryRunInput): PaperRuntimeDryRunFailure | null {
    if (input.dryRunId.trim().length === 0) return this.validationFailure('dryRunId is required');
    if (input.sessionId.trim().length === 0) return this.validationFailure('sessionId is required');
    if (input.strategyId.trim().length === 0) return this.validationFailure('strategyId is required');
    if (input.tableId.trim().length === 0) return this.validationFailure('tableId is required');

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.validationFailure('generatedAtEpochMs must be a positive finite number');
    }

    if (input.rounds.length === 0) {
      return this.validationFailure('rounds cannot be empty');
    }

    return null;
  }

  private composeTranscript(
    input: PaperRuntimeDryRunInput,
    adapterReport: PaperRuntimePipelineAdapterReport,
  ): readonly string[] {
    const lines = [
      `DRY_RUN_ID=${input.dryRunId}`,
      `SESSION=${input.sessionId}`,
      `STRATEGY=${input.strategyId}`,
      `TABLE=${input.tableId}`,
      `ROUNDS=${adapterReport.roundCount}`,
      `FINAL_DECISION=${adapterReport.finalDecision}`,
      `PIPELINE_STATUS=${adapterReport.pipeline.status}`,
      `READINESS=${adapterReport.pipeline.readiness.status}:${adapterReport.pipeline.readiness.readinessScore}`,
      `RECOMMENDATION_SCORE=${adapterReport.pipeline.recommendation.institutionalScore}`,
      `LEARNING_SCORE=${adapterReport.pipeline.recommendation.learningScore}`,
      `TRACE_STATUS=${adapterReport.pipeline.traceability.status}`,
      `EXPLAINABILITY=${adapterReport.pipeline.explainability.operatorSummary}`,
      'PAPER_ONLY=true',
      'AUTOMATIC_SUGGESTION_ALLOWED=true',
      'AUTOMATIC_BET_EXECUTION_ALLOWED=false',
      'HUMAN_SUPERVISION_REQUIRED=true',
    ];

    return Object.freeze(lines.slice(0, this.maxTranscriptLines));
  }

  private resolveStatus(decision: PaperRuntimeDryRunReport['finalDecision']): PaperRuntimeDryRunStatus {
    if (decision === 'PAPER_FAVORAVEL') return 'DRY_RUN_READY';
    if (decision === 'OBSERVAR') return 'DRY_RUN_REVIEW';
    return 'DRY_RUN_BLOCKED';
  }

  private validationFailure(message: string): PaperRuntimeDryRunFailure {
    return Object.freeze({
      code: 'INVALID_PAPER_RUNTIME_DRY_RUN_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
TS

echo
echo "==> Writing Sprint 253 test"

cat > test/domain/runtime/PaperRuntimeDryRunHarness.test.js <<'JS'
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PaperRuntimeDryRunHarness,
} = require('../../../dist/application/runtime/PaperRuntimeDryRunHarness.js');

const now = 1760000000000;

function round(sequence, number) {
  return {
    sequence,
    number,
    occurredAtEpochMs: now + sequence * 1000,
  };
}

function input(overrides = {}) {
  return {
    dryRunId: 'dry-run-253',
    sessionId: 'session-253',
    strategyId: 'fusion',
    tableId: 'mesa-a14',
    generatedAtEpochMs: now,
    rounds: [
      round(1, 7),
      round(2, 18),
      round(3, 29),
      round(4, 12),
      round(5, 33),
      round(6, 21),
    ],
    certificationApproved: true,
    riskApproved: true,
    operatorApproved: true,
    ...overrides,
  };
}

test('paper runtime dry run harness produces supervised PAPER session report', () => {
  const harness = new PaperRuntimeDryRunHarness();
  const result = harness.run(input());

  assert.equal(result.ok, true);
  assert.equal(result.value.dryRunId, 'dry-run-253');
  assert.equal(result.value.roundCount, 6);
  assert.ok(['DRY_RUN_READY', 'DRY_RUN_REVIEW', 'DRY_RUN_BLOCKED'].includes(result.value.status));
  assert.ok(['PAPER_FAVORAVEL', 'OBSERVAR', 'NAO_UTILIZAR'].includes(result.value.finalDecision));
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.humanSupervisionRequired, true);
});

test('paper runtime dry run harness transcript is deterministic and audit friendly', () => {
  const harness = new PaperRuntimeDryRunHarness();
  const result = harness.run(input());

  assert.equal(result.ok, true);
  assert.ok(result.value.transcript.some((line) => line === 'DRY_RUN_ID=dry-run-253'));
  assert.ok(result.value.transcript.some((line) => line.startsWith('FINAL_DECISION=')));
  assert.ok(result.value.transcript.some((line) => line === 'PAPER_ONLY=true'));
  assert.ok(result.value.transcript.some((line) => line === 'AUTOMATIC_BET_EXECUTION_ALLOWED=false'));
});

test('paper runtime dry run harness is idempotent for same observed PAPER rounds', () => {
  const harness = new PaperRuntimeDryRunHarness();
  const payload = input();

  const first = harness.run(payload);
  const second = harness.run(payload);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value, second.value);
});

test('paper runtime dry run harness blocks invalid identity before adapter execution', () => {
  const harness = new PaperRuntimeDryRunHarness();
  const result = harness.run(input({
    dryRunId: '',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.code, 'INVALID_PAPER_RUNTIME_DRY_RUN_INPUT');
});

test('paper runtime dry run harness reports NAO_UTILIZAR when certification is blocked', () => {
  const harness = new PaperRuntimeDryRunHarness();
  const result = harness.run(input({
    certificationApproved: false,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.finalDecision, 'NAO_UTILIZAR');
  assert.equal(result.value.status, 'DRY_RUN_BLOCKED');
});
JS

echo
echo "==> Syntax validation"

node --check test/domain/runtime/PaperRuntimeDryRunHarness.test.js

echo
echo "==> Installing dependencies"

npm ci

echo
echo "==> Build validation"

npm run build

echo
echo "==> Current Sprint specific test"

node --test test/domain/runtime/PaperRuntimeDryRunHarness.test.js | tee "$CURRENT_TEST_LOG"

echo
echo "==> Previous runtime pipeline regression tests"

node --test test/domain/runtime/PaperRuntimePipelineAdapter.test.js
node --test test/domain/pipeline/InstitutionalDecisionPipeline.test.js

echo
echo "==> Previous quality regression tests"

node --test test/domain/quality/TestDiscoveryGovernance.test.js
node --test test/domain/quality/TestDiscoveryGovernanceV2.test.js
node --test test/domain/quality/LegacyNestedRegressionClosure.test.js
node --test test/domain/quality/RepositoryGovernanceEngine.test.js
node --test test/domain/quality/DependencyGovernanceEngine.test.js
node --test test/domain/quality/ArchitectureGovernanceEngine.test.js
node --test test/domain/quality/TechnicalDebtEngine.test.js
node --test test/domain/quality/RepositoryCertificationEngine.test.js

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

{
  echo "RL.SYS CORE Paper Runtime Dry Run Harness Report"
  echo "Status: PASS"
  echo "HarnessFile: src/application/runtime/PaperRuntimeDryRunHarness.ts"
  echo "HarnessTest: test/domain/runtime/PaperRuntimeDryRunHarness.test.js"
  echo "GlobalTestTotal: $GLOBAL_TEST_TOTAL"
  echo "GlobalTestPass: $GLOBAL_TEST_PASS"
  echo "GlobalTestFail: $GLOBAL_TEST_FAIL"
  echo "PaperOnly: true"
  echo "ProductionMoneyAllowed: false"
  echo "LiveMoneyAuthorization: false"
  echo "AutomaticExecutionAllowed: false"
  echo "AutomaticSuggestionAllowed: true"
  echo "AutomaticBetExecutionAllowed: false"
  echo "HumanSupervisionRequired: true"
} > "$HARNESS_REPORT"

echo
echo "==> Git status before commit"

git status --short

git add \
  src/application/runtime/PaperRuntimeDryRunHarness.ts \
  test/domain/runtime/PaperRuntimeDryRunHarness.test.js \
  artifacts/paper-runtime-dry-run-harness \
  install/sprints/run-sprint-${SPRINT}.sh

git add -u

if git diff --cached --quiet; then
  echo "No changes detected for Sprint ${SPRINT}."
  exit 1
fi

git commit -m "feat(runtime): add paper runtime dry run harness"

git push -u origin "$BRANCH"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint ${SPRINT} paper runtime dry run harness"
git push origin main

FINAL_HEAD="$(git rev-parse --short HEAD)"
SOURCE_TS_COUNT="$(count_files src '*.ts')"
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
  echo "PreviousRuntimePipelineRegressionTests:"
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
  echo "SourceTsCount:"
  echo "$SOURCE_TS_COUNT"
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
  echo "PaperRuntimeDryRunHarness:"
  echo "PASS"
  echo
  echo "Architecture:"
  echo "Added Paper Runtime Dry Run Harness as a deterministic supervised PAPER session harness over PaperRuntimePipelineAdapter, producing auditable operator transcript without modifying RuntimeKernel or enabling automatic bet execution."
  echo
  echo "Complexity:"
  echo "Time: O(n)"
  echo "Space: O(n)"
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
  echo "src/application/runtime/PaperRuntimeDryRunHarness.ts"
  echo "test/domain/runtime/PaperRuntimeDryRunHarness.test.js"
  echo
  echo "Reports:"
  echo "$HARNESS_REPORT"
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
