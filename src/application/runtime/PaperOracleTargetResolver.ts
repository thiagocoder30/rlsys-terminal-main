import {
  StrategyEngine,
  type StrategyAnalysis,
  type StrategySignal,
} from '../../domain/services/StrategyEngine.js';


export type PaperOracleTargetStatus =
  | 'NONE'
  | 'CANDIDATE';


export type PaperOracleTargetSector =
  | 'voisins'
  | 'tiers'
  | 'orphelins';


export type PaperOracleTargetSignalType =
  | 'SECTOR_BIAS'
  | 'MARKOV_TRANSITION';


export interface PaperOracleTargetStrategyPort {
  analyze(
    history: number[],
  ): StrategyAnalysis | null;
}


export interface PaperOracleTargetResolverInput {
  readonly oracleDecision:
    'OBSERVAR'
    | 'WATCHLIST'
    | 'PAPER_FAVORAVEL';

  readonly warmupRounds:
    readonly number[];

  readonly liveRounds:
    readonly number[];

  readonly bankroll:
    number;
}


export interface PaperOracleTargetResolution {
  readonly status:
    PaperOracleTargetStatus;

  readonly strategySignal:
    PaperOracleTargetSignalType | null;

  readonly target:
    PaperOracleTargetSector | null;

  readonly confidenceScore:
    number;

  readonly confidencePercent:
    number;

  readonly suggestedFraction:
    number;

  readonly suggestedStake:
    number;

  readonly riskLevel:
    'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL'
    | 'UNAVAILABLE';

  readonly rationale:
    string;

  readonly warnings:
    readonly string[];

  readonly reasons:
    readonly string[];

  readonly analyzedRounds:
    number;

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticBetExecutionAllowed: false;

  readonly operatorDecisionRequired: true;
}


/**
 * Resolves a concrete PAPER target only after the live oracle has already
 * produced PAPER_FAVORAVEL.
 *
 * It does not independently open the operational gate.
 *
 * Current target semantics are European-wheel sectors:
 * - voisins
 * - tiers
 * - orphelins
 *
 * This resolver intentionally does not translate those sectors into
 * red/black, dozens or individual roulette numbers.
 */
export class PaperOracleTargetResolver {
  public constructor(
    private readonly strategyEngine:
      PaperOracleTargetStrategyPort =
        new StrategyEngine(),
  ) {}


  public resolve(
    input:
      PaperOracleTargetResolverInput,
  ): PaperOracleTargetResolution {
    this.validateInput(
      input,
    );

    const history =
      Object.freeze([
        ...input.warmupRounds,
        ...input.liveRounds,
      ]);

    if (
      input.oracleDecision !==
      'PAPER_FAVORAVEL'
    ) {
      return this.none({
        analyzedRounds:
          history.length,

        rationale:
          'O oráculo ainda não confirmou contexto PAPER favorável.',

        reasons: [
          `ORACLE_DECISION:${input.oracleDecision}`,
          'TARGET_RESOLUTION_SKIPPED',
        ],
      });
    }

    const analysis =
      this.strategyEngine.analyze(
        [...history],
      );

    if (
      analysis === null
    ) {
      return this.none({
        analyzedRounds:
          history.length,

        rationale:
          'Amostra insuficiente para resolver um alvo estratégico.',

        reasons: [
          'STRATEGY_ANALYSIS_UNAVAILABLE',
          'TARGET_SAMPLE_INSUFFICIENT',
        ],
      });
    }

    if (
      analysis.status !==
      'ALLOWED'
    ) {
      return this.none({
        analyzedRounds:
          history.length,

        rationale:
          analysis.reason,

        riskLevel:
          analysis.risk.level,

        warnings:
          analysis.risk.warnings,

        reasons: [
          `STRATEGY_STATUS:${analysis.status}`,
          'TARGET_STRATEGY_LOCKED',
        ],
      });
    }

    const candidate =
      this.bestSignal(
        analysis.signals,
      );

    if (
      candidate === null
    ) {
      return this.none({
        analyzedRounds:
          history.length,

        rationale:
          'Nenhum sinal estratégico elegível produziu alvo reconhecido.',

        riskLevel:
          analysis.risk.level,

        warnings:
          analysis.risk.warnings,

        reasons: [
          'TARGET_NO_ELIGIBLE_SIGNAL',
        ],
      });
    }

    /*
     * The StrategyEngine may still classify an ALLOWED analysis as HIGH risk.
     * For the live oracle we fail closed and refuse to surface a concrete
     * target under HIGH/CRITICAL risk.
     */
    if (
      analysis.risk.level ===
        'HIGH' ||
      analysis.risk.level ===
        'CRITICAL'
    ) {
      return this.none({
        analyzedRounds:
          history.length,

        rationale:
          'O motor encontrou um sinal, mas o risco estratégico está alto demais para exibir alvo PAPER.',

        riskLevel:
          analysis.risk.level,

        warnings:
          analysis.risk.warnings,

        reasons: [
          `TARGET_SIGNAL:${candidate.type}`,
          `TARGET_RISK:${analysis.risk.level}`,
          'TARGET_BLOCKED_BY_RISK',
        ],
      });
    }

    const target =
      this.normalizeTarget(
        candidate.target,
      );

    if (
      target === null
    ) {
      return this.none({
        analyzedRounds:
          history.length,

        rationale:
          'O sinal retornou um setor que não pertence ao contrato operacional do oráculo.',

        riskLevel:
          analysis.risk.level,

        warnings:
          analysis.risk.warnings,

        reasons: [
          `TARGET_SIGNAL:${candidate.type}`,
          `TARGET_UNSUPPORTED:${String(candidate.target)}`,
        ],
      });
    }

    const confidenceScore =
      this.clampRatio(
        candidate.confidence,
      );

    const suggestedFraction =
      this.clampFraction(
        analysis.suggestedFraction,
      );

    const suggestedStake =
      this.money(
        input.bankroll *
        suggestedFraction,
      );

    return Object.freeze({
      status:
        'CANDIDATE' as const,

      strategySignal:
        candidate.type,

      target,

      confidenceScore,

      confidencePercent:
        Math.round(
          confidenceScore *
          100,
        ),

      suggestedFraction,

      suggestedStake,

      riskLevel:
        analysis.risk.level,

      rationale:
        candidate.rationale,

      warnings:
        Object.freeze([
          ...analysis.risk.warnings,
        ]),

      reasons:
        Object.freeze([
          'ORACLE_PAPER_FAVORAVEL',
          `TARGET_SIGNAL:${candidate.type}`,
          `TARGET_SECTOR:${target}`,
          `TARGET_CONFIDENCE:${confidenceScore}`,
          `TARGET_FRACTION:${suggestedFraction}`,
        ]),

      analyzedRounds:
        history.length,

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


  private bestSignal(
    signals:
      readonly StrategySignal[],
  ): StrategySignal | null {
    const supported =
      signals.filter(
        (signal) =>
          this.normalizeTarget(
            signal.target,
          ) !== null &&
          Number.isFinite(
            signal.confidence,
          ),
      );

    if (
      supported.length === 0
    ) {
      return null;
    }

    return [...supported]
      .sort(
        (left, right) => {
          if (
            right.confidence !==
            left.confidence
          ) {
            return (
              right.confidence -
              left.confidence
            );
          }

          /*
           * Deterministic tie-break:
           * structural sector bias before transition signal.
           */
          if (
            left.type ===
            right.type
          ) {
            return String(
              left.target,
            ).localeCompare(
              String(
                right.target,
              ),
            );
          }

          return left.type ===
            'SECTOR_BIAS'
            ? -1
            : 1;
        },
      )[0] ?? null;
  }


  private normalizeTarget(
    value:
      string,
  ): PaperOracleTargetSector | null {
    if (
      value === 'voisins' ||
      value === 'tiers' ||
      value === 'orphelins'
    ) {
      return value;
    }

    return null;
  }


  private none(
    input: {
      readonly analyzedRounds:
        number;

      readonly rationale:
        string;

      readonly riskLevel?:
        PaperOracleTargetResolution['riskLevel'];

      readonly warnings?:
        readonly string[];

      readonly reasons:
        readonly string[];
    },
  ): PaperOracleTargetResolution {
    return Object.freeze({
      status:
        'NONE' as const,

      strategySignal:
        null,

      target:
        null,

      confidenceScore:
        0,

      confidencePercent:
        0,

      suggestedFraction:
        0,

      suggestedStake:
        0,

      riskLevel:
        input.riskLevel ??
        'UNAVAILABLE',

      rationale:
        input.rationale,

      warnings:
        Object.freeze([
          ...(input.warnings ?? []),
        ]),

      reasons:
        Object.freeze([
          ...input.reasons,
        ]),

      analyzedRounds:
        input.analyzedRounds,

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


  private validateInput(
    input:
      PaperOracleTargetResolverInput,
  ): void {
    if (
      input.oracleDecision !==
        'OBSERVAR' &&
      input.oracleDecision !==
        'WATCHLIST' &&
      input.oracleDecision !==
        'PAPER_FAVORAVEL'
    ) {
      throw new Error(
        'paper_oracle_target_invalid_oracle_decision',
      );
    }

    this.validateRounds(
      input.warmupRounds,
    );

    this.validateRounds(
      input.liveRounds,
    );

    if (
      !Number.isFinite(
        input.bankroll,
      ) ||
      input.bankroll <= 0
    ) {
      throw new Error(
        'paper_oracle_target_invalid_bankroll',
      );
    }
  }


  private validateRounds(
    rounds:
      readonly number[],
  ): void {
    if (
      !Array.isArray(
        rounds,
      )
    ) {
      throw new Error(
        'paper_oracle_target_invalid_history',
      );
    }

    for (
      const round of rounds
    ) {
      if (
        !Number.isInteger(
          round,
        ) ||
        round < 0 ||
        round > 36
      ) {
        throw new Error(
          'paper_oracle_target_invalid_history',
        );
      }
    }
  }


  private clampRatio(
    value:
      number,
  ): number {
    if (
      !Number.isFinite(
        value,
      )
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        1,
        value,
      ),
    );
  }


  private clampFraction(
    value:
      number,
  ): number {
    if (
      !Number.isFinite(
        value,
      ) ||
      value <= 0
    ) {
      return 0;
    }

    /*
     * Keep the resolver bounded even if an injected/legacy StrategyEngine
     * violates its own documented maximum.
     */
    return Math.max(
      0,
      Math.min(
        0.01,
        value,
      ),
    );
  }


  private money(
    value:
      number,
  ): number {
    return Math.round(
      value *
      100,
    ) / 100;
  }
}
