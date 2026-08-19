import {
  AnalyticsDecisionEngine,
  type AnalyticsDecisionEngineResult,
} from './AnalyticsDecisionEngine.js';

import {
  OperatorDecisionPresentationAdapter,
  type InstitutionalPipelineDecision,
  type OperatorDecisionPresentationReport,
} from './OperatorDecisionPresentationAdapter.js';

import {
  PaperOracleTargetResolver,
  type PaperOracleTargetResolution,
} from './PaperOracleTargetResolver.js';

import {
  PaperOracleStrategyEnsembleRuntime,
  type PaperOracleStrategyEnsembleReport,
} from './PaperOracleStrategyEnsembleRuntime.js';


export interface PaperLiveOracleAnalyticsPort {
  evaluate(input: {
    readonly warmupRounds: readonly string[];
    readonly liveRounds: readonly string[];
    readonly minimumLiveRounds?: number;
  }): AnalyticsDecisionEngineResult;
}


export interface PaperLiveOraclePresentationPort {
  present(input: {
    readonly strategyName: string;
    readonly finalDecision: InstitutionalPipelineDecision;
    readonly confidenceScore?: number;
    readonly riskScore?: number;
    readonly operatorSummary?: string;
    readonly reasons?: readonly string[];
    readonly warnings?: readonly string[];
    readonly blockers?: readonly string[];
    readonly currentRoundIndex?: number;
    readonly observedRounds?: number;
  }):
    | {
        readonly ok: true;
        readonly value: OperatorDecisionPresentationReport;
      }
    | {
        readonly ok: false;
        readonly error: {
          readonly message: string;
        };
      };
}


export interface PaperLiveOracleTargetPort {
  resolve(input: {
    readonly oracleDecision:
      | 'OBSERVAR'
      | 'WATCHLIST'
      | 'PAPER_FAVORAVEL';

    readonly warmupRounds:
      readonly number[];

    readonly liveRounds:
      readonly number[];

    readonly bankroll:
      number;
  }): PaperOracleTargetResolution;
}


export interface PaperLiveOracleEnsemblePort {
  analyze(
    history:
      readonly number[],
  ): PaperOracleStrategyEnsembleReport;
}


export type PaperLiveOracleDecision =
  | 'OBSERVAR'
  | 'WATCHLIST'
  | 'PAPER_FAVORAVEL'
  | 'BLOQUEADO';


export interface PaperLiveOracleSpinResult {
  readonly spin: number;

  readonly liveRoundIndex: number;

  readonly totalObservedRounds: number;

  readonly oracleDecision:
    PaperLiveOracleDecision;

  readonly analytics:
    AnalyticsDecisionEngineResult;

  readonly ensemble:
    PaperOracleStrategyEnsembleReport;

  readonly target:
    PaperOracleTargetResolution;

  readonly presentation:
    OperatorDecisionPresentationReport;

  readonly warmupRounds:
    readonly number[];

  readonly liveRounds:
    readonly number[];

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticBetExecutionAllowed: false;

  readonly operatorDecisionRequired: true;
}


export interface PaperLiveOracleSnapshot {
  readonly warmupRounds:
    readonly number[];

  readonly liveRounds:
    readonly number[];

  readonly totalObservedRounds:
    number;

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticBetExecutionAllowed: false;
}


/**
 * Live PAPER oracle.
 *
 * Decision flow:
 *
 * AnalyticsDecisionEngine
 *        ↓
 * preliminary signal
 *        ↓
 * PaperOracleStrategyEnsembleRuntime
 *        ↓
 * Triplicação + Fusion consensus
 *        ↓
 * final oracle decision
 *        ↓
 * PaperOracleTargetResolver
 *
 * PAPER_FAVORAVEL requires:
 *
 * 1. Analytics strong signal
 * 2. Strategy ensemble consensus ready
 * 3. No strategy-level block
 *
 * A strong analytical signal alone is not sufficient.
 */
export class PaperLiveOracleEngine {
  private readonly warmup:
    readonly number[];

  private live:
    number[] = [];


  public constructor(
    warmupRounds:
      readonly number[],

    private readonly bankroll:
      number,

    private readonly analytics:
      PaperLiveOracleAnalyticsPort =
        new AnalyticsDecisionEngine(),

    private readonly presenter:
      PaperLiveOraclePresentationPort =
        new OperatorDecisionPresentationAdapter(),

    private readonly targetResolver:
      PaperLiveOracleTargetPort =
        new PaperOracleTargetResolver(),

    private readonly strategyEnsemble:
      PaperLiveOracleEnsemblePort =
        new PaperOracleStrategyEnsembleRuntime(),

    private readonly minimumLiveRounds:
      number = 6,
  ) {
    this.warmup =
      Object.freeze(
        this.normalizeHistory(
          warmupRounds,
        ),
      );

    if (
      this.warmup.length === 0
    ) {
      throw new Error(
        'paper_live_oracle_warmup_required',
      );
    }

    if (
      !Number.isFinite(
        bankroll,
      ) ||
      bankroll <= 0
    ) {
      throw new Error(
        'paper_live_oracle_invalid_bankroll',
      );
    }

    if (
      !Number.isInteger(
        minimumLiveRounds,
      ) ||
      minimumLiveRounds <= 0
    ) {
      throw new Error(
        'paper_live_oracle_invalid_minimum_live_rounds',
      );
    }
  }


  public ingest(
    spin:
      number,
  ): PaperLiveOracleSpinResult {
    this.validateSpin(
      spin,
    );

    this.live.push(
      spin,
    );

    const analytics =
      this.analytics.evaluate({
        warmupRounds:
          this.warmup.map(
            String,
          ),

        liveRounds:
          this.live.map(
            String,
          ),

        minimumLiveRounds:
          this.minimumLiveRounds,
      });

    const history =
      Object.freeze([
        ...this.warmup,
        ...this.live,
      ]);

    const ensemble =
      this.strategyEnsemble.analyze(
        history,
      );

    const oracleDecision =
      this.resolveOracleDecision(
        analytics,
        ensemble,
      );

    const target =
      this.targetResolver.resolve({
        oracleDecision:
          oracleDecision ===
          'BLOQUEADO'
            ? 'OBSERVAR'
            : oracleDecision,

        warmupRounds:
          this.warmup,

        liveRounds:
          Object.freeze([
            ...this.live,
          ]),

        bankroll:
          this.bankroll,
      });

    const institutionalDecision =
      this.toInstitutionalDecision(
        oracleDecision,
        target,
      );

    const presentation =
      this.presenter.present({
        strategyName:
          target.status ===
          'CANDIDATE'
            ? `Triplicação + Fusion + ${target.strategySignal}`
            : 'Triplicação + Fusion',

        finalDecision:
          institutionalDecision,

        confidenceScore:
          analytics.confidence,

        riskScore:
          analytics.risk,

        operatorSummary:
          this.operatorSummary(
            oracleDecision,
            analytics,
            ensemble,
            target,
          ),

        reasons:
          Object.freeze([
            `ANALYTICS_RECOMMENDATION:${analytics.recommendation}`,
            `CONSENSUS_CLASSIFICATION:${analytics.consensus.classification}`,
            `ENGINES_ALIGNED:${analytics.consensus.enginesAligned}/${analytics.consensus.enginesTotal}`,
            `TRIPLICACAO_PATTERN:${analytics.triplicacao.dominantPattern}`,
            `TRIPLICACAO_RATIO:${analytics.triplicacao.dominantRatio}`,

            `STRATEGY_ENSEMBLE_DECISION:${ensemble.decision}`,

            ...(ensemble.ensemble.selectedTarget
              ? [
                  `STRATEGY_ENSEMBLE_SCORE:${ensemble.ensemble.selectedTarget.consensusScore}`,
                  `STRATEGY_ENSEMBLE_SUPPORT:${ensemble.ensemble.selectedTarget.supportVotes}`,
                ]
              : []),

            `TARGET_STATUS:${target.status}`,

            ...ensemble.reasons,
            ...target.reasons,
          ]),

        warnings:
          this.presentationWarnings(
            oracleDecision,
            ensemble,
            target,
          ),

        blockers:
          oracleDecision ===
          'BLOQUEADO'
            ? Object.freeze([
                ...ensemble.blockers,
              ])
            : Object.freeze([]),

        currentRoundIndex:
          this.live.length,

        observedRounds:
          this.warmup.length +
          this.live.length,
      });

    if (
      !presentation.ok
    ) {
      throw new Error(
        `paper_live_oracle_presentation_failed:${presentation.error.message}`,
      );
    }

    return Object.freeze({
      spin,

      liveRoundIndex:
        this.live.length,

      totalObservedRounds:
        this.warmup.length +
        this.live.length,

      oracleDecision,

      analytics,

      ensemble,

      target,

      presentation:
        presentation.value,

      warmupRounds:
        this.warmup,

      liveRounds:
        Object.freeze([
          ...this.live,
        ]),

      paperOnly:
        true as const,

      liveMoneyAuthorization:
        false as const,

      automaticBetExecutionAllowed:
        false as const,

      operatorDecisionRequired:
        true as const,
    });
  }


  public snapshot():
    PaperLiveOracleSnapshot {
    return Object.freeze({
      warmupRounds:
        this.warmup,

      liveRounds:
        Object.freeze([
          ...this.live,
        ]),

      totalObservedRounds:
        this.warmup.length +
        this.live.length,

      paperOnly:
        true as const,

      liveMoneyAuthorization:
        false as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  private resolveOracleDecision(
    analytics:
      AnalyticsDecisionEngineResult,

    ensemble:
      PaperOracleStrategyEnsembleReport,
  ): PaperLiveOracleDecision {
    if (
      ensemble.decision ===
      'BLOCKED'
    ) {
      return 'BLOQUEADO';
    }

    if (
      analytics.recommendation ===
        'PAPER_SINAL_FORTE' &&
      ensemble.consensusReady
    ) {
      return 'PAPER_FAVORAVEL';
    }

    if (
      analytics.recommendation ===
        'PAPER_SINAL_FORTE' &&
      !ensemble.consensusReady
    ) {
      return 'OBSERVAR';
    }

    if (
      analytics.recommendation ===
      'PAPER_SINAL_FRACO'
    ) {
      return 'WATCHLIST';
    }

    return 'OBSERVAR';
  }


  private toInstitutionalDecision(
    decision:
      PaperLiveOracleDecision,

    target:
      PaperOracleTargetResolution,
  ): InstitutionalPipelineDecision {
    if (
      decision ===
        'PAPER_FAVORAVEL' &&
      target.status ===
        'CANDIDATE'
    ) {
      return 'PAPER_FAVORAVEL';
    }

    if (
      decision ===
      'BLOQUEADO'
    ) {
      return 'NAO_UTILIZAR';
    }

    return 'OBSERVAR';
  }


  private operatorSummary(
    decision:
      PaperLiveOracleDecision,

    analytics:
      AnalyticsDecisionEngineResult,

    ensemble:
      PaperOracleStrategyEnsembleReport,

    target:
      PaperOracleTargetResolution,
  ): string {
    if (
      decision ===
      'BLOQUEADO'
    ) {
      return [
        'Uma das estratégias institucionais bloqueou o contexto atual.',
        'Nenhuma entrada PAPER deve ser considerada neste giro.',
      ].join(' ');
    }

    if (
      decision ===
        'PAPER_FAVORAVEL' &&
      target.status ===
        'CANDIDATE'
    ) {
      return [
        'Contexto PAPER confirmado por análise e consenso multi-estratégia.',
        `Consenso estratégico: ${ensemble.ensemble.selectedTarget?.consensusScore ?? 0}.`,
        `Triplicação: ${ensemble.assessments[0].voteStatus}.`,
        `Fusion: ${ensemble.assessments[1].voteStatus}.`,
        `Alvo estratégico: ${target.target}.`,
        `Confiança do alvo: ${target.confidencePercent}%.`,
        `Stake PAPER calculada: R$ ${target.suggestedStake
          .toFixed(2)
          .replace('.', ',')}.`,
        'A decisão de executar ou ignorar continua sendo humana.',
      ].join(' ');
    }

    if (
      analytics.recommendation ===
        'PAPER_SINAL_FORTE' &&
      !ensemble.consensusReady
    ) {
      return [
        'O motor analítico detectou sinal forte, mas Triplicação e Fusion ainda não formaram consenso institucional.',
        'Continuar observando.',
      ].join(' ');
    }

    if (
      decision ===
      'WATCHLIST'
    ) {
      return [
        'Há sinal analítico fraco, mas ele ainda não libera recomendação de entrada.',
        'Continuar observando até confirmação mais forte.',
      ].join(' ');
    }

    if (
      analytics.recommendation ===
      'AGUARDAR'
    ) {
      return [
        'Ainda não há quantidade suficiente de giros ao vivo para avaliação operacional.',
        `Mínimo atual: ${this.minimumLiveRounds}.`,
      ].join(' ');
    }

    return [
      'Nenhuma evidência suficientemente forte foi confirmada neste giro.',
      'Continuar observando.',
    ].join(' ');
  }


  private presentationWarnings(
    oracleDecision:
      PaperLiveOracleDecision,

    ensemble:
      PaperOracleStrategyEnsembleReport,

    target:
      PaperOracleTargetResolution,
  ): readonly string[] {
    if (
      oracleDecision ===
      'WATCHLIST'
    ) {
      return Object.freeze([
        'SINAL_FRACO_NAO_LIBERA_ENTRADA',
        'ORACLE_SEM_SINAL_FORTE',
        ...ensemble.warnings,
      ]);
    }

    if (
      oracleDecision ===
      'OBSERVAR'
    ) {
      return Object.freeze([
        'ORACLE_SEM_CONSENSO_OPERACIONAL',
        ...ensemble.warnings,
      ]);
    }

    if (
      oracleDecision ===
      'BLOQUEADO'
    ) {
      return Object.freeze([
        'ORACLE_ESTRATEGIA_BLOQUEADA',
        ...ensemble.warnings,
      ]);
    }

    if (
      target.status ===
      'NONE'
    ) {
      return Object.freeze([
        'CONTEXTO_FAVORAVEL_SEM_ALVO_OPERACIONAL',
        ...ensemble.warnings,
        ...target.warnings,
      ]);
    }

    return Object.freeze([
      ...ensemble.warnings,
      ...target.warnings,
    ]);
  }


  private normalizeHistory(
    rounds:
      readonly number[],
  ): number[] {
    if (
      !Array.isArray(
        rounds,
      )
    ) {
      throw new Error(
        'paper_live_oracle_invalid_warmup',
      );
    }

    const normalized:
      number[] = [];

    for (
      const round of rounds
    ) {
      this.validateSpin(
        round,
      );

      normalized.push(
        round,
      );
    }

    return normalized;
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
        'paper_live_oracle_invalid_spin',
      );
    }
  }
}
