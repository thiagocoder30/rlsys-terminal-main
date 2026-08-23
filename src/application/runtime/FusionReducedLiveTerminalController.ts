import {
  FusionReducedDoctrineEngine,
  type FusionReducedDoctrineSnapshot,
} from './FusionReducedDoctrineEngine.js';

import {
  FusionReducedEvidenceEngine,
  type FusionReducedEvidenceOptions,
  type FusionReducedEvidenceReport,
} from './FusionReducedEvidenceEngine.js';

import {
  FusionReducedProspectiveDecisionSemantics,
  type FusionReducedProspectiveDecision,
} from './FusionReducedProspectiveDecisionSemantics.js';

import {
  FusionReducedCounterfactualSettlementEngine,
  type FusionReducedCounterfactualDecisionPoint,
  type FusionReducedCounterfactualSettlement,
  type FusionReducedCounterfactualSnapshot,
} from './FusionReducedCounterfactualSettlementEngine.js';

import {
  FusionReducedLiveStatsDiagnostics,
  type FusionReducedLiveStatsSnapshot,
} from './FusionReducedLiveStatsDiagnostics.js';


export type FusionReducedLiveTerminalMode =
  | 'AWAITING_HISTORY_CONFIRMATION'
  | 'CATCH_UP'
  | 'LIVE';


export interface FusionReducedLiveTerminalConfiguration {
  readonly sessionId:
    string;

  readonly synchronizedHistory:
    readonly number[];

  readonly evidenceOptions?:
    FusionReducedEvidenceOptions;
}


export interface FusionReducedLiveTerminalSnapshot {
  readonly sessionId:
    string;

  readonly strategyId:
    'fusion-reduced';

  readonly mode:
    FusionReducedLiveTerminalMode;

  readonly synchronizedHistorySize:
    number;

  readonly catchUpSpinCount:
    number;

  readonly liveSpinCount:
    number;

  readonly totalHistorySize:
    number;

  readonly latestLiveSpin:
    number | null;

  readonly latestEvidence:
    FusionReducedEvidenceReport | null;

  readonly latestDecision:
    FusionReducedProspectiveDecision | null;

  readonly doctrine:
    FusionReducedDoctrineSnapshot;

  readonly counterfactualPending:
    boolean;

  readonly counterfactualSettledCount:
    number;

  readonly counterfactualWinCount:
    number;

  readonly counterfactualLossCount:
    number;

  readonly paperOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly humanExecutionRequired:
    true;

  readonly bankrollChanged:
    false;

  readonly liveMoneyAuthorization:
    false;

  readonly automaticBetExecutionAllowed:
    false;
}


export interface FusionReducedLiveTerminalSpinResult {
  readonly strategyId:
    'fusion-reduced';

  readonly spin:
    number;

  readonly liveSpinIndex:
    number;

  readonly totalHistorySize:
    number;

  readonly appliesFromNextSpin:
    true;

  readonly doctrine:
    FusionReducedDoctrineSnapshot;

  readonly evidence:
    FusionReducedEvidenceReport;

  readonly decision:
    FusionReducedProspectiveDecision;

  /**
   * Settlement da hipótese que já existia antes do giro atual.
   */
  readonly previousSettlement:
    FusionReducedCounterfactualSettlement | null;

  /**
   * Hipótese eventualmente criada no giro atual.
   * Só poderá ser liquidada pelo próximo giro LIVE.
   */
  readonly registeredCounterfactualDecision:
    FusionReducedCounterfactualDecisionPoint | null;

  readonly counterfactual:
    FusionReducedCounterfactualSnapshot;

  readonly paperOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly humanExecutionRequired:
    true;

  readonly bankrollChanged:
    false;

  readonly liveMoneyAuthorization:
    false;

  readonly automaticBetExecutionAllowed:
    false;
}


export interface FusionReducedEvidencePort {
  analyze(
    history:
      readonly number[],

    options?:
      FusionReducedEvidenceOptions,
  ): FusionReducedEvidenceReport;
}


export interface FusionReducedDecisionPort {
  resolve(
    evidence:
      FusionReducedEvidenceReport,
  ): FusionReducedProspectiveDecision;
}


/**
 * Canonical LIVE orchestration for FUSION REDUZIDA.
 *
 * Identity:
 *
 * center = 23
 * radius = 9
 * target = 19 fixed European-wheel numbers
 *
 * The controller does NOT define the target.
 * The Doctrine owns the target.
 *
 * The controller does NOT invent the trigger.
 * The EvidenceEngine owns empirical eligibility.
 *
 * Temporal contract for LIVE t:
 *
 * 1. validate t;
 * 2. build candidateHistory including t;
 * 3. calculate evidence(t);
 * 4. resolve decision(t);
 * 5. settle pending decision(t-1) using t;
 * 6. commit t to LIVE chronology;
 * 7. register PAPER_READY(t) for t+1.
 *
 * Thus decision(t) can never settle against spin(t).
 */
export class FusionReducedLiveTerminalController {
  private readonly sessionId:
    string;

  private readonly doctrine:
    FusionReducedDoctrineSnapshot;

  private readonly evidenceOptions:
    FusionReducedEvidenceOptions;

  private readonly synchronizedHistorySize:
    number;

  private readonly evidenceEngine:
    FusionReducedEvidencePort;

  private readonly decisionSemantics:
    FusionReducedDecisionPort;

  private readonly counterfactualSettlement:
    FusionReducedCounterfactualSettlementEngine;

  private readonly diagnostics:
    FusionReducedLiveStatsDiagnostics;

  private history:
    number[];

  private mode:
    FusionReducedLiveTerminalMode =
      'AWAITING_HISTORY_CONFIRMATION';

  private catchUpSpinCount =
    0;

  private liveSpinCount =
    0;

  private latestLiveSpin:
    number | null =
      null;

  private latestEvidence:
    FusionReducedEvidenceReport | null =
      null;

  private latestDecision:
    FusionReducedProspectiveDecision | null =
      null;


  public constructor(
    configuration:
      FusionReducedLiveTerminalConfiguration,

    evidenceEngine?:
      FusionReducedEvidencePort,

    decisionSemantics?:
      FusionReducedDecisionPort,

    counterfactualSettlement:
      FusionReducedCounterfactualSettlementEngine =
        new FusionReducedCounterfactualSettlementEngine(),

    diagnostics:
      FusionReducedLiveStatsDiagnostics =
        new FusionReducedLiveStatsDiagnostics(),
  ) {
    this.validateConfiguration(
      configuration,
    );

    this.sessionId =
      configuration
        .sessionId
        .trim();

    this.history = [
      ...configuration
        .synchronizedHistory,
    ];

    this.synchronizedHistorySize =
      this.history.length;

    this.evidenceOptions =
      Object.freeze({
        ...configuration
          .evidenceOptions,
      });

    this.doctrine =
      new FusionReducedDoctrineEngine()
        .snapshot();

    this.evidenceEngine =
      evidenceEngine ??
      new FusionReducedEvidenceEngine(
        this.doctrine,
      );

    this.decisionSemantics =
      decisionSemantics ??
      new FusionReducedProspectiveDecisionSemantics(
        this.doctrine,
      );

    this.counterfactualSettlement =
      counterfactualSettlement;

    this.diagnostics =
      diagnostics;
  }


  public confirmHistoryCurrent(
    raw:
      string,
  ): FusionReducedLiveTerminalSnapshot {
    if (
      this.mode !==
      'AWAITING_HISTORY_CONFIRMATION'
    ) {
      throw new Error(
        'fusion_reduced_live_history_already_confirmed',
      );
    }

    const normalized =
      raw
        .trim()
        .toLowerCase();

    if (
      normalized ===
      's'
    ) {
      this.mode =
        'LIVE';

      return this.snapshot();
    }

    if (
      normalized ===
      'n'
    ) {
      this.mode =
        'CATCH_UP';

      return this.snapshot();
    }

    throw new Error(
      'fusion_reduced_live_invalid_history_confirmation',
    );
  }


  public recordCatchUpSpin(
    spin:
      number,
  ): FusionReducedLiveTerminalSnapshot {
    this.requireMode(
      'CATCH_UP',
      'fusion_reduced_live_not_in_catch_up',
    );

    this.validateSpin(
      spin,
    );

    this.history.push(
      spin,
    );

    this.catchUpSpinCount +=
      1;

    return this.snapshot();
  }


  public finishCatchUp():
    FusionReducedLiveTerminalSnapshot {
    this.requireMode(
      'CATCH_UP',
      'fusion_reduced_live_not_in_catch_up',
    );

    this.mode =
      'LIVE';

    return this.snapshot();
  }


  public ingestLiveSpin(
    spin:
      number,
  ): FusionReducedLiveTerminalSpinResult {
    this.requireMode(
      'LIVE',
      'fusion_reduced_live_not_live',
    );

    this.validateSpin(
      spin,
    );

    /*
     * Candidate chronology only.
     *
     * No controller state has been committed yet.
     */
    const candidateHistory =
      Object.freeze([
        ...this.history,
        spin,
      ]);

    const evidence =
      this.evidenceEngine
        .analyze(
          candidateHistory,
          this.evidenceOptions,
        );

    const decision =
      this.decisionSemantics
        .resolve(
          evidence,
        );

    /*
     * spin(t) settles exclusively the hypothesis that existed
     * before spin(t).
     */
    const previousSettlement =
      this.counterfactualSettlement
        .settleNextSpin(
          spin,
        );

    /*
     * Commit only after analytical processing succeeded.
     */
    this.history.push(
      spin,
    );

    this.liveSpinCount +=
      1;

    this.latestLiveSpin =
      spin;

    this.latestEvidence =
      evidence;

    this.latestDecision =
      decision;

    /*
     * decision(t) is registered after settlement(t-1).
     * Therefore it is eligible only for t+1.
     */
    const registeredCounterfactualDecision =
      this.counterfactualSettlement
        .registerDecision(
          decision,
        );

    const result:
      FusionReducedLiveTerminalSpinResult =
      Object.freeze({
      strategyId:
        'fusion-reduced' as const,

      spin,

      liveSpinIndex:
        this.liveSpinCount,

      totalHistorySize:
        this.history.length,

      appliesFromNextSpin:
        true as const,

      doctrine:
        this.doctrine,

      evidence,

      decision,

      previousSettlement,

      registeredCounterfactualDecision,

      counterfactual:
        this.counterfactualSettlement
          .snapshot(),

      paperOnly:
        true as const,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      bankrollChanged:
        false as const,

      liveMoneyAuthorization:
        false as const,

      automaticBetExecutionAllowed:
        false as const,
    });

    this.diagnostics.record(
      result,
    );

    return result;
  }


  public statsSnapshot(
    latestLimit:
      number = 12,
  ): FusionReducedLiveStatsSnapshot {
    return this.diagnostics
      .snapshot(
        latestLimit,
      );
  }


  public counterfactualSnapshot():
    FusionReducedCounterfactualSnapshot {
    return this.counterfactualSettlement
      .snapshot();
  }


  public counterfactualHistory():
    readonly FusionReducedCounterfactualSettlement[] {
    return this.counterfactualSettlement
      .history();
  }


  public pendingCounterfactualDecision():
    FusionReducedCounterfactualDecisionPoint | null {
    return this.counterfactualSettlement
      .pendingDecision();
  }


  public snapshot():
    FusionReducedLiveTerminalSnapshot {
    const counterfactual =
      this.counterfactualSettlement
        .snapshot();

    return Object.freeze({
      sessionId:
        this.sessionId,

      strategyId:
        'fusion-reduced' as const,

      mode:
        this.mode,

      synchronizedHistorySize:
        this.synchronizedHistorySize,

      catchUpSpinCount:
        this.catchUpSpinCount,

      liveSpinCount:
        this.liveSpinCount,

      totalHistorySize:
        this.history.length,

      latestLiveSpin:
        this.latestLiveSpin,

      latestEvidence:
        this.latestEvidence,

      latestDecision:
        this.latestDecision,

      doctrine:
        this.doctrine,

      counterfactualPending:
        counterfactual.pending !==
        null,

      counterfactualSettledCount:
        counterfactual.settledCount,

      counterfactualWinCount:
        counterfactual.winCount,

      counterfactualLossCount:
        counterfactual.lossCount,

      paperOnly:
        true as const,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      bankrollChanged:
        false as const,

      liveMoneyAuthorization:
        false as const,

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
      FusionReducedLiveTerminalConfiguration,
  ): void {
    if (
      typeof configuration.sessionId !==
        'string' ||
      configuration
        .sessionId
        .trim()
        .length ===
        0
    ) {
      throw new Error(
        'fusion_reduced_live_invalid_session_id',
      );
    }

    if (
      !Array.isArray(
        configuration
          .synchronizedHistory,
      )
    ) {
      throw new Error(
        'fusion_reduced_live_invalid_history',
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
  }


  private requireMode(
    expected:
      FusionReducedLiveTerminalMode,

    errorCode:
      string,
  ): void {
    if (
      this.mode !==
      expected
    ) {
      throw new Error(
        errorCode,
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
        'fusion_reduced_live_invalid_spin',
      );
    }
  }
}
