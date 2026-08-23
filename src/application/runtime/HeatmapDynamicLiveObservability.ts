import type {
  HeatmapDynamicLiveTerminalSnapshot,
  HeatmapDynamicLiveTerminalSpinResult,
} from './HeatmapDynamicLiveTerminalController.js';


export type HeatmapDynamicObservationState =
  | 'BLOCKED'
  | 'OBSERVE'
  | 'PAPER_READY';


export interface HeatmapDynamicLiveObservation {
  readonly strategyId:
    'heatmap-dynamic';

  readonly liveSpinIndex:
    number;

  readonly spin:
    number;

  readonly state:
    HeatmapDynamicObservationState;

  readonly analyticalMode:
    string;

  readonly signalStrength:
    string;

  readonly fusionPressureScore:
    number;

  readonly recencyPressureScore:
    number;

  readonly dispersionScore:
    number;

  readonly confidenceScore:
    number;

  readonly riskScore:
    number;

  readonly targetRegionId:
    string | null;

  readonly targetNumbers:
    readonly number[];

  readonly targetSize:
    number;

  readonly coveragePercent:
    number;

  readonly appliesFromNextSpin:
    true;

  readonly recommendationIssued:
    boolean;

  readonly registeredDecisionIndex:
    number | null;

  readonly previousSettlementDecisionIndex:
    number | null;

  readonly previousSettlementOutcome:
    'WIN' | 'LOSS' | null;

  readonly blockers:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly summary:
    string;

  readonly paperOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly bankrollChanged:
    false;

  readonly automaticExecution:
    false;
}


/**
 * Operator-facing read-only observability for HEATMAP DYNAMIC.
 *
 * This component has no analytical or settlement authority.
 * It only translates an already-produced controller result.
 */
export class HeatmapDynamicLiveObservability {
  public observe(
    result:
      HeatmapDynamicLiveTerminalSpinResult,
  ): HeatmapDynamicLiveObservation {
    const hypothesis =
      result
        .decision
        .hypothesis;

    const analyticalTopRegion =
      result
        .analysis
        .targetRegions[0] ??
      null;

    const targetRegionId =
      hypothesis
        ?.targetRegionId ??
      analyticalTopRegion
        ?.regionId ??
      null;

    const targetNumbers =
      Object.freeze([
        ...(
          hypothesis
            ?.targetNumbers ??
          analyticalTopRegion
            ?.numbers ??
          []
        ),
      ]);

    const registered =
      result
        .registeredCounterfactualDecision;

    const previousSettlement =
      result
        .previousSettlement;

    return Object.freeze({
      strategyId:
        'heatmap-dynamic' as const,

      liveSpinIndex:
        result.liveSpinIndex,

      spin:
        result.spin,

      state:
        result.decision.status,

      analyticalMode:
        result.analysis.mode,

      signalStrength:
        result.analysis.signalStrength,

      fusionPressureScore:
        result.analysis.fusionPressureScore,

      recencyPressureScore:
        result.analysis.recencyPressureScore,

      dispersionScore:
        result.analysis.dispersionScore,

      confidenceScore:
        result.analysis.fusionConfidenceScore,

      riskScore:
        result.analysis.fusionRiskScore,

      targetRegionId,

      targetNumbers,

      targetSize:
        registered
          ?.targetSize ??
        targetNumbers.length,

      coveragePercent:
        registered
          ?.coveragePercent ??
        this.coveragePercent(
          targetNumbers.length,
        ),

      appliesFromNextSpin:
        true as const,

      recommendationIssued:
        result.decision.status ===
        'PAPER_READY',

      registeredDecisionIndex:
        registered
          ?.decisionIndex ??
        null,

      previousSettlementDecisionIndex:
        previousSettlement
          ?.decisionIndex ??
        null,

      previousSettlementOutcome:
        previousSettlement
          ?.outcome ??
        null,

      blockers:
        Object.freeze([
          ...result
            .decision
            .blockers,
        ]),

      warnings:
        Object.freeze([
          ...result
            .decision
            .warnings,
        ]),

      summary:
        this.summary(
          result,
        ),

      paperOnly:
        true as const,

      recommendationOnly:
        true as const,

      bankrollChanged:
        false as const,

      automaticExecution:
        false as const,
    });
  }


  public status(
    snapshot:
      HeatmapDynamicLiveTerminalSnapshot,
  ): readonly string[] {
    return Object.freeze([
      '',
      'HEATMAP DYNAMIC — STATUS',
      '----------------------------------------',
      `Modo .................... ${snapshot.mode}`,
      `Sync .................... ${snapshot.synchronizedHistorySize}`,
      `Catch-up ................ ${snapshot.catchUpSpinCount}`,
      `LIVE .................... ${snapshot.liveSpinCount}`,
      `Total histórico ......... ${snapshot.totalHistorySize}`,
      `Settlement pendente ..... ${snapshot.counterfactualPending ? 'SIM' : 'NÃO'}`,
      `Settlements ............. ${snapshot.counterfactualSettledCount}`,
      `WIN ..................... ${snapshot.counterfactualWinCount}`,
      `LOSS .................... ${snapshot.counterfactualLossCount}`,
      '',
      'Natureza ................ PAPER / CONTRAFACTUAL',
      'Execução automática ..... NÃO',
      '',
    ]);
  }


  private summary(
    result:
      HeatmapDynamicLiveTerminalSpinResult,
  ): string {
    if (
      result.decision.status ===
      'PAPER_READY'
    ) {
      return (
        'Heatmap Dynamic identificou uma hipótese prospectiva ' +
        'válida exclusivamente para o próximo giro.'
      );
    }

    if (
      result.decision.status ===
      'BLOCKED'
    ) {
      return (
        'Heatmap Dynamic está bloqueado pelos gates analíticos atuais.'
      );
    }

    return (
      'Heatmap Dynamic permanece em observação.'
    );
  }


  private coveragePercent(
    targetSize:
      number,
  ): number {
    if (
      targetSize <=
      0
    ) {
      return 0;
    }

    return Math.round(
      (
        targetSize /
        37
      ) *
      1000,
    ) /
    10;
  }
}
