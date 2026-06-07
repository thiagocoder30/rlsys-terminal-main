#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="251"
NAME="Institutional Decision Pipeline V1"
BRANCH="sprint-251-institutional-decision-pipeline-v1"
OLD_GLOBAL_TEST_BASELINE="1353"

if ! PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: Git repository root not found."
  exit 1
fi

cd "$PROJECT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p \
  logs \
  artifacts/logs \
  artifacts/institutional-decision-pipeline \
  install/sprints \
  src/application/pipeline \
  test/domain/pipeline

LOG_FILE="logs/sprint-${SPRINT}-${TIMESTAMP}.log"
SUCCESS_SUMMARY="artifacts/logs/sprint-${SPRINT}-success-summary.txt"
FAILURE_SUMMARY="artifacts/logs/sprint-${SPRINT}-failure-summary.txt"
CURRENT_TEST_LOG="logs/sprint-${SPRINT}-current-test-${TIMESTAMP}.log"
GLOBAL_TEST_LOG="logs/sprint-${SPRINT}-global-npm-test-${TIMESTAMP}.log"
SUMMARY_PARSE_LOG="artifacts/institutional-decision-pipeline/sprint-${SPRINT}-parsed-node-test-summary.txt"
PIPELINE_REPORT="artifacts/institutional-decision-pipeline/sprint-${SPRINT}-pipeline-report.txt"
DEBUG_TAIL_LOG="artifacts/institutional-decision-pipeline/sprint-${SPRINT}-failure-log-tail.txt"

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

rm -rf artifacts/institutional-decision-pipeline
rm -f src/application/pipeline/InstitutionalDecisionPipeline.ts
rm -f test/domain/pipeline/InstitutionalDecisionPipeline.test.js

mkdir -p artifacts/institutional-decision-pipeline src/application/pipeline test/domain/pipeline

PREVIOUS_HEAD="$(git rev-parse --short HEAD)"
git checkout -b "$BRANCH"
BASE_HEAD="$(git rev-parse --short HEAD)"

echo
echo "==> Writing Institutional Decision Pipeline"

cat > src/application/pipeline/InstitutionalDecisionPipeline.ts <<'TS'
import {
  LearningMemoryLayer,
  type LearningMemoryContextReport,
  type LearningMemoryReport,
  type LearningMemorySample,
} from '../../domain/learning-memory/learning-memory-layer.js';
import {
  InstitutionalPatternDiscoveryEngine,
  type InstitutionalPatternReport,
  type PatternDiscoveryReport,
  type PatternDiscoverySample,
} from '../../domain/institutional-pattern-discovery/institutional-pattern-discovery-engine.js';
import {
  InstitutionalReadinessReviewV2,
  type InstitutionalReadinessReviewV2Report,
  type InstitutionalReadinessV2Module,
  type InstitutionalReadinessV2ModuleStatus,
} from '../../domain/institutional-readiness-review-v2/institutional-readiness-review-v2.js';
import {
  InstitutionalRecommendationEngine,
  type InstitutionalRecommendationReport,
  type LearningValidationStatus,
} from '../../domain/institutional-recommendation/institutional-recommendation-engine.js';
import {
  InstitutionalRecommendationTraceBridge,
  type RecommendationBridgeSeverity,
  type RecommendationTraceBridgeReport,
  type RecommendationExplanationSignal,
} from '../../domain/institutional-recommendation-trace-bridge/institutional-recommendation-trace-bridge.js';
import {
  InstitutionalExplainabilityEngine,
  type InstitutionalExplanationCategory,
  type InstitutionalExplanationSeverity,
  type InstitutionalExplanationSignal,
  type InstitutionalExplainabilityReport,
} from '../../domain/institutional-explainability/institutional-explainability-engine.js';

export type InstitutionalDecisionPipelineStatus =
  | 'PIPELINE_READY'
  | 'PIPELINE_REVIEW'
  | 'PIPELINE_BLOCKED';

export interface InstitutionalDecisionPipelineInput {
  readonly pipelineId: string;
  readonly recommendationId: string;
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly generatedAtEpochMs: number;
  readonly memorySamples: readonly LearningMemorySample[];
  readonly patternSamples: readonly PatternDiscoverySample[];
  readonly certificationApproved: boolean;
  readonly riskApproved: boolean;
  readonly operatorApproved: boolean;
  readonly consensusScore: number;
  readonly calibratedConfidence: number;
  readonly strategyReputationScore: number;
  readonly tableReputationScore: number;
  readonly similarityScore?: number;
  readonly correlationScore?: number;
  readonly learningWeightScore?: number;
  readonly learningValidationScore?: number;
  readonly learningValidationStatus?: LearningValidationStatus;
}

export interface InstitutionalDecisionPipelineReport {
  readonly pipelineId: string;
  readonly status: InstitutionalDecisionPipelineStatus;
  readonly finalDecision: 'PAPER_FAVORAVEL' | 'OBSERVAR' | 'NAO_UTILIZAR';
  readonly readiness: InstitutionalReadinessReviewV2Report;
  readonly memory: LearningMemoryReport;
  readonly patterns: PatternDiscoveryReport;
  readonly recommendation: InstitutionalRecommendationReport;
  readonly traceability: RecommendationTraceBridgeReport;
  readonly explainability: InstitutionalExplainabilityReport;
  readonly selectedMemoryContext: LearningMemoryContextReport | null;
  readonly selectedPattern: InstitutionalPatternReport | null;
  readonly paperOnly: true;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticSuggestionAllowed: true;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface InstitutionalDecisionPipelineFailure {
  readonly code: 'INVALID_INSTITUTIONAL_DECISION_PIPELINE_INPUT' | 'INSTITUTIONAL_DECISION_PIPELINE_STAGE_FAILED';
  readonly stage:
    | 'VALIDATION'
    | 'LEARNING_MEMORY'
    | 'PATTERN_DISCOVERY'
    | 'READINESS'
    | 'RECOMMENDATION'
    | 'TRACE_BRIDGE'
    | 'EXPLAINABILITY';
  readonly message: string;
}

export type InstitutionalDecisionPipelineResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalDecisionPipelineReport;
    }
  | {
      readonly ok: false;
      readonly error: InstitutionalDecisionPipelineFailure;
    };

const clamp01 = (value: number): number => {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

export class InstitutionalDecisionPipeline {
  public constructor(
    private readonly memoryLayer: LearningMemoryLayer = new LearningMemoryLayer(),
    private readonly patternDiscovery: InstitutionalPatternDiscoveryEngine = new InstitutionalPatternDiscoveryEngine(),
    private readonly readinessReview: InstitutionalReadinessReviewV2 = new InstitutionalReadinessReviewV2(),
    private readonly recommendationEngine: InstitutionalRecommendationEngine = new InstitutionalRecommendationEngine(),
    private readonly traceBridge: InstitutionalRecommendationTraceBridge = new InstitutionalRecommendationTraceBridge(),
    private readonly explainabilityEngine: InstitutionalExplainabilityEngine = new InstitutionalExplainabilityEngine(),
  ) {}

  /**
   * Runs the institutional PAPER-only decision pipeline.
   *
   * Complexity:
   * - Learning memory: O(n)
   * - Pattern discovery: O(p + k log k)
   * - Readiness/recommendation/trace/explainability: O(m + r log r)
   *
   * This application service only composes existing domain engines.
   * It never authorizes live money or automatic bet execution.
   */
  public run(input: InstitutionalDecisionPipelineInput): InstitutionalDecisionPipelineResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const memoryResult = this.memoryLayer.evaluate(input.memorySamples);

    if (!memoryResult.ok) {
      return this.fail('LEARNING_MEMORY', memoryResult.error.message);
    }

    const patternResult = this.patternDiscovery.discover(input.patternSamples);

    if (!patternResult.ok) {
      return this.fail('PATTERN_DISCOVERY', patternResult.error.message);
    }

    const selectedMemoryContext = this.selectMemoryContext(memoryResult.value, input);
    const selectedPattern = this.selectPattern(patternResult.value, input);

    const readinessResult = this.readinessReview.review({
      reviewId: `${input.pipelineId}:readiness`,
      generatedAtEpochMs: input.generatedAtEpochMs,
      modules: this.buildReadinessModules(input, memoryResult.value, patternResult.value, selectedMemoryContext, selectedPattern),
    });

    if (!readinessResult.ok) {
      return this.fail('READINESS', readinessResult.error.message);
    }

    const memoryScore = selectedMemoryContext?.memoryScore ?? 0;
    const patternScore = selectedPattern?.patternScore ?? 0;
    const similarityScore = input.similarityScore ?? selectedPattern?.averageSimilarityScore ?? 0;
    const correlationScore = input.correlationScore ?? selectedPattern?.averageCorrelationScore ?? 0;
    const learningValidationScore = input.learningValidationScore ?? this.resolveLearningValidationScore(memoryResult.value, patternResult.value);
    const learningWeightScore = input.learningWeightScore ?? round4((memoryScore + patternScore + learningValidationScore) / 3);
    const learningValidationStatus = input.learningValidationStatus ?? this.resolveLearningValidationStatus(memoryResult.value, patternResult.value);

    const recommendationResult = this.recommendationEngine.recommend({
      recommendationId: input.recommendationId,
      sessionId: input.sessionId,
      strategyId: input.strategyId,
      tableId: input.tableId,
      readinessApproved: readinessResult.value.status === 'PAPER_READY',
      certificationApproved: input.certificationApproved,
      riskApproved: input.riskApproved,
      operatorApproved: input.operatorApproved,
      consensusScore: input.consensusScore,
      calibratedConfidence: input.calibratedConfidence,
      strategyReputationScore: input.strategyReputationScore,
      tableReputationScore: input.tableReputationScore,
      memoryScore,
      similarityScore,
      correlationScore,
      patternScore,
      learningWeightScore,
      learningValidationScore,
      learningValidationStatus,
    });

    if (!recommendationResult.ok) {
      return this.fail('RECOMMENDATION', recommendationResult.error.message);
    }

    const traceResult = this.traceBridge.bridge({
      recommendationId: recommendationResult.value.recommendationId,
      sessionId: recommendationResult.value.sessionId,
      strategyId: recommendationResult.value.strategyId,
      tableId: recommendationResult.value.tableId,
      decision: recommendationResult.value.decision,
      institutionalScore: recommendationResult.value.institutionalScore,
      learningScore: recommendationResult.value.learningScore,
      defensiveBlock: recommendationResult.value.defensiveBlock,
      occurredAtEpochMs: input.generatedAtEpochMs,
      reasons: recommendationResult.value.reasons,
    });

    if (!traceResult.ok) {
      return this.fail('TRACE_BRIDGE', traceResult.error.message);
    }

    const explainabilityResult = this.explainabilityEngine.explain({
      sessionId: input.sessionId,
      strategyId: input.strategyId,
      tableId: input.tableId,
      decisionStatus: recommendationResult.value.decision,
      calibratedConfidence: input.calibratedConfidence,
      institutionalScore: recommendationResult.value.institutionalScore,
      signals: this.toExplainabilitySignals(traceResult.value.explanationSignals, readinessResult.value.readinessScore),
    });

    if (!explainabilityResult.ok) {
      return this.fail('EXPLAINABILITY', explainabilityResult.error.message);
    }

    return {
      ok: true,
      value: Object.freeze({
        pipelineId: input.pipelineId,
        status: this.resolvePipelineStatus(recommendationResult.value.decision),
        finalDecision: recommendationResult.value.decision,
        readiness: readinessResult.value,
        memory: memoryResult.value,
        patterns: patternResult.value,
        recommendation: recommendationResult.value,
        traceability: traceResult.value,
        explainability: explainabilityResult.value,
        selectedMemoryContext,
        selectedPattern,
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

  private validate(input: InstitutionalDecisionPipelineInput): InstitutionalDecisionPipelineFailure | null {
    if (input.pipelineId.trim().length === 0) return this.validationFailure('pipelineId is required');
    if (input.recommendationId.trim().length === 0) return this.validationFailure('recommendationId is required');
    if (input.sessionId.trim().length === 0) return this.validationFailure('sessionId is required');
    if (input.strategyId.trim().length === 0) return this.validationFailure('strategyId is required');
    if (input.tableId.trim().length === 0) return this.validationFailure('tableId is required');
    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.validationFailure('generatedAtEpochMs must be a positive finite number');
    }

    if (input.memorySamples.length === 0) return this.validationFailure('memorySamples cannot be empty');
    if (input.patternSamples.length === 0) return this.validationFailure('patternSamples cannot be empty');

    const scores = [
      input.consensusScore,
      input.calibratedConfidence,
      input.strategyReputationScore,
      input.tableReputationScore,
      input.similarityScore ?? 0.5,
      input.correlationScore ?? 0.5,
      input.learningWeightScore ?? 0.5,
      input.learningValidationScore ?? 0.5,
    ];

    for (const score of scores) {
      if (!Number.isFinite(score) || score < 0 || score > 1) {
        return this.validationFailure('all score inputs must be finite numbers between 0 and 1');
      }
    }

    return null;
  }

  private buildReadinessModules(
    input: InstitutionalDecisionPipelineInput,
    memory: LearningMemoryReport,
    patterns: PatternDiscoveryReport,
    selectedMemoryContext: LearningMemoryContextReport | null,
    selectedPattern: InstitutionalPatternReport | null,
  ): readonly InstitutionalReadinessV2Module[] {
    return Object.freeze([
      this.module('PAPER_ONLY_POLICY_LOCK', 'ENABLED', 1, true),
      this.module('LEARNING_LAYER_READY', this.statusFromBlocked(memory.status === 'MEMORY_BLOCKED', memory.status === 'MEMORY_DEGRADED'), selectedMemoryContext?.memoryScore ?? 0, true),
      this.module('PATTERN_DISCOVERY_READY', this.statusFromBlocked(patterns.status === 'PATTERN_BLOCKED', patterns.status === 'PATTERN_DEGRADED'), selectedPattern?.patternScore ?? 0, true),
      this.module('CORE_GOVERNANCE_READY', 'ENABLED', 1, true),
      this.module('PAPER_RUNTIME_READY', 'ENABLED', 0.95, true),
      this.module('RECOMMENDATION_LAYER_READY', 'ENABLED', 0.95, true),
      this.module('TRACEABILITY_LAYER_READY', 'ENABLED', 0.95, true),
      this.module('CERTIFICATION_READY', input.certificationApproved ? 'ENABLED' : 'BLOCKED', input.certificationApproved ? 1 : 0, true),
      this.module('RISK_READY', input.riskApproved ? 'ENABLED' : 'BLOCKED', input.riskApproved ? 1 : 0, true),
      this.module('OPERATOR_READY', input.operatorApproved ? 'ENABLED' : 'DEGRADED', input.operatorApproved ? 1 : 0.55, false),
      this.module('CONSENSUS_READY', input.consensusScore >= 0.55 ? 'ENABLED' : 'DEGRADED', input.consensusScore, false),
      this.module('CONFIDENCE_READY', input.calibratedConfidence >= 0.55 ? 'ENABLED' : 'DEGRADED', input.calibratedConfidence, false),
    ]);
  }

  private module(
    moduleName: string,
    status: InstitutionalReadinessV2ModuleStatus,
    score: number,
    critical: boolean,
  ): InstitutionalReadinessV2Module {
    return Object.freeze({
      moduleName,
      status,
      score: clamp01(score),
      critical,
    });
  }

  private statusFromBlocked(blocked: boolean, degraded: boolean): InstitutionalReadinessV2ModuleStatus {
    if (blocked) return 'BLOCKED';
    if (degraded) return 'DEGRADED';
    return 'ENABLED';
  }

  private selectMemoryContext(
    report: LearningMemoryReport,
    input: InstitutionalDecisionPipelineInput,
  ): LearningMemoryContextReport | null {
    const matching = report.contexts.filter(
      (context) => context.strategyId === input.strategyId && context.tableId === input.tableId,
    );
    const candidates = matching.length > 0 ? matching : report.contexts;

    if (candidates.length === 0) return null;

    return [...candidates].sort((left, right) => {
      const scoreDelta = right.memoryScore - left.memoryScore;
      if (scoreDelta !== 0) return scoreDelta;
      return left.contextKey.localeCompare(right.contextKey);
    })[0] ?? null;
  }

  private selectPattern(
    report: PatternDiscoveryReport,
    input: InstitutionalDecisionPipelineInput,
  ): InstitutionalPatternReport | null {
    const matching = report.patterns.filter(
      (pattern) => pattern.strategyId === input.strategyId && pattern.tableId === input.tableId,
    );
    const candidates = matching.length > 0 ? matching : report.patterns;

    if (candidates.length === 0) return null;

    return [...candidates].sort((left, right) => {
      const scoreDelta = right.patternScore - left.patternScore;
      if (scoreDelta !== 0) return scoreDelta;
      return left.patternKey.localeCompare(right.patternKey);
    })[0] ?? null;
  }

  private resolveLearningValidationScore(memory: LearningMemoryReport, patterns: PatternDiscoveryReport): number {
    const memoryScore = memory.contexts.length === 0
      ? 0
      : memory.contexts.reduce((sum, item) => sum + item.memoryScore, 0) / memory.contexts.length;
    const patternScore = patterns.patterns.length === 0
      ? 0
      : patterns.patterns.reduce((sum, item) => sum + item.patternScore, 0) / patterns.patterns.length;

    return round4(clamp01((memoryScore + patternScore) / 2));
  }

  private resolveLearningValidationStatus(
    memory: LearningMemoryReport,
    patterns: PatternDiscoveryReport,
  ): LearningValidationStatus {
    if (memory.status === 'MEMORY_BLOCKED' || patterns.status === 'PATTERN_BLOCKED') {
      return 'LEARNING_BLOCKED';
    }

    if (memory.status === 'MEMORY_DEGRADED' || patterns.status === 'PATTERN_DEGRADED') {
      return 'LEARNING_UNCERTAIN';
    }

    if (memory.status === 'MEMORY_SUPPORTS_PAPER' && patterns.status === 'PATTERN_SUPPORTS_PAPER') {
      return 'LEARNING_TRUSTED';
    }

    return 'LEARNING_UNCERTAIN';
  }

  private toExplainabilitySignals(
    bridgeSignals: readonly RecommendationExplanationSignal[],
    readinessScore: number,
  ): readonly InstitutionalExplanationSignal[] {
    const signals = bridgeSignals.map((signal) => Object.freeze({
      category: this.mapCategory(signal.category),
      severity: this.mapSeverity(signal.severity),
      code: signal.code,
      message: signal.message,
      score: signal.score,
    }));

    return Object.freeze([
      ...signals,
      Object.freeze({
        category: 'READINESS' as const,
        severity: readinessScore >= 0.82 ? 'INFO' as const : readinessScore >= 0.58 ? 'WARNING' as const : 'BLOCKER' as const,
        code: 'PIPELINE_READINESS_SCORE',
        message: `Readiness institucional consolidado: ${readinessScore}.`,
        score: readinessScore,
      }),
    ]);
  }

  private mapCategory(category: RecommendationExplanationSignal['category']): InstitutionalExplanationCategory {
    if (category === 'POLICY') return 'POLICY';
    if (category === 'LEARNING') return 'MEMORY';
    if (category === 'RISK') return 'RISK';
    if (category === 'OPERATOR') return 'OPERATOR';
    if (category === 'RECOMMENDATION') return 'SYSTEM';
    return 'SYSTEM';
  }

  private mapSeverity(severity: RecommendationBridgeSeverity): InstitutionalExplanationSeverity {
    if (severity === 'BLOCKER') return 'BLOCKER';
    if (severity === 'WARNING') return 'WARNING';
    return 'INFO';
  }

  private resolvePipelineStatus(decision: InstitutionalDecisionPipelineReport['finalDecision']): InstitutionalDecisionPipelineStatus {
    if (decision === 'PAPER_FAVORAVEL') return 'PIPELINE_READY';
    if (decision === 'OBSERVAR') return 'PIPELINE_REVIEW';
    return 'PIPELINE_BLOCKED';
  }

  private fail(
    stage: InstitutionalDecisionPipelineFailure['stage'],
    message: string,
  ): InstitutionalDecisionPipelineResult {
    return {
      ok: false,
      error: Object.freeze({
        code: 'INSTITUTIONAL_DECISION_PIPELINE_STAGE_FAILED',
        stage,
        message,
      }),
    };
  }

  private validationFailure(message: string): InstitutionalDecisionPipelineFailure {
    return Object.freeze({
      code: 'INVALID_INSTITUTIONAL_DECISION_PIPELINE_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
TS

echo
echo "==> Writing Sprint 251 test"

cat > test/domain/pipeline/InstitutionalDecisionPipeline.test.js <<'JS'
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  InstitutionalDecisionPipeline,
} = require('../../../dist/application/pipeline/InstitutionalDecisionPipeline.js');

const now = 1760000000000;

function memorySample(id, overrides = {}) {
  return {
    memoryId: `memory-${id}`,
    contextKey: 'fusion:a14:stable',
    strategyId: 'fusion',
    tableId: 'mesa-a14',
    occurredAtEpochMs: now + id,
    paperSignals: 12,
    favorableSignals: 9,
    blockedSignals: 1,
    wins: 7,
    losses: 2,
    neutralOutcomes: 1,
    confidenceScore: 0.86,
    consensusScore: 0.88,
    maxDrawdownUnits: 2,
    operatorViolationCount: 0,
    certificationFailureCount: 0,
    ...overrides,
  };
}

function patternSample(id, overrides = {}) {
  return {
    sampleId: `pattern-${id}`,
    patternKey: 'fusion-pattern-stable',
    strategyId: 'fusion',
    tableId: 'mesa-a14',
    occurredAtEpochMs: now + id,
    memoryScore: 0.88,
    similarityScore: 0.84,
    correlationScore: 0.82,
    outcomeScore: 0.81,
    riskScore: 0.22,
    operatorScore: 0.9,
    blocked: false,
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    pipelineId: 'pipeline-251',
    recommendationId: 'recommendation-251',
    sessionId: 'session-251',
    strategyId: 'fusion',
    tableId: 'mesa-a14',
    generatedAtEpochMs: now,
    memorySamples: [memorySample(1), memorySample(2), memorySample(3)],
    patternSamples: [patternSample(1), patternSample(2), patternSample(3)],
    certificationApproved: true,
    riskApproved: true,
    operatorApproved: true,
    consensusScore: 0.88,
    calibratedConfidence: 0.86,
    strategyReputationScore: 0.84,
    tableReputationScore: 0.82,
    similarityScore: 0.84,
    correlationScore: 0.82,
    learningWeightScore: 0.86,
    learningValidationScore: 0.88,
    learningValidationStatus: 'LEARNING_TRUSTED',
    ...overrides,
  };
}

test('institutional decision pipeline returns PAPER_FAVORAVEL for aligned PAPER context', () => {
  const pipeline = new InstitutionalDecisionPipeline();
  const result = pipeline.run(baseInput());

  assert.equal(result.ok, true);
  assert.equal(result.value.finalDecision, 'PAPER_FAVORAVEL');
  assert.equal(result.value.status, 'PIPELINE_READY');
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.recommendation.paperOnly, true);
  assert.equal(result.value.traceability.paperOnly, true);
  assert.equal(result.value.explainability.paperOnly, true);
});

test('institutional decision pipeline blocks when certification gate is blocked', () => {
  const pipeline = new InstitutionalDecisionPipeline();
  const result = pipeline.run(baseInput({
    certificationApproved: false,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.finalDecision, 'NAO_UTILIZAR');
  assert.equal(result.value.status, 'PIPELINE_BLOCKED');
  assert.equal(result.value.recommendation.defensiveBlock, true);
});

test('institutional decision pipeline is deterministic and idempotent for same input', () => {
  const pipeline = new InstitutionalDecisionPipeline();
  const input = baseInput();

  const first = pipeline.run(input);
  const second = pipeline.run(input);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value, second.value);
});

test('institutional decision pipeline validates required identity fields', () => {
  const pipeline = new InstitutionalDecisionPipeline();
  const result = pipeline.run(baseInput({
    pipelineId: '',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.code, 'INVALID_INSTITUTIONAL_DECISION_PIPELINE_INPUT');
});

test('institutional decision pipeline returns review or block for degraded learning context', () => {
  const pipeline = new InstitutionalDecisionPipeline();
  const result = pipeline.run(baseInput({
    memorySamples: [
      memorySample(1, { favorableSignals: 2, blockedSignals: 6, wins: 1, losses: 8, confidenceScore: 0.42, consensusScore: 0.44, maxDrawdownUnits: 9 }),
      memorySample(2, { favorableSignals: 2, blockedSignals: 6, wins: 1, losses: 8, confidenceScore: 0.42, consensusScore: 0.44, maxDrawdownUnits: 9 }),
      memorySample(3, { favorableSignals: 2, blockedSignals: 6, wins: 1, losses: 8, confidenceScore: 0.42, consensusScore: 0.44, maxDrawdownUnits: 9 }),
    ],
    patternSamples: [
      patternSample(1, { memoryScore: 0.35, similarityScore: 0.36, correlationScore: 0.34, outcomeScore: 0.35, riskScore: 0.82, operatorScore: 0.4, blocked: true }),
      patternSample(2, { memoryScore: 0.35, similarityScore: 0.36, correlationScore: 0.34, outcomeScore: 0.35, riskScore: 0.82, operatorScore: 0.4, blocked: true }),
      patternSample(3, { memoryScore: 0.35, similarityScore: 0.36, correlationScore: 0.34, outcomeScore: 0.35, riskScore: 0.82, operatorScore: 0.4, blocked: true }),
    ],
    learningValidationStatus: 'LEARNING_UNCERTAIN',
    learningValidationScore: 0.42,
    learningWeightScore: 0.4,
  }));

  assert.equal(result.ok, true);
  assert.notEqual(result.value.finalDecision, 'PAPER_FAVORAVEL');
});
JS

echo
echo "==> Syntax validation"

node --check test/domain/pipeline/InstitutionalDecisionPipeline.test.js

echo
echo "==> Installing dependencies"

npm ci

echo
echo "==> Build validation"

npm run build

echo
echo "==> Current Sprint specific test"

node --test test/domain/pipeline/InstitutionalDecisionPipeline.test.js | tee "$CURRENT_TEST_LOG"

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
  echo "RL.SYS CORE Institutional Decision Pipeline Report"
  echo "Status: PASS"
  echo "PipelineFile: src/application/pipeline/InstitutionalDecisionPipeline.ts"
  echo "PipelineTest: test/domain/pipeline/InstitutionalDecisionPipeline.test.js"
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
} > "$PIPELINE_REPORT"

echo
echo "==> Git status before commit"

git status --short

git add \
  src/application/pipeline/InstitutionalDecisionPipeline.ts \
  test/domain/pipeline/InstitutionalDecisionPipeline.test.js \
  artifacts/institutional-decision-pipeline \
  install/sprints/run-sprint-${SPRINT}.sh

git add -u

if git diff --cached --quiet; then
  echo "No changes detected for Sprint ${SPRINT}."
  exit 1
fi

git commit -m "feat(pipeline): add institutional decision pipeline v1"

git push -u origin "$BRANCH"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint ${SPRINT} institutional decision pipeline v1"
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
  echo "InstitutionalDecisionPipeline:"
  echo "PASS"
  echo
  echo "Architecture:"
  echo "Added Institutional Decision Pipeline V1 as an application-level orchestrator that composes existing PAPER-only engines: LearningMemoryLayer, InstitutionalPatternDiscoveryEngine, InstitutionalReadinessReviewV2, InstitutionalRecommendationEngine, InstitutionalRecommendationTraceBridge, and InstitutionalExplainabilityEngine."
  echo
  echo "Complexity:"
  echo "Time: O(n + p + k log k + r log r)"
  echo "Space: O(k + r)"
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
  echo "src/application/pipeline/InstitutionalDecisionPipeline.ts"
  echo "test/domain/pipeline/InstitutionalDecisionPipeline.test.js"
  echo
  echo "Reports:"
  echo "$PIPELINE_REPORT"
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
