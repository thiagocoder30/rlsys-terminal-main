#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="254"
NAME="Paper Validation Campaign Engine"
BRANCH="sprint-254-paper-validation-campaign-engine"
OLD_GLOBAL_TEST_BASELINE="1368"

if ! PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: Git repository root not found."
  exit 1
fi

cd "$PROJECT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p \
  logs \
  artifacts/logs \
  artifacts/paper-validation-campaign \
  install/sprints \
  src/application/runtime \
  test/domain/runtime

LOG_FILE="logs/sprint-${SPRINT}-${TIMESTAMP}.log"
SUCCESS_SUMMARY="artifacts/logs/sprint-${SPRINT}-success-summary.txt"
FAILURE_SUMMARY="artifacts/logs/sprint-${SPRINT}-failure-summary.txt"
CURRENT_TEST_LOG="logs/sprint-${SPRINT}-current-test-${TIMESTAMP}.log"
GLOBAL_TEST_LOG="logs/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log"
SUMMARY_PARSE_LOG="artifacts/paper-validation-campaign/sprint-${SPRINT}-parsed-node-test-summary.txt"
CAMPAIGN_REPORT="artifacts/paper-validation-campaign/sprint-${SPRINT}-campaign-report.txt"
DEBUG_TAIL_LOG="artifacts/paper-validation-campaign/sprint-${SPRINT}-failure-log-tail.txt"

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

rm -rf artifacts/paper-validation-campaign
rm -f src/application/runtime/PaperValidationCampaignEngine.ts
rm -f test/domain/runtime/PaperValidationCampaignEngine.test.js

mkdir -p artifacts/paper-validation-campaign src/application/runtime test/domain/runtime

PREVIOUS_HEAD="$(git rev-parse --short HEAD)"
git checkout -b "$BRANCH"
BASE_HEAD="$(git rev-parse --short HEAD)"

echo
echo "==> Writing Paper Validation Campaign Engine"

cat > src/application/runtime/PaperValidationCampaignEngine.ts <<'TS'
import {
  PaperRuntimeDryRunHarness,
  type PaperRuntimeDryRunInput,
  type PaperRuntimeDryRunReport,
} from './PaperRuntimeDryRunHarness.js';

export type PaperValidationCampaignStatus =
  | 'CAMPAIGN_CERTIFIED'
  | 'CAMPAIGN_REVIEW'
  | 'CAMPAIGN_BLOCKED';

export interface PaperValidationCampaignInput {
  readonly campaignId: string;
  readonly generatedAtEpochMs: number;
  readonly dryRuns: readonly PaperRuntimeDryRunInput[];
}

export interface PaperValidationCampaignDecisionCounts {
  readonly paperFavoravel: number;
  readonly observar: number;
  readonly naoUtilizar: number;
}

export interface PaperValidationCampaignReport {
  readonly campaignId: string;
  readonly status: PaperValidationCampaignStatus;
  readonly generatedAtEpochMs: number;
  readonly dryRunCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly decisionCounts: PaperValidationCampaignDecisionCounts;
  readonly readinessRatio: number;
  readonly reviewRatio: number;
  readonly blockedRatio: number;
  readonly reports: readonly PaperRuntimeDryRunReport[];
  readonly operatorSummary: string;
  readonly paperOnly: true;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticSuggestionAllowed: true;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface PaperValidationCampaignFailure {
  readonly code: 'INVALID_PAPER_VALIDATION_CAMPAIGN_INPUT' | 'PAPER_VALIDATION_CAMPAIGN_STAGE_FAILED';
  readonly stage: 'VALIDATION' | 'DRY_RUN';
  readonly message: string;
}

export type PaperValidationCampaignResult =
  | {
      readonly ok: true;
      readonly value: PaperValidationCampaignReport;
    }
  | {
      readonly ok: false;
      readonly error: PaperValidationCampaignFailure;
    };

export interface PaperValidationCampaignPolicy {
  readonly minimumDryRuns: number;
  readonly minimumCertifiedReadinessRatio: number;
  readonly maximumBlockedRatio: number;
  readonly failOnDryRunError: boolean;
}

const DEFAULT_POLICY: PaperValidationCampaignPolicy = Object.freeze({
  minimumDryRuns: 2,
  minimumCertifiedReadinessRatio: 0.5,
  maximumBlockedRatio: 0.5,
  failOnDryRunError: true,
});

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

const safeRatio = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return numerator / denominator;
};

/**
 * Executes a supervised PAPER validation campaign over multiple dry runs.
 *
 * This engine composes PaperRuntimeDryRunHarness without connecting to live
 * platforms, without altering RuntimeKernel and without enabling automatic bet
 * execution. It provides campaign-level certification evidence for PAPER mode.
 *
 * Complexity:
 * - Time: O(n + r), where n is dry-run count and r is total round count.
 * - Space: O(n), storing only final dry-run reports.
 */
export class PaperValidationCampaignEngine {
  private readonly policy: PaperValidationCampaignPolicy;

  public constructor(
    private readonly harness: PaperRuntimeDryRunHarness = new PaperRuntimeDryRunHarness(),
    policy: PaperValidationCampaignPolicy = DEFAULT_POLICY,
  ) {
    this.policy = Object.freeze({
      minimumDryRuns: policy.minimumDryRuns,
      minimumCertifiedReadinessRatio: policy.minimumCertifiedReadinessRatio,
      maximumBlockedRatio: policy.maximumBlockedRatio,
      failOnDryRunError: policy.failOnDryRunError,
    });
  }

  public run(input: PaperValidationCampaignInput): PaperValidationCampaignResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const reports: PaperRuntimeDryRunReport[] = [];
    let failureCount = 0;

    for (const dryRun of input.dryRuns) {
      const result = this.harness.run(dryRun);

      if (!result.ok) {
        failureCount += 1;

        if (this.policy.failOnDryRunError) {
          return {
            ok: false,
            error: Object.freeze({
              code: 'PAPER_VALIDATION_CAMPAIGN_STAGE_FAILED',
              stage: 'DRY_RUN',
              message: `Dry run ${dryRun.dryRunId} failed: ${result.error.message}`,
            }),
          };
        }

        continue;
      }

      reports.push(result.value);
    }

    const decisionCounts = this.countDecisions(reports);
    const successCount = reports.length;
    const readinessRatio = round4(safeRatio(decisionCounts.paperFavoravel, successCount));
    const reviewRatio = round4(safeRatio(decisionCounts.observar, successCount));
    const blockedRatio = round4(safeRatio(decisionCounts.naoUtilizar, successCount));
    const status = this.resolveStatus(successCount, readinessRatio, blockedRatio, failureCount);

    return {
      ok: true,
      value: Object.freeze({
        campaignId: input.campaignId,
        status,
        generatedAtEpochMs: input.generatedAtEpochMs,
        dryRunCount: input.dryRuns.length,
        successCount,
        failureCount,
        decisionCounts,
        readinessRatio,
        reviewRatio,
        blockedRatio,
        reports: Object.freeze(reports),
        operatorSummary: this.composeSummary(status, successCount, decisionCounts, readinessRatio, blockedRatio),
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

  private validate(input: PaperValidationCampaignInput): PaperValidationCampaignFailure | null {
    if (input.campaignId.trim().length === 0) {
      return this.validationFailure('campaignId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.validationFailure('generatedAtEpochMs must be a positive finite number');
    }

    if (input.dryRuns.length < this.policy.minimumDryRuns) {
      return this.validationFailure(`at least ${this.policy.minimumDryRuns} dry runs are required`);
    }

    const seen = new Set<string>();

    for (const dryRun of input.dryRuns) {
      if (seen.has(dryRun.dryRunId)) {
        return this.validationFailure(`duplicated dryRunId: ${dryRun.dryRunId}`);
      }

      seen.add(dryRun.dryRunId);
    }

    return null;
  }

  private countDecisions(
    reports: readonly PaperRuntimeDryRunReport[],
  ): PaperValidationCampaignDecisionCounts {
    let paperFavoravel = 0;
    let observar = 0;
    let naoUtilizar = 0;

    for (const report of reports) {
      if (report.finalDecision === 'PAPER_FAVORAVEL') {
        paperFavoravel += 1;
      } else if (report.finalDecision === 'OBSERVAR') {
        observar += 1;
      } else {
        naoUtilizar += 1;
      }
    }

    return Object.freeze({
      paperFavoravel,
      observar,
      naoUtilizar,
    });
  }

  private resolveStatus(
    successCount: number,
    readinessRatio: number,
    blockedRatio: number,
    failureCount: number,
  ): PaperValidationCampaignStatus {
    if (successCount === 0 || failureCount > 0 || blockedRatio > this.policy.maximumBlockedRatio) {
      return 'CAMPAIGN_BLOCKED';
    }

    if (readinessRatio >= this.policy.minimumCertifiedReadinessRatio) {
      return 'CAMPAIGN_CERTIFIED';
    }

    return 'CAMPAIGN_REVIEW';
  }

  private composeSummary(
    status: PaperValidationCampaignStatus,
    successCount: number,
    decisionCounts: PaperValidationCampaignDecisionCounts,
    readinessRatio: number,
    blockedRatio: number,
  ): string {
    if (status === 'CAMPAIGN_CERTIFIED') {
      return `CAMPAIGN_CERTIFIED: ${successCount} dry runs avaliados; readiness=${readinessRatio}; bloqueios=${blockedRatio}.`;
    }

    if (status === 'CAMPAIGN_REVIEW') {
      return `CAMPAIGN_REVIEW: campanha exige avaliação manual; favoráveis=${decisionCounts.paperFavoravel}; observar=${decisionCounts.observar}; bloqueios=${decisionCounts.naoUtilizar}.`;
    }

    return `CAMPAIGN_BLOCKED: bloqueios institucionais excederam limite; bloqueios=${decisionCounts.naoUtilizar}; ratio=${blockedRatio}.`;
  }

  private validationFailure(message: string): PaperValidationCampaignFailure {
    return Object.freeze({
      code: 'INVALID_PAPER_VALIDATION_CAMPAIGN_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
TS

echo
echo "==> Writing Sprint 254 test"

cat > test/domain/runtime/PaperValidationCampaignEngine.test.js <<'JS'
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PaperValidationCampaignEngine,
} = require('../../../dist/application/runtime/PaperValidationCampaignEngine.js');

const now = 1760000000000;

function round(sequence, number) {
  return {
    sequence,
    number,
    occurredAtEpochMs: now + sequence * 1000,
  };
}

function dryRun(id, overrides = {}) {
  return {
    dryRunId: `dry-run-${id}`,
    sessionId: `session-${id}`,
    strategyId: 'fusion',
    tableId: 'mesa-a14',
    generatedAtEpochMs: now + id * 10000,
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

function campaign(overrides = {}) {
  return {
    campaignId: 'campaign-254',
    generatedAtEpochMs: now,
    dryRuns: [
      dryRun(1),
      dryRun(2),
      dryRun(3),
    ],
    ...overrides,
  };
}

test('paper validation campaign engine consolidates multiple dry runs', () => {
  const engine = new PaperValidationCampaignEngine();
  const result = engine.run(campaign());

  assert.equal(result.ok, true);
  assert.equal(result.value.campaignId, 'campaign-254');
  assert.equal(result.value.dryRunCount, 3);
  assert.equal(result.value.successCount, 3);
  assert.equal(result.value.failureCount, 0);
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.ok(['CAMPAIGN_CERTIFIED', 'CAMPAIGN_REVIEW', 'CAMPAIGN_BLOCKED'].includes(result.value.status));
});

test('paper validation campaign engine is deterministic and idempotent for same campaign', () => {
  const engine = new PaperValidationCampaignEngine();
  const payload = campaign();

  const first = engine.run(payload);
  const second = engine.run(payload);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value, second.value);
});

test('paper validation campaign engine blocks duplicated dry run ids', () => {
  const engine = new PaperValidationCampaignEngine();
  const result = engine.run(campaign({
    dryRuns: [
      dryRun(1),
      dryRun(1),
    ],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.code, 'INVALID_PAPER_VALIDATION_CAMPAIGN_INPUT');
});

test('paper validation campaign engine returns blocked when dry run certification is blocked', () => {
  const engine = new PaperValidationCampaignEngine();
  const result = engine.run(campaign({
    dryRuns: [
      dryRun(1, { certificationApproved: false }),
      dryRun(2, { certificationApproved: false }),
      dryRun(3, { certificationApproved: false }),
    ],
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'CAMPAIGN_BLOCKED');
  assert.equal(result.value.decisionCounts.naoUtilizar, 3);
});

test('paper validation campaign engine preserves supervised PAPER-only campaign semantics', () => {
  const engine = new PaperValidationCampaignEngine();
  const result = engine.run(campaign());

  assert.equal(result.ok, true);
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticExecutionAllowed, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.humanSupervisionRequired, true);
});
JS

echo
echo "==> Syntax validation"

node --check test/domain/runtime/PaperValidationCampaignEngine.test.js

echo
echo "==> Installing dependencies"

npm ci

echo
echo "==> Build validation"

npm run build

echo
echo "==> Current Sprint specific test"

node --test test/domain/runtime/PaperValidationCampaignEngine.test.js | tee "$CURRENT_TEST_LOG"

echo
echo "==> Previous runtime dry-run regression tests"

node --test test/domain/runtime/PaperRuntimeDryRunHarness.test.js
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
  echo "RL.SYS CORE Paper Validation Campaign Engine Report"
  echo "Status: PASS"
  echo "CampaignEngineFile: src/application/runtime/PaperValidationCampaignEngine.ts"
  echo "CampaignEngineTest: test/domain/runtime/PaperValidationCampaignEngine.test.js"
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
} > "$CAMPAIGN_REPORT"

echo
echo "==> Git status before commit"

git status --short

git add \
  src/application/runtime/PaperValidationCampaignEngine.ts \
  test/domain/runtime/PaperValidationCampaignEngine.test.js \
  artifacts/paper-validation-campaign \
  install/sprints/run-sprint-${SPRINT}.sh

git add -u

if git diff --cached --quiet; then
  echo "No changes detected for Sprint ${SPRINT}."
  exit 1
fi

git commit -m "feat(runtime): add paper validation campaign engine"

git push -u origin "$BRANCH"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint ${SPRINT} paper validation campaign engine"
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
  echo "PreviousRuntimeDryRunRegressionTests:"
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
  echo "PaperValidationCampaignEngine:"
  echo "PASS"
  echo
  echo "Architecture:"
  echo "Added Paper Validation Campaign Engine to execute multiple supervised PAPER dry runs, consolidate campaign-level readiness, decision ratios, blocks and operator summary without live money or automatic bet execution."
  echo
  echo "Complexity:"
  echo "Time: O(n + r)"
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
  echo "src/application/runtime/PaperValidationCampaignEngine.ts"
  echo "test/domain/runtime/PaperValidationCampaignEngine.test.js"
  echo
  echo "Reports:"
  echo "$CAMPAIGN_REPORT"
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
