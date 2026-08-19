import type {
  TriplicacaoLiveDiagnosticEvent,
} from './TriplicacaoLiveStatsDiagnostics.js';

import {
  triplicacaoCounterfactualDecisionEvents,
} from './TriplicacaoCounterfactualDecisionPoint.js';


export interface TriplicacaoCalibrationPolicy {
  readonly id:
    string;

  readonly label:
    string;

  readonly baseDominanceMinimum:
    number;

  readonly baseConfidenceMinimum:
    number;

  readonly baseRiskMaximum:
    number;

  readonly advancedEvidenceMinimum:
    number;

  readonly advancedConfidenceMinimum:
    number;

  readonly advancedRiskMaximum:
    number;

  readonly official:
    boolean;
}


export interface TriplicacaoCalibrationGateResult {
  readonly baseDominance:
    boolean;

  readonly baseConfidence:
    boolean;

  readonly baseRisk:
    boolean;

  readonly basePaperOnly:
    boolean;

  readonly advancedPatternSelected:
    boolean;

  readonly advancedEvidence:
    boolean;

  readonly advancedConfidence:
    boolean;

  readonly advancedRisk:
    boolean;

  readonly allPassed:
    boolean;

  readonly passedCount:
    number;

  readonly failedCount:
    number;
}


export interface TriplicacaoCalibrationEventEvaluation {
  readonly liveSpinIndex:
    number;

  readonly spin:
    number;

  readonly formationPosition:
    'FIRST'
    | 'SECOND'
    | 'THIRD'
    | 'DISCARDED'
    | 'OTHER';

  readonly decisionApplicable:
    boolean;

  readonly actualPatternKind:
    string | null;

  readonly selectedPatternKind:
    string | null;

  readonly officialProbabilityMode:
    string;

  readonly officialActionStatus:
    string | null;

  readonly counterfactualPaperOnly:
    boolean;

  readonly gates:
    TriplicacaoCalibrationGateResult;
}


export interface TriplicacaoCalibrationScenarioReport {
  readonly policy:
    TriplicacaoCalibrationPolicy;

  readonly totalLiveEvents:
    number;

  readonly decisionApplicableEvents:
    number;

  readonly counterfactualPaperOnlyEvents:
    number;

  readonly counterfactualPaperOnlyFraction:
    number;

  readonly gateFailures: {
    readonly baseDominance:
      number;

    readonly baseConfidence:
      number;

    readonly baseRisk:
      number;

    readonly basePaperOnly:
      number;

    readonly advancedPatternSelected:
      number;

    readonly advancedEvidence:
      number;

    readonly advancedConfidence:
      number;

    readonly advancedRisk:
      number;
  };

  readonly evaluations:
    readonly TriplicacaoCalibrationEventEvaluation[];
}


export interface TriplicacaoCalibrationDistribution {
  readonly count:
    number;

  readonly minimum:
    number;

  readonly p25:
    number;

  readonly median:
    number;

  readonly p75:
    number;

  readonly maximum:
    number;

  readonly mean:
    number;
}


export interface TriplicacaoCalibrationMetricDistributions {
  readonly baseDominance:
    TriplicacaoCalibrationDistribution;

  readonly baseConfidence:
    TriplicacaoCalibrationDistribution;

  readonly baseRisk:
    TriplicacaoCalibrationDistribution;

  readonly advancedEvidence:
    TriplicacaoCalibrationDistribution;

  readonly advancedConfidence:
    TriplicacaoCalibrationDistribution;

  readonly advancedRisk:
    TriplicacaoCalibrationDistribution;
}


export interface TriplicacaoCounterfactualCalibrationReport {
  readonly totalLiveEvents:
    number;

  readonly decisionApplicableEvents:
    number;

  readonly distributions:
    TriplicacaoCalibrationMetricDistributions;

  readonly scenarios:
    readonly TriplicacaoCalibrationScenarioReport[];

  readonly officialPolicyPreserved:
    true;

  readonly counterfactualOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly bankrollMutationAllowed:
    false;

  readonly automaticBetExecutionAllowed:
    false;
}


export const TRIPLICACAO_DEFAULT_CALIBRATION_POLICIES:
  readonly TriplicacaoCalibrationPolicy[] =
    Object.freeze([
      Object.freeze({
        id:
          'OFFICIAL',

        label:
          'Institucional atual',

        baseDominanceMinimum:
          58,

        baseConfidenceMinimum:
          0.70,

        baseRiskMaximum:
          0.33,

        advancedEvidenceMinimum:
          68,

        advancedConfidenceMinimum:
          0.72,

        advancedRiskMaximum:
          0.34,

        official:
          true,
      }),

      Object.freeze({
        id:
          'D50_ONLY',

        label:
          'Dominância 50% / demais oficiais',

        baseDominanceMinimum:
          50,

        baseConfidenceMinimum:
          0.70,

        baseRiskMaximum:
          0.33,

        advancedEvidenceMinimum:
          68,

        advancedConfidenceMinimum:
          0.72,

        advancedRiskMaximum:
          0.34,

        official:
          false,
      }),

      Object.freeze({
        id:
          'D45_ONLY',

        label:
          'Dominância 45% / demais oficiais',

        baseDominanceMinimum:
          45,

        baseConfidenceMinimum:
          0.70,

        baseRiskMaximum:
          0.33,

        advancedEvidenceMinimum:
          68,

        advancedConfidenceMinimum:
          0.72,

        advancedRiskMaximum:
          0.34,

        official:
          false,
      }),

      Object.freeze({
        id:
          'D42_ONLY',

        label:
          'Dominância 42% / demais oficiais',

        baseDominanceMinimum:
          42,

        baseConfidenceMinimum:
          0.70,

        baseRiskMaximum:
          0.33,

        advancedEvidenceMinimum:
          68,

        advancedConfidenceMinimum:
          0.72,

        advancedRiskMaximum:
          0.34,

        official:
          false,
      }),
    ]);


/**
 * Counterfactual calibration engine.
 *
 * This class NEVER:
 *
 * - changes TriplicacaoPatternEngine configuration;
 * - changes TriplicacaoAdvancedProbabilityEngine configuration;
 * - creates a prospective recommendation;
 * - mutates bankroll;
 * - creates recovery debt;
 * - executes any bet.
 *
 * It reads historical diagnostic metrics and asks:
 *
 * "Would the already-observed metrics have passed this alternative
 * threshold policy?"
 */
export class TriplicacaoCounterfactualCalibrationMatrix {
  public analyze(
    input: {
      readonly events:
        readonly TriplicacaoLiveDiagnosticEvent[];

      readonly policies?:
        readonly TriplicacaoCalibrationPolicy[];
    },
  ): TriplicacaoCounterfactualCalibrationReport {
    if (
      !Array.isArray(
        input.events,
      )
    ) {
      throw new Error(
        'triplicacao_calibration_invalid_events',
      );
    }

    const policies =
      input.policies ??
      TRIPLICACAO_DEFAULT_CALIBRATION_POLICIES;

    if (
      !Array.isArray(
        policies,
      ) ||
      policies.length ===
        0
    ) {
      throw new Error(
        'triplicacao_calibration_invalid_policies',
      );
    }

    for (
      const policy of
      policies
    ) {
      this.validatePolicy(
        policy,
      );
    }

    const decisionApplicable =
      triplicacaoCounterfactualDecisionEvents(
        input.events,
      );

    const scenarios =
      policies.map(
        (policy) =>
          this.scenario(
            input.events,
            decisionApplicable,
            policy,
          ),
      );

    return Object.freeze({
      totalLiveEvents:
        input.events.length,

      decisionApplicableEvents:
        decisionApplicable.length,

      distributions:
        Object.freeze({
          baseDominance:
            this.distribution(
              decisionApplicable.map(
                (event) =>
                  event
                    .baseDominantFrequencyScore,
              ),
            ),

          baseConfidence:
            this.distribution(
              decisionApplicable.map(
                (event) =>
                  event
                    .baseConfidenceScore,
              ),
            ),

          baseRisk:
            this.distribution(
              decisionApplicable.map(
                (event) =>
                  event
                    .baseRiskScore,
              ),
            ),

          advancedEvidence:
            this.distribution(
              decisionApplicable.map(
                (event) =>
                  event
                    .advancedEvidenceScore,
              ),
            ),

          advancedConfidence:
            this.distribution(
              decisionApplicable.map(
                (event) =>
                  event
                    .advancedConfidenceScore,
              ),
            ),

          advancedRisk:
            this.distribution(
              decisionApplicable.map(
                (event) =>
                  event
                    .advancedRiskScore,
              ),
            ),
        }),

      scenarios:
        Object.freeze(
          scenarios,
        ),

      officialPolicyPreserved:
        true as const,

      counterfactualOnly:
        true as const,

      recommendationOnly:
        true as const,

      bankrollMutationAllowed:
        false as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  private scenario(
    allEvents:
      readonly TriplicacaoLiveDiagnosticEvent[],

    decisionApplicable:
      readonly TriplicacaoLiveDiagnosticEvent[],

    policy:
      TriplicacaoCalibrationPolicy,
  ): TriplicacaoCalibrationScenarioReport {
    const evaluations =
      decisionApplicable.map(
        (event) =>
          this.evaluateEvent(
            event,
            policy,
          ),
      );

    const passed =
      evaluations.filter(
        (evaluation) =>
          evaluation
            .counterfactualPaperOnly,
      ).length;

    const failureCount =
      (
        key:
          keyof TriplicacaoCalibrationGateResult,
      ) =>
        evaluations.filter(
          (evaluation) =>
            evaluation
              .gates[key] ===
            false,
        ).length;

    return Object.freeze({
      policy,

      totalLiveEvents:
        allEvents.length,

      decisionApplicableEvents:
        evaluations.length,

      counterfactualPaperOnlyEvents:
        passed,

      counterfactualPaperOnlyFraction:
        evaluations.length >
          0
          ? this.round4(
              passed /
              evaluations.length,
            )
          : 0,

      gateFailures:
        Object.freeze({
          baseDominance:
            failureCount(
              'baseDominance',
            ),

          baseConfidence:
            failureCount(
              'baseConfidence',
            ),

          baseRisk:
            failureCount(
              'baseRisk',
            ),

          basePaperOnly:
            failureCount(
              'basePaperOnly',
            ),

          advancedPatternSelected:
            failureCount(
              'advancedPatternSelected',
            ),

          advancedEvidence:
            failureCount(
              'advancedEvidence',
            ),

          advancedConfidence:
            failureCount(
              'advancedConfidence',
            ),

          advancedRisk:
            failureCount(
              'advancedRisk',
            ),
        }),

      evaluations:
        Object.freeze(
          evaluations,
        ),
    });
  }


  private evaluateEvent(
    event:
      TriplicacaoLiveDiagnosticEvent,

    policy:
      TriplicacaoCalibrationPolicy,
  ): TriplicacaoCalibrationEventEvaluation {
    const baseDominance =
      event
        .baseDominantFrequencyScore >=
      policy
        .baseDominanceMinimum;

    const baseConfidence =
      event
        .baseConfidenceScore >=
      policy
        .baseConfidenceMinimum;

    const baseRisk =
      event
        .baseRiskScore <=
      policy
        .baseRiskMaximum;

    /*
     * Counterfactual base PAPER_ONLY must be derived from the
     * alternative policy.
     *
     * We intentionally DO NOT reuse event.baseOperationalMode because
     * that mode was produced by the official policy.
     */
    const basePaperOnly =
      baseDominance &&
      baseConfidence &&
      baseRisk;

    const advancedPatternSelected =
      event
        .selectedPatternKind !==
      null;

    const advancedEvidence =
      event
        .advancedEvidenceScore >=
      policy
        .advancedEvidenceMinimum;

    const advancedConfidence =
      event
        .advancedConfidenceScore >=
      policy
        .advancedConfidenceMinimum;

    const advancedRisk =
      event
        .advancedRiskScore <=
      policy
        .advancedRiskMaximum;

    const gateValues =
      [
        baseDominance,
        baseConfidence,
        baseRisk,
        basePaperOnly,
        advancedPatternSelected,
        advancedEvidence,
        advancedConfidence,
        advancedRisk,
      ];

    const passedCount =
      gateValues.filter(
        Boolean,
      ).length;

    const failedCount =
      gateValues.length -
      passedCount;

    const allPassed =
      failedCount ===
      0;

    return Object.freeze({
      liveSpinIndex:
        event.liveSpinIndex,

      spin:
        event.spin,

      formationPosition:
        this.formationPosition(
          event,
        ),

      decisionApplicable:
        true,

      actualPatternKind:
        event.actualPatternKind,

      selectedPatternKind:
        event.selectedPatternKind,

      officialProbabilityMode:
        event.probabilityMode,

      officialActionStatus:
        event.actionStatus,

      counterfactualPaperOnly:
        allPassed,

      gates:
        Object.freeze({
          baseDominance,

          baseConfidence,

          baseRisk,

          basePaperOnly,

          advancedPatternSelected,

          advancedEvidence,

          advancedConfidence,

          advancedRisk,

          allPassed,

          passedCount,

          failedCount,
        }),
    });
  }


  private formationPosition(
    event:
      TriplicacaoLiveDiagnosticEvent,
  ):
    'FIRST'
    | 'SECOND'
    | 'THIRD'
    | 'DISCARDED'
    | 'OTHER' {
    if (
      event.trioDiscarded
    ) {
      return 'DISCARDED';
    }

    if (
      event.trioCompleted
    ) {
      return 'THIRD';
    }

    if (
      event.formationState ===
      'WAITING_SECOND'
    ) {
      return 'FIRST';
    }

    if (
      event.formationState ===
      'WAITING_THIRD'
    ) {
      return 'SECOND';
    }

    return 'OTHER';
  }


  private distribution(
    values:
      readonly number[],
  ): TriplicacaoCalibrationDistribution {
    if (
      values.length ===
      0
    ) {
      return Object.freeze({
        count:
          0,

        minimum:
          0,

        p25:
          0,

        median:
          0,

        p75:
          0,

        maximum:
          0,

        mean:
          0,
      });
    }

    const sorted =
      [
        ...values,
      ].sort(
        (
          left,
          right,
        ) =>
          left -
          right,
      );

    const mean =
      sorted.reduce(
        (
          total,
          value,
        ) =>
          total +
          value,
        0,
      ) /
      sorted.length;

    return Object.freeze({
      count:
        sorted.length,

      minimum:
        this.round4(
          sorted[0],
        ),

      p25:
        this.round4(
          this.percentile(
            sorted,
            0.25,
          ),
        ),

      median:
        this.round4(
          this.percentile(
            sorted,
            0.50,
          ),
        ),

      p75:
        this.round4(
          this.percentile(
            sorted,
            0.75,
          ),
        ),

      maximum:
        this.round4(
          sorted[
            sorted.length -
            1
          ],
        ),

      mean:
        this.round4(
          mean,
        ),
    });
  }


  private percentile(
    sorted:
      readonly number[],

    percentile:
      number,
  ): number {
    if (
      sorted.length ===
      1
    ) {
      return sorted[0];
    }

    const position =
      (
        sorted.length -
        1
      ) *
      percentile;

    const lower =
      Math.floor(
        position,
      );

    const upper =
      Math.ceil(
        position,
      );

    if (
      lower ===
      upper
    ) {
      return sorted[
        lower
      ];
    }

    const weight =
      position -
      lower;

    return (
      sorted[lower] *
        (
          1 -
          weight
        ) +
      sorted[upper] *
        weight
    );
  }


  private validatePolicy(
    policy:
      TriplicacaoCalibrationPolicy,
  ): void {
    if (
      typeof policy.id !==
        'string' ||
      policy.id.trim().length ===
        0
    ) {
      throw new Error(
        'triplicacao_calibration_invalid_policy_id',
      );
    }

    if (
      !Number.isFinite(
        policy
          .baseDominanceMinimum,
      ) ||
      policy
        .baseDominanceMinimum <
        0 ||
      policy
        .baseDominanceMinimum >
        100
    ) {
      throw new Error(
        'triplicacao_calibration_invalid_base_dominance',
      );
    }

    for (
      const value of
      [
        policy.baseConfidenceMinimum,
        policy.baseRiskMaximum,
        policy.advancedConfidenceMinimum,
        policy.advancedRiskMaximum,
      ]
    ) {
      if (
        !Number.isFinite(
          value,
        ) ||
        value <
          0 ||
        value >
          1
      ) {
        throw new Error(
          'triplicacao_calibration_invalid_ratio',
        );
      }
    }

    if (
      !Number.isFinite(
        policy
          .advancedEvidenceMinimum,
      ) ||
      policy
        .advancedEvidenceMinimum <
        0 ||
      policy
        .advancedEvidenceMinimum >
        100
    ) {
      throw new Error(
        'triplicacao_calibration_invalid_advanced_evidence',
      );
    }
  }


  private round4(
    value:
      number,
  ): number {
    return Math.round(
      value *
      10000,
    ) /
    10000;
  }
}
