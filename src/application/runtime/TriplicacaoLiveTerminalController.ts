import {
  TriplicacaoAdvancedProbabilityEngine,
  type TriplicacaoAdvancedProbabilityAnalysis,
} from '../../domain/analytics/TriplicacaoAdvancedProbabilityEngine.js';

import {
  TriplicacaoActionSemantics,
} from './TriplicacaoActionSemantics.js';

import {
  TriplicacaoProspectiveFormationCoordinator,
} from './TriplicacaoProspectiveFormationCoordinator.js';

import {
  TriplicacaoProspectiveRecorder,
  type TriplicacaoProspectiveSignalRecord,
} from './TriplicacaoProspectiveRecorder.js';

import {
  TriplicacaoProspectivePerformanceAnalyzer,
} from './TriplicacaoProspectivePerformanceAnalyzer.js';

import {
  TriplicacaoProspectiveSessionRuntime,
  type TriplicacaoProspectiveSessionResult,
  type TriplicacaoProspectiveSessionSnapshot,
} from './TriplicacaoProspectiveSessionRuntime.js';

import {
  JsonTriplicacaoProspectiveSignalRepository,
} from '../../infrastructure/runtime/JsonTriplicacaoProspectiveSignalRepository.js';

import type {
  PaperCapitalRiskMode,
} from './PaperCapitalPreservationGuard.js';

import type {
  PostSyncCatchUpSnapshot,
} from './PostSyncCatchUpBoundary.js';

import {
  TriplicacaoLiveStatsDiagnostics,
  type TriplicacaoLiveDiagnosticEvent,
  type TriplicacaoLiveStatsReport,
} from './TriplicacaoLiveStatsDiagnostics.js';

import {
  TriplicacaoCounterfactualCalibrationMatrix,
  type TriplicacaoCounterfactualCalibrationReport,
} from './TriplicacaoCounterfactualCalibrationMatrix.js';

import {
  TriplicacaoJointCounterfactualCalibrationMatrix,
  type TriplicacaoJointCalibrationReport,
} from './TriplicacaoJointCounterfactualCalibrationMatrix.js';

import {
  TriplicacaoCounterfactualSettlementEngine,
  type TriplicacaoCounterfactualSettlementReport,
} from './TriplicacaoCounterfactualSettlementEngine.js';


export type TriplicacaoLiveTerminalMode =
  | 'AWAITING_HISTORY_CONFIRMATION'
  | 'CATCH_UP'
  | 'LIVE';


export interface TriplicacaoLiveTerminalConfiguration {
  readonly sessionId:
    string;

  readonly synchronizedHistory:
    readonly number[];

  readonly bankroll:
    number;

  readonly riskMode:
    PaperCapitalRiskMode;

  readonly minimumStake:
    number;

  readonly martingaleEnabled:
    boolean;

  readonly signalRepositoryPath?:
    string;
}


export interface TriplicacaoLiveTerminalSnapshot {
  readonly sessionId:
    string;

  readonly mode:
    TriplicacaoLiveTerminalMode;

  readonly synchronizedHistorySize:
    number;

  readonly catchUpSpinCount:
    number;

  readonly liveSpinCount:
    number;

  readonly totalHistorySize:
    number;

  readonly runtime:
    TriplicacaoProspectiveSessionSnapshot;

  readonly recommendationOnly: true;

  readonly humanExecutionRequired: true;

  readonly automaticBetExecutionAllowed: false;
}


export interface TriplicacaoLiveTerminalSpinResult {
  readonly spin:
    number;

  readonly liveSpinIndex:
    number;

  readonly totalHistorySize:
    number;

  readonly analysis:
    TriplicacaoAdvancedProbabilityAnalysis;

  readonly runtime:
    TriplicacaoProspectiveSessionResult;

  readonly recommendationOnly: true;

  readonly humanExecutionRequired: true;

  readonly automaticBetExecutionAllowed: false;
}


export interface TriplicacaoLiveProbabilityPort {
  analyze(
    history:
      readonly number[],
  ): TriplicacaoAdvancedProbabilityAnalysis;
}


/**
 * Application boundary between the interactive PAPER terminal and
 * the institutional prospective Triplicação runtime.
 *
 * Responsibilities:
 *
 * - preserve synchronized history;
 * - collect post-Sync catch-up spins;
 * - prevent catch-up spins from becoming prospective recommendations;
 * - maintain one canonical analytical history;
 * - evaluate Triplicação Advanced Probability for each LIVE spin;
 * - delegate prospective formation and financial authority to
 *   TriplicacaoProspectiveSessionRuntime.
 *
 * The controller NEVER executes a roulette entry.
 *
 * s/n means only:
 *
 * s = operator reports that the recommendation was followed manually
 * n = operator reports that the recommendation was ignored
 */
export class TriplicacaoLiveTerminalController {
  private readonly sessionId:
    string;

  private readonly synchronizedHistorySize:
    number;

  private readonly history:
    number[];

  private catchUpSpinCount =
    0;

  private liveSpinCount =
    0;

  private readonly diagnosticEvents:
    TriplicacaoLiveDiagnosticEvent[] =
      [];


  private readonly runtime:
    TriplicacaoProspectiveSessionRuntime;


  public constructor(
    configuration:
      TriplicacaoLiveTerminalConfiguration,

    private readonly probabilityEngine:
      TriplicacaoLiveProbabilityPort =
        new TriplicacaoAdvancedProbabilityEngine(),

    private readonly statsDiagnostics:
      TriplicacaoLiveStatsDiagnostics =
        new TriplicacaoLiveStatsDiagnostics(),

    private readonly calibrationMatrix:
      TriplicacaoCounterfactualCalibrationMatrix =
        new TriplicacaoCounterfactualCalibrationMatrix(),

    private readonly jointCalibrationMatrix:
      TriplicacaoJointCounterfactualCalibrationMatrix =
        new TriplicacaoJointCounterfactualCalibrationMatrix(),

    private readonly counterfactualSettlementEngine:
      TriplicacaoCounterfactualSettlementEngine =
        new TriplicacaoCounterfactualSettlementEngine(),
  ) {
    this.validateConfiguration(
      configuration,
    );

    this.sessionId =
      configuration.sessionId.trim();

    this.history =
      [
        ...configuration
          .synchronizedHistory,
      ];

    this.synchronizedHistorySize =
      this.history.length;

    const repository =
      new JsonTriplicacaoProspectiveSignalRepository(
        configuration
          .signalRepositoryPath ??
        this.defaultSignalRepositoryPath(
          this.sessionId,
        ),
      );

    const recorder =
      new TriplicacaoProspectiveRecorder(
        repository,
      );

    this.runtime =
      new TriplicacaoProspectiveSessionRuntime(
        this.sessionId,

        new TriplicacaoProspectiveFormationCoordinator(
          new TriplicacaoActionSemantics(),
        ),

        recorder,

        new TriplicacaoProspectivePerformanceAnalyzer(),

        {
          initialBankroll:
            configuration.bankroll,

          riskMode:
            configuration.riskMode,

          minimumStake:
            configuration.minimumStake,

          martingaleEnabled:
            configuration.martingaleEnabled,
        },
      );
  }


  public confirmHistoryCurrent(
    raw:
      string,
  ): PostSyncCatchUpSnapshot {
    return this.runtime
      .confirmHistoryCurrent(
        raw,
      );
  }


  /**
   * CATCH_UP spins update the analytical history only.
   *
   * They deliberately do NOT enter the prospective formation runtime.
   * Therefore they cannot:
   *
   * - create a recommendation;
   * - affect bankroll;
   * - create recovery debt;
   * - count as FOLLOWED/IGNORED;
   * - contaminate prospective strategy statistics.
   */
  public recordCatchUpSpin(
    spin:
      number,
  ): TriplicacaoLiveTerminalSnapshot {
    this.validateSpin(
      spin,
    );

    const boundary =
      this.runtime
        .recordCatchUpSpin(
          spin,
        );

    if (
      boundary.mode !==
      'CATCH_UP'
    ) {
      throw new Error(
        'triplicacao_live_terminal_catch_up_boundary_invalid',
      );
    }

    this.history.push(
      spin,
    );

    this.catchUpSpinCount +=
      1;

    return this.snapshot();
  }


  public finishCatchUp():
    TriplicacaoLiveTerminalSnapshot {
    const boundary =
      this.runtime
        .finishCatchUp();

    if (
      boundary.mode !==
      'LIVE'
    ) {
      throw new Error(
        'triplicacao_live_terminal_live_boundary_not_established',
      );
    }

    return this.snapshot();
  }


  /**
   * Processes one genuinely prospective LIVE spin.
   *
   * The candidate history is analyzed first.
   * History is committed only after the prospective runtime accepts
   * the spin, preventing partial state mutation after a controlled error.
   */
  public ingestLiveSpin(
    spin:
      number,
  ): TriplicacaoLiveTerminalSpinResult {
    this.validateSpin(
      spin,
    );

    const boundary =
      this.runtime
        .snapshot()
        .postSync;

    if (
      boundary ===
        null ||
      boundary.mode !==
        'LIVE'
    ) {
      throw new Error(
        'triplicacao_live_terminal_not_live',
      );
    }

    const candidateHistory =
      Object.freeze([
        ...this.history,
        spin,
      ]);

    const analysis =
      this.probabilityEngine
        .analyze(
          candidateHistory,
        );

    const runtimeResult =
      this.runtime.ingest({
        sessionId:
          this.sessionId,

        spin,

        analysis,
      });

    this.history.push(
      spin,
    );

    this.liveSpinCount +=
      1;

    const diagnosticEvent =
      this.statsDiagnostics.event({
        liveSpinIndex:
          this.liveSpinCount,

        spin,

        sessionEvent:
          runtimeResult.event,

        formationState:
          runtimeResult.formationState,

        formation:
          runtimeResult.formation,

        recommendationIssued:
          runtimeResult.recommendation !==
          null,

        analysis,
      });

    this.diagnosticEvents.push(
      diagnosticEvent,
    );

    return Object.freeze({
      spin,

      liveSpinIndex:
        this.liveSpinCount,

      totalHistorySize:
        this.history.length,

      analysis,

      runtime:
        runtimeResult,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  public statsSnapshot(
    latestEventLimit:
      number =
        12,
  ): TriplicacaoLiveStatsReport {
    return this.statsDiagnostics.analyze({
      history:
        this.history,

      synchronizedHistorySize:
        this.synchronizedHistorySize,

      catchUpSpinCount:
        this.catchUpSpinCount,

      liveSpinCount:
        this.liveSpinCount,

      events:
        this.diagnosticEvents,

      latestEventLimit,
    });
  }


  public calibrationSnapshot():
    TriplicacaoCounterfactualCalibrationReport {
    return this.calibrationMatrix.analyze({
      events:
        this.diagnosticEvents,
    });
  }


  public jointCalibrationSnapshot():
    TriplicacaoJointCalibrationReport {
    return this.jointCalibrationMatrix.analyze({
      events:
        this.diagnosticEvents,
    });
  }


  public counterfactualSettlementSnapshot():
    TriplicacaoCounterfactualSettlementReport {
    const calibration =
      this.jointCalibrationMatrix.analyze({
        events:
          this.diagnosticEvents,
      });

    return this.counterfactualSettlementEngine.analyze({
      events:
        this.diagnosticEvents,

      calibration,
    });
  }


  public recordOperatorDecision(
    raw:
      string,
  ): TriplicacaoProspectiveSignalRecord {
    return this.runtime
      .recordOperatorDecisionRaw({
        sessionId:
          this.sessionId,

        raw,
      });
  }


  public snapshot():
    TriplicacaoLiveTerminalSnapshot {
    const runtime =
      this.runtime.snapshot();

    const boundary =
      runtime.postSync;

    let mode:
      TriplicacaoLiveTerminalMode;

    if (
      boundary ===
        null ||
      boundary.mode ===
        'AWAITING_CONFIRMATION'
    ) {
      mode =
        'AWAITING_HISTORY_CONFIRMATION';
    } else if (
      boundary.mode ===
      'CATCH_UP'
    ) {
      mode =
        'CATCH_UP';
    } else {
      mode =
        'LIVE';
    }

    return Object.freeze({
      sessionId:
        this.sessionId,

      mode,

      synchronizedHistorySize:
        this.synchronizedHistorySize,

      catchUpSpinCount:
        this.catchUpSpinCount,

      liveSpinCount:
        this.liveSpinCount,

      totalHistorySize:
        this.history.length,

      runtime,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  public historySnapshot():
    readonly number[] {
    return Object.freeze([
      ...this.history,
    ]);
  }


  private validateConfiguration(
    configuration:
      TriplicacaoLiveTerminalConfiguration,
  ): void {
    if (
      typeof configuration.sessionId !==
        'string' ||
      configuration.sessionId
        .trim()
        .length ===
        0
    ) {
      throw new Error(
        'triplicacao_live_terminal_session_required',
      );
    }

    if (
      !Array.isArray(
        configuration
          .synchronizedHistory,
      )
    ) {
      throw new Error(
        'triplicacao_live_terminal_history_required',
      );
    }

    for (
      const spin of
      configuration
        .synchronizedHistory
    ) {
      this.validateSpin(
        spin,
      );
    }

    if (
      !Number.isFinite(
        configuration.bankroll,
      ) ||
      configuration.bankroll <=
        0
    ) {
      throw new Error(
        'triplicacao_live_terminal_invalid_bankroll',
      );
    }

    if (
      configuration.riskMode !==
        'conservative' &&
      configuration.riskMode !==
        'moderate' &&
      configuration.riskMode !==
        'aggressive'
    ) {
      throw new Error(
        'triplicacao_live_terminal_invalid_risk_mode',
      );
    }

    if (
      !Number.isFinite(
        configuration.minimumStake,
      ) ||
      configuration.minimumStake <=
        0
    ) {
      throw new Error(
        'triplicacao_live_terminal_invalid_minimum_stake',
      );
    }

    if (
      typeof configuration
        .martingaleEnabled !==
      'boolean'
    ) {
      throw new Error(
        'triplicacao_live_terminal_invalid_martingale_flag',
      );
    }
  }


  private validateSpin(
    spin:
      number,
  ): void {
    if (
      !Number.isInteger(
        spin,
      ) ||
      spin < 0 ||
      spin > 36
    ) {
      throw new Error(
        'triplicacao_live_terminal_invalid_spin',
      );
    }
  }


  private defaultSignalRepositoryPath(
    sessionId:
      string,
  ): string {
    const safeSessionId =
      sessionId.replace(
        /[^a-zA-Z0-9._-]/g,
        '_',
      );

    return [
      'data',
      'paper-runtime',
      `triplicacao-${safeSessionId}.json`,
    ].join('/');
  }
}
