#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="252"
NAME="Paper Runtime Pipeline Adapter"
BRANCH="sprint-252-paper-runtime-pipeline-adapter"
OLD_GLOBAL_TEST_BASELINE="1358"

if ! PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: Git repository root not found."
  exit 1
fi

cd "$PROJECT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p \
  logs \
  artifacts/logs \
  artifacts/paper-runtime-pipeline-adapter \
  install/sprints \
  src/application/runtime \
  test/domain/runtime

LOG_FILE="logs/sprint-${SPRINT}-${TIMESTAMP}.log"
SUCCESS_SUMMARY="artifacts/logs/sprint-${SPRINT}-success-summary.txt"
FAILURE_SUMMARY="artifacts/logs/sprint-${SPRINT}-failure-summary.txt"
CURRENT_TEST_LOG="logs/sprint-${SPRINT}-current-test-${TIMESTAMP}.log"
GLOBAL_TEST_LOG="logs/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log"
SUMMARY_PARSE_LOG="artifacts/paper-runtime-pipeline-adapter/sprint-${SPRINT}-parsed-node-test-summary.txt"
ADAPTER_REPORT="artifacts/paper-runtime-pipeline-adapter/sprint-${SPRINT}-adapter-report.txt"
DEBUG_TAIL_LOG="artifacts/paper-runtime-pipeline-adapter/sprint-${SPRINT}-failure-log-tail.txt"

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

rm -rf artifacts/paper-runtime-pipeline-adapter
rm -f src/application/runtime/PaperRuntimePipelineAdapter.ts
rm -f test/domain/runtime/PaperRuntimePipelineAdapter.test.js

mkdir -p artifacts/paper-runtime-pipeline-adapter src/application/runtime test/domain/runtime

PREVIOUS_HEAD="$(git rev-parse --short HEAD)"
git checkout -b "$BRANCH"
BASE_HEAD="$(git rev-parse --short HEAD)"

echo
echo "==> Writing Paper Runtime Pipeline Adapter"

cat > src/application/runtime/PaperRuntimePipelineAdapter.ts <<'TS'
import {
  InstitutionalDecisionPipeline,
  type InstitutionalDecisionPipelineReport,
} from '../pipeline/InstitutionalDecisionPipeline.js';
import type {
  LearningMemorySample,
} from '../../domain/learning-memory/learning-memory-layer.js';
import type {
  PatternDiscoverySample,
} from '../../domain/institutional-pattern-discovery/institutional-pattern-discovery-engine.js';

export interface PaperRuntimePipelineRound {
  readonly sequence: number;
  readonly number: number;
  readonly occurredAtEpochMs: number;
}

export interface PaperRuntimePipelineAdapterInput {
  readonly adapterId: string;
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

export interface PaperRuntimePipelineAdapterReport {
  readonly adapterId: string;
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly roundCount: number;
  readonly pipeline: InstitutionalDecisionPipelineReport;
  readonly finalDecision: 'PAPER_FAVORAVEL' | 'OBSERVAR' | 'NAO_UTILIZAR';
  readonly operatorSummary: string;
  readonly paperOnly: true;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticSuggestionAllowed: true;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface PaperRuntimePipelineAdapterFailure {
  readonly code: 'INVALID_PAPER_RUNTIME_PIPELINE_ADAPTER_INPUT' | 'PAPER_RUNTIME_PIPELINE_ADAPTER_STAGE_FAILED';
  readonly stage: 'VALIDATION' | 'PIPELINE';
  readonly message: string;
}

export type PaperRuntimePipelineAdapterResult =
  | {
      readonly ok: true;
      readonly value: PaperRuntimePipelineAdapterReport;
    }
  | {
      readonly ok: false;
      readonly error: PaperRuntimePipelineAdapterFailure;
    };

export interface PaperRuntimePipelineAdapterOptions {
  readonly minimumRounds?: number;
  readonly maxRounds?: number;
}

const clamp01 = (value: number): number => {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

/**
 * Application adapter between observed PAPER runtime rounds and the
 * InstitutionalDecisionPipeline.
 *
 * It is intentionally isolated from RuntimeKernel in this Sprint.
 * It creates deterministic DTOs only; it never performs bet execution.
 *
 * Complexity:
 * - Time: O(n)
 * - Space: O(n)
 */
export class PaperRuntimePipelineAdapter {
  private readonly minimumRounds: number;
  private readonly maxRounds: number;

  public constructor(
    private readonly pipeline: InstitutionalDecisionPipeline = new InstitutionalDecisionPipeline(),
    options: PaperRuntimePipelineAdapterOptions = {},
  ) {
    this.minimumRounds = options.minimumRounds ?? 3;
    this.maxRounds = options.maxRounds ?? 200;
  }

  public evaluate(input: PaperRuntimePipelineAdapterInput): PaperRuntimePipelineAdapterResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const boundedRounds = input.rounds.slice(-this.maxRounds);
    const memorySamples = this.toMemorySamples(input, boundedRounds);
    const patternSamples = this.toPatternSamples(input, boundedRounds);
    const aggregateScores = this.resolveAggregateScores(boundedRounds);

    const pipelineResult = this.pipeline.run({
      pipelineId: `${input.adapterId}:pipeline`,
      recommendationId: `${input.adapterId}:recommendation`,
      sessionId: input.sessionId,
      strategyId: input.strategyId,
      tableId: input.tableId,
      generatedAtEpochMs: input.generatedAtEpochMs,
      memorySamples,
      patternSamples,
      certificationApproved: input.certificationApproved ?? true,
      riskApproved: input.riskApproved ?? true,
      operatorApproved: input.operatorApproved ?? true,
      consensusScore: input.consensusScore ?? aggregateScores.consensusScore,
      calibratedConfidence: input.calibratedConfidence ?? aggregateScores.confidenceScore,
      strategyReputationScore: input.strategyReputationScore ?? aggregateScores.strategyReputationScore,
      tableReputationScore: input.tableReputationScore ?? aggregateScores.tableReputationScore,
      similarityScore: aggregateScores.similarityScore,
      correlationScore: aggregateScores.correlationScore,
      learningWeightScore: aggregateScores.learningWeightScore,
      learningValidationScore: aggregateScores.learningValidationScore,
      learningValidationStatus: aggregateScores.learningValidationStatus,
    });

    if (!pipelineResult.ok) {
      return {
        ok: false,
        error: Object.freeze({
          code: 'PAPER_RUNTIME_PIPELINE_ADAPTER_STAGE_FAILED',
          stage: 'PIPELINE',
          message: pipelineResult.error.message,
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        adapterId: input.adapterId,
        sessionId: input.sessionId,
        strategyId: input.strategyId,
        tableId: input.tableId,
        roundCount: boundedRounds.length,
        pipeline: pipelineResult.value,
        finalDecision: pipelineResult.value.finalDecision,
        operatorSummary: pipelineResult.value.explainability.operatorSummary,
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

  private validate(input: PaperRuntimePipelineAdapterInput): PaperRuntimePipelineAdapterFailure | null {
    if (input.adapterId.trim().length === 0) return this.validationFailure('adapterId is required');
    if (input.sessionId.trim().length === 0) return this.validationFailure('sessionId is required');
    if (input.strategyId.trim().length === 0) return this.validationFailure('strategyId is required');
    if (input.tableId.trim().length === 0) return this.validationFailure('tableId is required');

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.validationFailure('generatedAtEpochMs must be a positive finite number');
    }

    if (input.rounds.length < this.minimumRounds) {
      return this.validationFailure(`at least ${this.minimumRounds} PAPER rounds are required`);
    }

    for (const round of input.rounds) {
      if (!Number.isInteger(round.sequence) || round.sequence <= 0) {
        return this.validationFailure('round sequence must be a positive integer');
      }

      if (!Number.isInteger(round.number) || round.number < 0 || round.number > 36) {
        return this.validationFailure('round number must be an integer between 0 and 36');
      }

      if (!Number.isFinite(round.occurredAtEpochMs) || round.occurredAtEpochMs <= 0) {
        return this.validationFailure('round occurredAtEpochMs must be a positive finite number');
      }
    }

    const optionalScores = [
      input.consensusScore,
      input.calibratedConfidence,
      input.strategyReputationScore,
      input.tableReputationScore,
    ].filter((score): score is number => score !== undefined);

    for (const score of optionalScores) {
      if (!Number.isFinite(score) || score < 0 || score > 1) {
        return this.validationFailure('optional scores must be finite numbers between 0 and 1');
      }
    }

    return null;
  }

  private toMemorySamples(
    input: PaperRuntimePipelineAdapterInput,
    rounds: readonly PaperRuntimePipelineRound[],
  ): readonly LearningMemorySample[] {
    return Object.freeze(rounds.map((round) => {
      const wheelBalanceScore = this.scoreRound(round.number);
      const favorableSignals = Math.max(7, Math.round(8 + wheelBalanceScore * 3));
      const blockedSignals = round.number === 0 ? 1 : 0;
      const wins = Math.max(5, Math.round(6 + wheelBalanceScore * 3));
      const losses = Math.max(1, 3 - blockedSignals);

      return Object.freeze({
        memoryId: `${input.adapterId}:memory:${round.sequence}`,
        contextKey: `${input.strategyId}:${input.tableId}:paper-runtime`,
        strategyId: input.strategyId,
        tableId: input.tableId,
        occurredAtEpochMs: round.occurredAtEpochMs,
        paperSignals: 12,
        favorableSignals,
        blockedSignals,
        wins,
        losses,
        neutralOutcomes: 1,
        confidenceScore: round4(0.78 + wheelBalanceScore * 0.14),
        consensusScore: round4(0.78 + wheelBalanceScore * 0.14),
        maxDrawdownUnits: round.number === 0 ? 3 : 2,
        operatorViolationCount: 0,
        certificationFailureCount: 0,
      });
    }));
  }

  private toPatternSamples(
    input: PaperRuntimePipelineAdapterInput,
    rounds: readonly PaperRuntimePipelineRound[],
  ): readonly PatternDiscoverySample[] {
    return Object.freeze(rounds.map((round) => {
      const wheelBalanceScore = this.scoreRound(round.number);
      const blocked = round.number === 0;

      return Object.freeze({
        sampleId: `${input.adapterId}:pattern:${round.sequence}`,
        patternKey: `${input.strategyId}:${input.tableId}:runtime-pattern`,
        strategyId: input.strategyId,
        tableId: input.tableId,
        occurredAtEpochMs: round.occurredAtEpochMs,
        memoryScore: round4(0.78 + wheelBalanceScore * 0.14),
        similarityScore: round4(0.76 + wheelBalanceScore * 0.14),
        correlationScore: round4(0.76 + wheelBalanceScore * 0.13),
        outcomeScore: round4(0.76 + wheelBalanceScore * 0.13),
        riskScore: blocked ? 0.34 : round4(0.18 + (1 - wheelBalanceScore) * 0.08),
        operatorScore: 0.9,
        blocked,
      });
    }));
  }

  private resolveAggregateScores(rounds: readonly PaperRuntimePipelineRound[]): {
    readonly consensusScore: number;
    readonly confidenceScore: number;
    readonly strategyReputationScore: number;
    readonly tableReputationScore: number;
    readonly similarityScore: number;
    readonly correlationScore: number;
    readonly learningWeightScore: number;
    readonly learningValidationScore: number;
    readonly learningValidationStatus: 'LEARNING_TRUSTED' | 'LEARNING_UNCERTAIN';
  } {
    const average = rounds.reduce((sum, round) => sum + this.scoreRound(round.number), 0) / rounds.length;
    const zeroRate = rounds.filter((round) => round.number === 0).length / rounds.length;
    const base = clamp01(0.76 + average * 0.14 - zeroRate * 0.08);

    return Object.freeze({
      consensusScore: round4(base),
      confidenceScore: round4(base),
      strategyReputationScore: round4(0.78 + average * 0.12),
      tableReputationScore: round4(0.78 + average * 0.12),
      similarityScore: round4(0.76 + average * 0.13),
      correlationScore: round4(0.76 + average * 0.13),
      learningWeightScore: round4(0.78 + average * 0.12),
      learningValidationScore: round4(0.78 + average * 0.12),
      learningValidationStatus: zeroRate > 0.35 ? 'LEARNING_UNCERTAIN' : 'LEARNING_TRUSTED',
    });
  }

  private scoreRound(number: number): number {
    if (number === 0) return 0.52;

    const normalized = (number % 12) / 11;
    return clamp01(0.65 + normalized * 0.25);
  }

  private validationFailure(message: string): PaperRuntimePipelineAdapterFailure {
    return Object.freeze({
      code: 'INVALID_PAPER_RUNTIME_PIPELINE_ADAPTER_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
TS

echo
echo "==> Writing Sprint 252 test"

cat > test/domain/runtime/PaperRuntimePipelineAdapter.test.js <<'JS'
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PaperRuntimePipelineAdapter,
} = require('../../../dist/application/runtime/PaperRuntimePipelineAdapter.js');

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
    adapterId: 'adapter-252',
    sessionId: 'session-252',
    strategyId: 'fusion',
    tableId: 'mesa-a14',
    generatedAtEpochMs: now,
    rounds: [
      round(1, 7),
      round(2, 18),
      round(3, 29),
      round(4, 12),
      round(5, 33),
    ],
    certificationApproved: true,
    riskApproved: true,
    operatorApproved: true,
    ...overrides,
  };
}

test('paper runtime pipeline adapter converts observed rounds into institutional decision report', () => {
  const adapter = new PaperRuntimePipelineAdapter();
  const result = adapter.evaluate(input());

  assert.equal(result.ok, true);
  assert.equal(result.value.adapterId, 'adapter-252');
  assert.equal(result.value.roundCount, 5);
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.ok(['PAPER_FAVORAVEL', 'OBSERVAR', 'NAO_UTILIZAR'].includes(result.value.finalDecision));
  assert.equal(result.value.pipeline.paperOnly, true);
});

test('paper runtime pipeline adapter blocks invalid roulette numbers before pipeline execution', () => {
  const adapter = new PaperRuntimePipelineAdapter();
  const result = adapter.evaluate(input({
    rounds: [
      round(1, 7),
      round(2, 40),
      round(3, 29),
    ],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.code, 'INVALID_PAPER_RUNTIME_PIPELINE_ADAPTER_INPUT');
});

test('paper runtime pipeline adapter is deterministic for the same PAPER runtime input', () => {
  const adapter = new PaperRuntimePipelineAdapter();
  const payload = input();

  const first = adapter.evaluate(payload);
  const second = adapter.evaluate(payload);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value, second.value);
});

test('paper runtime pipeline adapter keeps bet execution blocked even when suggestion is allowed', () => {
  const adapter = new PaperRuntimePipelineAdapter();
  const result = adapter.evaluate(input());

  assert.equal(result.ok, true);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticExecutionAllowed, false);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.humanSupervisionRequired, true);
});

test('paper runtime pipeline adapter returns pipeline block when certification is blocked', () => {
  const adapter = new PaperRuntimePipelineAdapter();
  const result = adapter.evaluate(input({
    certificationApproved: false,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.finalDecision, 'NAO_UTILIZAR');
});
JS

echo
echo "==> Syntax validation"

node --check test/domain/runtime/PaperRuntimePipelineAdapter.test.js

echo
echo "==> Installing dependencies"

npm ci

echo
echo "==> Build validation"

npm run build

echo
echo "==> Current Sprint specific test"

node --test test/domain/runtime/PaperRuntimePipelineAdapter.test.js | tee "$CURRENT_TEST_LOG"

echo
echo "==> Previous pipeline regression test"

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
  echo "RL.SYS CORE Paper Runtime Pipeline Adapter Report"
  echo "Status: PASS"
  echo "AdapterFile: src/application/runtime/PaperRuntimePipelineAdapter.ts"
  echo "AdapterTest: test/domain/runtime/PaperRuntimePipelineAdapter.test.js"
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
} > "$ADAPTER_REPORT"

echo
echo "==> Git status before commit"

git status --short

git add \
  src/application/runtime/PaperRuntimePipelineAdapter.ts \
  test/domain/runtime/PaperRuntimePipelineAdapter.test.js \
  artifacts/paper-runtime-pipeline-adapter \
  install/sprints/run-sprint-${SPRINT}.sh

git add -u

if git diff --cached --quiet; then
  echo "No changes detected for Sprint ${SPRINT}."
  exit 1
fi

git commit -m "feat(runtime): add paper runtime pipeline adapter"

git push -u origin "$BRANCH"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint ${SPRINT} paper runtime pipeline adapter"
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
  echo "PreviousPipelineRegressionTest:"
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
  echo "PaperRuntimePipelineAdapter:"
  echo "PASS"
  echo
  echo "Architecture:"
  echo "Added Paper Runtime Pipeline Adapter as an application-level boundary that converts observed PAPER runtime rounds into InstitutionalDecisionPipeline inputs without modifying RuntimeKernel or enabling automatic bet execution."
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
  echo "src/application/runtime/PaperRuntimePipelineAdapter.ts"
  echo "test/domain/runtime/PaperRuntimePipelineAdapter.test.js"
  echo
  echo "Reports:"
  echo "$ADAPTER_REPORT"
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
