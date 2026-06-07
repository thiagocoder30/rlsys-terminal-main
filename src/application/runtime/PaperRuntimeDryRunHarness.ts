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
