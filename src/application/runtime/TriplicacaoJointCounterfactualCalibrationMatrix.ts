import type {
  TriplicacaoLiveDiagnosticEvent,
} from './TriplicacaoLiveStatsDiagnostics.js';

import {
  triplicacaoCounterfactualDecisionEvents,
} from './TriplicacaoCounterfactualDecisionPoint.js';

import type {
  TriplicacaoCalibrationEventEvaluation,
  TriplicacaoCalibrationPolicy,
  TriplicacaoCalibrationScenarioReport,
} from './TriplicacaoCounterfactualCalibrationMatrix.js';


export interface TriplicacaoJointCalibrationReport {
  readonly totalLiveEvents:
    number;

  readonly decisionApplicableEvents:
    number;

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


export const TRIPLICACAO_JOINT_CALIBRATION_POLICIES:
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
          'P25_PERMISSIVE',

        label:
          'Calibração conjunta permissiva',

        baseDominanceMinimum:
          28,

        baseConfidenceMinimum:
          0.249,

        baseRiskMaximum:
          0.664,

        advancedEvidenceMinimum:
          29.8,

        advancedConfidenceMinimum:
          0.283,

        advancedRiskMaximum:
          0.599,

        official:
          false,
      }),

      Object.freeze({
        id:
          'P50_BALANCED',

        label:
          'Calibração conjunta mediana',

        baseDominanceMinimum:
          29,

        baseConfidenceMinimum:
          0.295,

        baseRiskMaximum:
          0.626,

        advancedEvidenceMinimum:
          33.5,

        advancedConfidenceMinimum:
          0.313,

        advancedRiskMaximum:
          0.560,

        official:
          false,
      }),

      Object.freeze({
        id:
          'EMPIRICAL_STEP',

        label:
          'Calibração conjunta intermediária',

        baseDominanceMinimum:
          30,

        baseConfidenceMinimum:
          0.325,

        baseRiskMaximum:
          0.610,

        advancedEvidenceMinimum:
          36,

        advancedConfidenceMinimum:
          0.340,

        advancedRiskMaximum:
          0.540,

        official:
          false,
      }),

      Object.freeze({
        id:
          'P75_SELECTIVE',

        label:
          'Calibração conjunta seletiva',

        baseDominanceMinimum:
          31.3,

        baseConfidenceMinimum:
          0.353,

        baseRiskMaximum:
          0.594,

        advancedEvidenceMinimum:
          38.5,

        advancedConfidenceMinimum:
          0.370,

        advancedRiskMaximum:
          0.526,

        official:
          false,
      }),
    ]);


export class TriplicacaoJointCounterfactualCalibrationMatrix {
  public analyze(
    input: {
      readonly events:
        readonly TriplicacaoLiveDiagnosticEvent[];
    },
  ): TriplicacaoJointCalibrationReport {
    if (
      !Array.isArray(
        input.events,
      )
    ) {
      throw new Error(
        'triplicacao_joint_calibration_invalid_events',
      );
    }

    const decisionApplicable =
      triplicacaoCounterfactualDecisionEvents(
        input.events,
      );

    const scenarios =
      TRIPLICACAO_JOINT_CALIBRATION_POLICIES.map(
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

    const eligible =
      evaluations.filter(
        (evaluation) =>
          evaluation.counterfactualPaperOnly,
      ).length;

    const failureCount =
      (
        key:
          keyof TriplicacaoCalibrationEventEvaluation['gates'],
      ) =>
        evaluations.filter(
          (evaluation) =>
            evaluation.gates[key] ===
            false,
        ).length;

    return Object.freeze({
      policy,

      totalLiveEvents:
        allEvents.length,

      decisionApplicableEvents:
        evaluations.length,

      counterfactualPaperOnlyEvents:
        eligible,

      counterfactualPaperOnlyFraction:
        evaluations.length >
          0
          ? this.round4(
              eligible /
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

    const gates =
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
      gates.filter(
        Boolean,
      ).length;

    const failedCount =
      gates.length -
      passedCount;

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
        failedCount ===
        0,

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

          allPassed:
            failedCount ===
            0,

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
