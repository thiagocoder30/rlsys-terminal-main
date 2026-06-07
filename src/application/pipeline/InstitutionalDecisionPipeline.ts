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
