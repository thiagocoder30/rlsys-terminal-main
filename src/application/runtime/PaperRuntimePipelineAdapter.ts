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
