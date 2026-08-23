import type {
  FusionReducedLiveTerminalSnapshot,
  FusionReducedLiveTerminalSpinResult,
} from './FusionReducedLiveTerminalController.js';


export type FusionReducedObservationState =
  | 'BLOCKED'
  | 'OBSERVE'
  | 'PAPER_READY';


export interface FusionReducedLiveObservation {
  readonly strategyId:
    'fusion-reduced';

  readonly liveSpinIndex:
    number;

  readonly spin:
    number;

  readonly state:
    FusionReducedObservationState;

  readonly eligible:
    boolean;

  readonly confidenceScore:
    number;

  readonly riskScore:
    number;

  readonly observedHitRate:
    number;

  readonly recentHitRate:
    number;

  readonly rateDrift:
    number;

  readonly targetCenter:
    23;

  readonly targetNumbers:
    readonly number[];

  readonly targetSize:
    19;

  readonly coveragePercent:
    number;

  readonly appliesFromNextSpin:
    true;

  readonly recommendationIssued:
    boolean;

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
 * Read-only observability for FUSION REDUZIDA.
 *
 * It does not:
 * - calculate evidence;
 * - decide eligibility;
 * - create hypotheses;
 * - settle hypotheses;
 * - change bankroll;
 * - execute bets.
 */
export class FusionReducedLiveObservability {
  public observe(
    result:
      FusionReducedLiveTerminalSpinResult,
  ): FusionReducedLiveObservation {
    return Object.freeze({
      strategyId:
        'fusion-reduced' as const,

      liveSpinIndex:
        result.liveSpinIndex,

      spin:
        result.spin,

      state:
        result.decision.status,

      eligible:
        result.evidence.eligible,

      confidenceScore:
        result.evidence.confidenceScore,

      riskScore:
        result.evidence.riskScore,

      observedHitRate:
        result.evidence.observedHitRate,

      recentHitRate:
        result.evidence.recentHitRate,

      rateDrift:
        result.evidence.rateDrift,

      targetCenter:
        23 as const,

      targetNumbers:
        Object.freeze([
          ...result
            .doctrine
            .targetNumbers,
        ]),

      targetSize:
        19 as const,

      coveragePercent:
        this.coveragePercent(),

      appliesFromNextSpin:
        true as const,

      recommendationIssued:
        result.decision.status ===
        'PAPER_READY',

      previousSettlementOutcome:
        result.previousSettlement
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
          result.decision.status,
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
      FusionReducedLiveTerminalSnapshot,
  ): readonly string[] {
    return Object.freeze([
      '',
      'FUSION REDUZIDA — STATUS',
      '----------------------------------------',
      `Modo .................... ${snapshot.mode}`,
      `Sync .................... ${snapshot.synchronizedHistorySize}`,
      `Catch-up ................ ${snapshot.catchUpSpinCount}`,
      `LIVE .................... ${snapshot.liveSpinCount}`,
      `Total histórico ......... ${snapshot.totalHistorySize}`,
      '',
      'Alvo fixo ............... 23 ± 9',
      'Números cobertos ........ 19',
      `Cobertura nominal ....... ${this.formatPercent(this.coveragePercent())}`,
      '',
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
    state:
      FusionReducedObservationState,
  ): string {
    if (
      state ===
      'PAPER_READY'
    ) {
      return (
        'Fusion Reduzida liberou hipótese PAPER para o próximo giro.'
      );
    }

    if (
      state ===
      'BLOCKED'
    ) {
      return (
        'Fusion Reduzida está bloqueada pelos gates empíricos atuais.'
      );
    }

    return (
      'Fusion Reduzida permanece em observação.'
    );
  }


  private coveragePercent():
    number {
    return Math.round(
      (
        19 /
        37
      ) *
      10000,
    ) /
    100;
  }


  private formatPercent(
    value:
      number,
  ): string {
    return `${value
      .toFixed(2)
      .replace('.', ',')}%`;
  }
}
