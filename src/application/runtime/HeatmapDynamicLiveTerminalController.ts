import {
  HeatmapDynamicIntegrationEngine,
  type HeatmapDynamicIntegrationOptions,
  type HeatmapDynamicIntegrationReport,
} from './HeatmapDynamicIntegrationEngine.js';

import {
  HeatmapDynamicProspectiveDecisionSemantics,
  type HeatmapDynamicProspectiveDecision,
} from './HeatmapDynamicProspectiveDecisionSemantics.js';

import {
  HeatmapDynamicCounterfactualSettlementEngine,
  type HeatmapDynamicCounterfactualDecisionPoint,
  type HeatmapDynamicCounterfactualSettlement,
  type HeatmapDynamicCounterfactualSnapshot,
} from './HeatmapDynamicCounterfactualSettlementEngine.js';

import {
  HeatmapDynamicLiveStatsDiagnostics,
  type HeatmapDynamicLiveStatsSnapshot,
} from './HeatmapDynamicLiveStatsDiagnostics.js';


export type HeatmapDynamicLiveTerminalMode =
  | 'AWAITING_HISTORY_CONFIRMATION'
  | 'CATCH_UP'
  | 'LIVE';


export interface HeatmapDynamicLiveTerminalConfiguration {
  readonly sessionId:
    string;

  readonly synchronizedHistory:
    readonly number[];

  readonly analysisOptions?:
    HeatmapDynamicIntegrationOptions;
}


export interface HeatmapDynamicLiveTerminalSnapshot {
  readonly sessionId:
    string;

  readonly strategyId:
    'heatmap-dynamic';

  readonly mode:
    HeatmapDynamicLiveTerminalMode;

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

  readonly latestAnalysis:
    HeatmapDynamicIntegrationReport | null;

  readonly latestDecision:
    HeatmapDynamicProspectiveDecision | null;

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


export interface HeatmapDynamicLiveTerminalSpinResult {
  readonly strategyId:
    'heatmap-dynamic';

  readonly spin:
    number;

  readonly liveSpinIndex:
    number;

  readonly totalHistorySize:
    number;

  readonly appliesFromNextSpin:
    true;

  readonly analysis:
    HeatmapDynamicIntegrationReport;

  readonly decision:
    HeatmapDynamicProspectiveDecision;

  /**
   * Settlement da hipótese criada em um LIVE anterior.
   * Nunca representa a decisão criada pelo próprio giro atual.
   */
  readonly previousSettlement:
    HeatmapDynamicCounterfactualSettlement | null;

  /**
   * Hipótese criada pelo giro atual e congelada exclusivamente
   * para o próximo LIVE aceito.
   */
  readonly registeredCounterfactualDecision:
    HeatmapDynamicCounterfactualDecisionPoint | null;

  readonly counterfactual:
    HeatmapDynamicCounterfactualSnapshot;

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


export interface HeatmapDynamicLiveTerminalAnalyticsPort {
  analyze(
    history:
      readonly number[],

    options?:
      HeatmapDynamicIntegrationOptions,
  ): HeatmapDynamicIntegrationReport;
}


export interface HeatmapDynamicLiveTerminalDecisionPort {
  resolve(
    report:
      HeatmapDynamicIntegrationReport,
  ): HeatmapDynamicProspectiveDecision;
}


/**
 * Canonical prospective controller for HEATMAP DYNAMIC.
 *
 * Temporal lifecycle:
 *
 * SYNC
 *   ↓
 * AWAITING_HISTORY_CONFIRMATION
 *   ↓
 * CATCH_UP opcional
 *   ↓
 * LIVE
 *
 * Para cada LIVE t:
 *
 * 1. valida t;
 * 2. monta candidateHistory contendo t;
 * 3. calcula analysis(t);
 * 4. calcula decision(t);
 * 5. liquida hipótese pendente(t-1) usando t;
 * 6. confirma t na cronologia LIVE;
 * 7. registra eventual PAPER_READY(t) para t+1;
 *
 * Analytics e semantics acontecem antes da mutação do settlement.
 * Portanto uma falha analítica não consome hipótese pendente.
 *
 * O settlement acontece antes do registro da decisão atual.
 * Portanto uma hipótese nunca pode ser liquidada pelo mesmo giro
 * que a criou.
 *
 * Heatmap Dynamic permanece:
 * - PAPER only;
 * - recommendation only;
 * - sem stake;
 * - sem bankroll mutation;
 * - sem martingale;
 * - sem execução automática.
 */
export class HeatmapDynamicLiveTerminalController {
  private readonly sessionId:
    string;

  private readonly analysisOptions:
    HeatmapDynamicIntegrationOptions;

  private readonly synchronizedHistorySize:
    number;

  private history:
    number[];

  private mode:
    HeatmapDynamicLiveTerminalMode =
      'AWAITING_HISTORY_CONFIRMATION';

  private catchUpSpinCount =
    0;

  private liveSpinCount =
    0;

  private latestLiveSpin:
    number | null =
      null;

  private latestAnalysis:
    HeatmapDynamicIntegrationReport | null =
      null;

  private latestDecision:
    HeatmapDynamicProspectiveDecision | null =
      null;

  private readonly counterfactualSettlement:
    HeatmapDynamicCounterfactualSettlementEngine;

  private readonly diagnostics:
    HeatmapDynamicLiveStatsDiagnostics;


  public constructor(
    configuration:
      HeatmapDynamicLiveTerminalConfiguration,

    private readonly analytics:
      HeatmapDynamicLiveTerminalAnalyticsPort =
        new HeatmapDynamicIntegrationEngine(),

    private readonly decisionSemantics:
      HeatmapDynamicLiveTerminalDecisionPort =
        new HeatmapDynamicProspectiveDecisionSemantics(),

    counterfactualSettlement:
      HeatmapDynamicCounterfactualSettlementEngine =
        new HeatmapDynamicCounterfactualSettlementEngine(),

    diagnostics:
      HeatmapDynamicLiveStatsDiagnostics =
        new HeatmapDynamicLiveStatsDiagnostics(),
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

    this.analysisOptions =
      Object.freeze({
        ...configuration
          .analysisOptions,
      });

    this.counterfactualSettlement =
      counterfactualSettlement;

    this.diagnostics =
      diagnostics;
  }


  public confirmHistoryCurrent(
    raw:
      string,
  ): HeatmapDynamicLiveTerminalSnapshot {
    if (
      this.mode !==
      'AWAITING_HISTORY_CONFIRMATION'
    ) {
      throw new Error(
        'heatmap_dynamic_live_history_already_confirmed',
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
      'heatmap_dynamic_live_invalid_history_confirmation',
    );
  }


  public recordCatchUpSpin(
    spin:
      number,
  ): HeatmapDynamicLiveTerminalSnapshot {
    this.requireMode(
      'CATCH_UP',
      'heatmap_dynamic_live_not_in_catch_up',
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
    HeatmapDynamicLiveTerminalSnapshot {
    this.requireMode(
      'CATCH_UP',
      'heatmap_dynamic_live_not_in_catch_up',
    );

    this.mode =
      'LIVE';

    return this.snapshot();
  }


  public ingestLiveSpin(
    spin:
      number,
  ): HeatmapDynamicLiveTerminalSpinResult {
    this.requireMode(
      'LIVE',
      'heatmap_dynamic_live_not_live',
    );

    this.validateSpin(
      spin,
    );

    /*
     * Candidate chronology only.
     *
     * Nenhum estado foi alterado ainda.
     */
    const candidateHistory =
      Object.freeze([
        ...this.history,
        spin,
      ]);

    const analysis =
      this.analytics.analyze(
        candidateHistory,
        this.analysisOptions,
      );

    const decision =
      this.decisionSemantics.resolve(
        analysis,
      );

    /*
     * t liquida somente hipótese que já existia antes de t.
     */
    const previousSettlement =
      this.counterfactualSettlement
        .settleNextSpin(
          spin,
        );

    /*
     * Commit da cronologia somente depois de analytics + semantics
     * terem concluído com sucesso.
     */
    this.history.push(
      spin,
    );

    this.liveSpinCount +=
      1;

    this.latestLiveSpin =
      spin;

    this.latestAnalysis =
      analysis;

    this.latestDecision =
      decision;

    /*
     * decision(t) é registrada somente depois de eventual settlement
     * de decision(t-1). Portanto só poderá ser liquidada em t+1.
     */
    const registeredCounterfactualDecision =
      this.counterfactualSettlement
        .registerDecision(
          decision,
        );

    const result:
      HeatmapDynamicLiveTerminalSpinResult =
      Object.freeze({
      strategyId:
        'heatmap-dynamic' as const,

      spin,

      liveSpinIndex:
        this.liveSpinCount,

      totalHistorySize:
        this.history.length,

      appliesFromNextSpin:
        true as const,

      analysis,

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
  ): HeatmapDynamicLiveStatsSnapshot {
    return this.diagnostics
      .snapshot(
        latestLimit,
      );
  }


  public counterfactualSnapshot():
    HeatmapDynamicCounterfactualSnapshot {
    return this.counterfactualSettlement
      .snapshot();
  }


  public counterfactualHistory():
    readonly HeatmapDynamicCounterfactualSettlement[] {
    return this.counterfactualSettlement
      .history();
  }


  public pendingCounterfactualDecision():
    HeatmapDynamicCounterfactualDecisionPoint | null {
    return this.counterfactualSettlement
      .pendingDecision();
  }


  public snapshot():
    HeatmapDynamicLiveTerminalSnapshot {
    const counterfactual =
      this.counterfactualSettlement
        .snapshot();

    return Object.freeze({
      sessionId:
        this.sessionId,

      strategyId:
        'heatmap-dynamic' as const,

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

      latestAnalysis:
        this.latestAnalysis,

      latestDecision:
        this.latestDecision,

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
      HeatmapDynamicLiveTerminalConfiguration,
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
        'heatmap_dynamic_live_invalid_session_id',
      );
    }

    if (
      !Array.isArray(
        configuration
          .synchronizedHistory,
      )
    ) {
      throw new Error(
        'heatmap_dynamic_live_invalid_history',
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
      HeatmapDynamicLiveTerminalMode,

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
        'heatmap_dynamic_live_invalid_spin',
      );
    }
  }
}
