import type {
  TriplicacaoProspectiveSignalRecord,
} from './TriplicacaoProspectiveRecorder.js';

import type {
  TriplicacaoEnginePatternKind,
} from '../../domain/analytics/TriplicacaoPatternEngine.js';


export interface TriplicacaoProspectivePatternPerformance {
  readonly pattern:
    TriplicacaoEnginePatternKind;

  readonly settledSignals:
    number;

  readonly wins:
    number;

  readonly losses:
    number;

  readonly voids:
    number;

  readonly decisiveSignals:
    number;

  readonly hitRate:
    number | null;
}


export interface TriplicacaoConfidenceBucketPerformance {
  readonly bucket:
    string;

  readonly minConfidenceInclusive:
    number;

  readonly maxConfidenceExclusive:
    number | null;

  readonly settledSignals:
    number;

  readonly wins:
    number;

  readonly losses:
    number;

  readonly voids:
    number;

  readonly decisiveSignals:
    number;

  readonly hitRate:
    number | null;

  readonly averageConfidence:
    number | null;
}


export interface TriplicacaoOperatorPerformance {
  readonly followedSignals:
    number;

  readonly ignoredSignals:
    number;

  readonly undecidedSignals:
    number;

  readonly followedSettledSignals:
    number;

  readonly followedWins:
    number;

  readonly followedLosses:
    number;

  readonly followedVoids:
    number;

  readonly followedDecisiveSignals:
    number;

  readonly followedHitRate:
    number | null;

  readonly totalSuggestedStakeFollowed:
    number;
}


export interface TriplicacaoProspectivePerformanceReport {
  readonly totalSignals:
    number;

  readonly pendingSignals:
    number;

  readonly settledSignals:
    number;

  readonly wins:
    number;

  readonly losses:
    number;

  readonly voids:
    number;

  readonly decisiveSignals:
    number;

  readonly hitRate:
    number | null;

  readonly voidRate:
    number | null;

  readonly maxLossStreak:
    number;

  readonly currentLossStreak:
    number;

  readonly averageConfidence:
    number | null;

  readonly averageEvidence:
    number | null;

  readonly averageRisk:
    number | null;

  readonly byPattern:
    readonly TriplicacaoProspectivePatternPerformance[];

  readonly confidenceBuckets:
    readonly TriplicacaoConfidenceBucketPerformance[];

  readonly operator:
    TriplicacaoOperatorPerformance;

  readonly warnings:
    readonly string[];

  readonly paperOnly: true;

  readonly recommendationOnly: true;

  readonly humanExecutionRequired: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticBetExecutionAllowed: false;
}


/**
 * Prospective performance analyzer.
 *
 * Overall performance includes every recommendation produced by RL.Sys,
 * regardless of whether the operator followed or ignored it.
 *
 * Operator performance is reported separately.
 *
 * This prevents selection bias:
 *
 *   ignored LOSS is still a LOSS for engine validation;
 *   ignored WIN is still a WIN for engine validation.
 *
 * ROI is still intentionally deferred because bankroll settlement
 * accounting will be introduced in a dedicated financial layer.
 */
export class TriplicacaoProspectivePerformanceAnalyzer {
  public analyze(
    records:
      readonly TriplicacaoProspectiveSignalRecord[],
  ): TriplicacaoProspectivePerformanceReport {
    if (
      !Array.isArray(
        records,
      )
    ) {
      throw new Error(
        'triplicacao_performance_invalid_records',
      );
    }

    const ordered =
      [...records]
        .sort(
          (left, right) => {
            const created =
              left.createdAtEpochMs -
              right.createdAtEpochMs;

            if (
              created !==
              0
            ) {
              return created;
            }

            return left.signalId
              .localeCompare(
                right.signalId,
              );
          },
        );

    for (
      const record of ordered
    ) {
      this.validateRecord(
        record,
      );
    }

    const pending =
      ordered.filter(
        (record) =>
          record.status ===
          'PENDING',
      );

    const settled =
      ordered.filter(
        (record) =>
          record.status ===
          'SETTLED',
      );

    const wins =
      this.countResult(
        settled,
        'WIN',
      );

    const losses =
      this.countResult(
        settled,
        'LOSS',
      );

    const voids =
      this.countResult(
        settled,
        'VOID',
      );

    const decisiveSignals =
      wins +
      losses;

    const hitRate =
      decisiveSignals > 0
        ? this.round6(
            wins /
            decisiveSignals,
          )
        : null;

    const voidRate =
      settled.length > 0
        ? this.round6(
            voids /
            settled.length,
          )
        : null;

    const {
      maxLossStreak,
      currentLossStreak,
    } =
      this.lossStreaks(
        settled,
      );

    const averageConfidence =
      settled.length > 0
        ? this.average(
            settled.map(
              (record) =>
                record.confidenceScore,
            ),
          )
        : null;

    const averageEvidence =
      settled.length > 0
        ? this.average(
            settled.map(
              (record) =>
                record.evidenceScore,
            ),
          )
        : null;

    const averageRisk =
      settled.length > 0
        ? this.average(
            settled.map(
              (record) =>
                record.riskScore,
            ),
          )
        : null;

    const byPattern =
      Object.freeze(
        (
          [
            'TC',
            'NTC',
            'TA',
            'NTA',
          ] as const
        ).map(
          (pattern) =>
            this.patternPerformance(
              pattern,
              settled,
            ),
        ),
      );

    const confidenceBuckets =
      Object.freeze([
        this.confidenceBucket({
          label:
            '<60%',

          min:
            0,

          max:
            0.60,

          records:
            settled,
        }),

        this.confidenceBucket({
          label:
            '60-69%',

          min:
            0.60,

          max:
            0.70,

          records:
            settled,
        }),

        this.confidenceBucket({
          label:
            '70-79%',

          min:
            0.70,

          max:
            0.80,

          records:
            settled,
        }),

        this.confidenceBucket({
          label:
            '80-89%',

          min:
            0.80,

          max:
            0.90,

          records:
            settled,
        }),

        this.confidenceBucket({
          label:
            '90-100%',

          min:
            0.90,

          max:
            null,

          records:
            settled,
        }),
      ]);

    const operator =
      this.operatorPerformance(
        ordered,
      );

    const warnings:
      string[] = [];

    if (
      settled.length ===
      0
    ) {
      warnings.push(
        'TRIPLICACAO_PERFORMANCE_NO_SETTLED_SIGNALS',
      );
    }

    if (
      decisiveSignals <
      30
    ) {
      warnings.push(
        'TRIPLICACAO_PERFORMANCE_SAMPLE_SMALL',
      );
    }

    if (
      pending.length > 0
    ) {
      warnings.push(
        'TRIPLICACAO_PERFORMANCE_PENDING_SIGNALS_PRESENT',
      );
    }

    if (
      operator.undecidedSignals >
      0
    ) {
      warnings.push(
        'TRIPLICACAO_OPERATOR_DECISIONS_PENDING',
      );
    }

    return Object.freeze({
      totalSignals:
        ordered.length,

      pendingSignals:
        pending.length,

      settledSignals:
        settled.length,

      wins,

      losses,

      voids,

      decisiveSignals,

      hitRate,

      voidRate,

      maxLossStreak,

      currentLossStreak,

      averageConfidence,

      averageEvidence,

      averageRisk,

      byPattern,

      confidenceBuckets,

      operator,

      warnings:
        Object.freeze([
          ...warnings,
        ]),

      paperOnly:
        true as const,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      liveMoneyAuthorization:
        false as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  private operatorPerformance(
    records:
      readonly TriplicacaoProspectiveSignalRecord[],
  ): TriplicacaoOperatorPerformance {
    const followed =
      records.filter(
        (record) =>
          record.operatorDecision ===
          'FOLLOWED',
      );

    const ignored =
      records.filter(
        (record) =>
          record.operatorDecision ===
          'IGNORED',
      );

    const undecided =
      records.filter(
        (record) =>
          record.operatorDecision ===
          'UNDECIDED',
      );

    const followedSettled =
      followed.filter(
        (record) =>
          record.status ===
          'SETTLED',
      );

    const followedWins =
      this.countResult(
        followedSettled,
        'WIN',
      );

    const followedLosses =
      this.countResult(
        followedSettled,
        'LOSS',
      );

    const followedVoids =
      this.countResult(
        followedSettled,
        'VOID',
      );

    const followedDecisiveSignals =
      followedWins +
      followedLosses;

    return Object.freeze({
      followedSignals:
        followed.length,

      ignoredSignals:
        ignored.length,

      undecidedSignals:
        undecided.length,

      followedSettledSignals:
        followedSettled.length,

      followedWins,

      followedLosses,

      followedVoids,

      followedDecisiveSignals,

      followedHitRate:
        followedDecisiveSignals > 0
          ? this.round6(
              followedWins /
              followedDecisiveSignals,
            )
          : null,

      totalSuggestedStakeFollowed:
        this.money(
          followed.reduce(
            (
              total,
              record,
            ) =>
              total +
              record.suggestedStake,
            0,
          ),
        ),
    });
  }


  private patternPerformance(
    pattern:
      TriplicacaoEnginePatternKind,

    records:
      readonly TriplicacaoProspectiveSignalRecord[],
  ): TriplicacaoProspectivePatternPerformance {
    const matching =
      records.filter(
        (record) =>
          record.pattern ===
          pattern,
      );

    const wins =
      this.countResult(
        matching,
        'WIN',
      );

    const losses =
      this.countResult(
        matching,
        'LOSS',
      );

    const voids =
      this.countResult(
        matching,
        'VOID',
      );

    const decisiveSignals =
      wins +
      losses;

    return Object.freeze({
      pattern,

      settledSignals:
        matching.length,

      wins,

      losses,

      voids,

      decisiveSignals,

      hitRate:
        decisiveSignals > 0
          ? this.round6(
              wins /
              decisiveSignals,
            )
          : null,
    });
  }


  private confidenceBucket(
    input: {
      readonly label:
        string;

      readonly min:
        number;

      readonly max:
        number | null;

      readonly records:
        readonly TriplicacaoProspectiveSignalRecord[];
    },
  ): TriplicacaoConfidenceBucketPerformance {
    const matching =
      input.records.filter(
        (record) => {
          if (
            record.confidenceScore <
            input.min
          ) {
            return false;
          }

          if (
            input.max ===
            null
          ) {
            return true;
          }

          return (
            record.confidenceScore <
            input.max
          );
        },
      );

    const wins =
      this.countResult(
        matching,
        'WIN',
      );

    const losses =
      this.countResult(
        matching,
        'LOSS',
      );

    const voids =
      this.countResult(
        matching,
        'VOID',
      );

    const decisiveSignals =
      wins +
      losses;

    return Object.freeze({
      bucket:
        input.label,

      minConfidenceInclusive:
        input.min,

      maxConfidenceExclusive:
        input.max,

      settledSignals:
        matching.length,

      wins,

      losses,

      voids,

      decisiveSignals,

      hitRate:
        decisiveSignals > 0
          ? this.round6(
              wins /
              decisiveSignals,
            )
          : null,

      averageConfidence:
        matching.length > 0
          ? this.average(
              matching.map(
                (record) =>
                  record.confidenceScore,
              ),
            )
          : null,
    });
  }


  private lossStreaks(
    records:
      readonly TriplicacaoProspectiveSignalRecord[],
  ): {
    readonly maxLossStreak:
      number;

    readonly currentLossStreak:
      number;
  } {
    let current =
      0;

    let maximum =
      0;

    for (
      const record of records
    ) {
      if (
        record.result ===
        'LOSS'
      ) {
        current +=
          1;

        maximum =
          Math.max(
            maximum,
            current,
          );

        continue;
      }

      if (
        record.result ===
        'WIN'
      ) {
        current =
          0;
      }
    }

    return {
      maxLossStreak:
        maximum,

      currentLossStreak:
        current,
    };
  }


  private countResult(
    records:
      readonly TriplicacaoProspectiveSignalRecord[],

    result:
      'WIN' | 'LOSS' | 'VOID',
  ): number {
    return records.filter(
      (record) =>
        record.result ===
        result,
    ).length;
  }


  private validateRecord(
    record:
      TriplicacaoProspectiveSignalRecord,
  ): void {
    if (
      !record ||
      typeof record !==
      'object'
    ) {
      throw new Error(
        'triplicacao_performance_invalid_record',
      );
    }

    if (
      record.signalId.trim()
        .length === 0 ||
      record.sessionId.trim()
        .length === 0
    ) {
      throw new Error(
        'triplicacao_performance_invalid_record',
      );
    }

    if (
      !Number.isFinite(
        record.suggestedStake,
      ) ||
      record.suggestedStake <
      0
    ) {
      throw new Error(
        'triplicacao_performance_invalid_stake',
      );
    }

    if (
      record.operatorDecision !==
        'UNDECIDED' &&
      record.operatorDecision !==
        'FOLLOWED' &&
      record.operatorDecision !==
        'IGNORED'
    ) {
      throw new Error(
        'triplicacao_performance_invalid_operator_decision',
      );
    }

    if (
      record.operatorDecision ===
        'UNDECIDED' &&
      record.operatorDecisionAtEpochMs !==
        null
    ) {
      throw new Error(
        'triplicacao_performance_invalid_operator_decision_time',
      );
    }

    if (
      record.operatorDecision !==
        'UNDECIDED' &&
      record.operatorDecisionAtEpochMs ===
        null
    ) {
      throw new Error(
        'triplicacao_performance_operator_decision_time_required',
      );
    }

    if (
      record.status ===
      'PENDING'
    ) {
      if (
        record.result !==
          null ||
        record.thirdNumber !==
          null ||
        record.thirdColor !==
          null
      ) {
        throw new Error(
          'triplicacao_performance_invalid_pending_record',
        );
      }

      return;
    }

    if (
      record.status !==
      'SETTLED'
    ) {
      throw new Error(
        'triplicacao_performance_invalid_record_status',
      );
    }

    if (
      record.result !==
        'WIN' &&
      record.result !==
        'LOSS' &&
      record.result !==
        'VOID'
    ) {
      throw new Error(
        'triplicacao_performance_invalid_settlement',
      );
    }

    if (
      record.thirdNumber ===
        null ||
      record.thirdColor ===
        null ||
      record.settledAtEpochMs ===
        null
    ) {
      throw new Error(
        'triplicacao_performance_incomplete_settlement',
      );
    }
  }


  private average(
    values:
      readonly number[],
  ): number {
    if (
      values.length ===
      0
    ) {
      return 0;
    }

    const total =
      values.reduce(
        (
          accumulator,
          value,
        ) =>
          accumulator +
          value,
        0,
      );

    return this.round6(
      total /
      values.length,
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


  private round6(
    value:
      number,
  ): number {
    return Number(
      value.toFixed(
        6,
      ),
    );
  }
}
