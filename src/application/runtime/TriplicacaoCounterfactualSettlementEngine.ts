import {
  TriplicacaoActionSemantics,
  type TriplicacaoActionColor,
  type TriplicacaoActionStatus,
} from './TriplicacaoActionSemantics.js';

import {
  TriplicacaoJointCounterfactualCalibrationMatrix,
  type TriplicacaoJointCalibrationReport,
} from './TriplicacaoJointCounterfactualCalibrationMatrix.js';

import type {
  TriplicacaoLiveDiagnosticEvent,
} from './TriplicacaoLiveStatsDiagnostics.js';

import type {
  TriplicacaoAdvancedProbabilityAnalysis,
} from '../../domain/analytics/TriplicacaoAdvancedProbabilityEngine.js';

import type {
  TriplicacaoEnginePatternKind,
} from '../../domain/analytics/TriplicacaoPatternEngine.js';


export type TriplicacaoCounterfactualSettlement =
  | 'WIN'
  | 'LOSS'
  | 'VOID'
  | 'PENDING'
  | 'NOT_ACTIONABLE'
  | 'DATA_GAP';


export interface TriplicacaoCounterfactualSettlementRecord {
  readonly policyId:
    string;

  readonly decisionLiveIndex:
    number;

  readonly settlementLiveIndex:
    number | null;

  readonly firstNumber:
    number;

  readonly secondNumber:
    number;

  readonly thirdNumber:
    number | null;

  readonly selectedPatternKind:
    TriplicacaoEnginePatternKind;

  readonly actionStatus:
    TriplicacaoActionStatus;

  readonly targetColor:
    TriplicacaoActionColor | null;

  readonly actualPatternKind:
    TriplicacaoEnginePatternKind | null;

  readonly result:
    TriplicacaoCounterfactualSettlement;

  readonly counterfactualOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly bankrollMutationAllowed:
    false;

  readonly automaticBetExecutionAllowed:
    false;
}


export interface TriplicacaoCounterfactualSettlementScenarioReport {
  readonly policyId:
    string;

  readonly policyLabel:
    string;

  readonly official:
    boolean;

  readonly decisionApplicableEvents:
    number;

  readonly eligibleEvents:
    number;

  readonly actionableEvents:
    number;

  readonly notActionableEvents:
    number;

  readonly settledEvents:
    number;

  readonly pendingEvents:
    number;

  readonly dataGapEvents:
    number;

  readonly wins:
    number;

  readonly losses:
    number;

  readonly voids:
    number;

  readonly decisiveEvents:
    number;

  readonly hitRate:
    number | null;

  readonly voidRate:
    number | null;

  readonly maxLossStreak:
    number;

  readonly records:
    readonly TriplicacaoCounterfactualSettlementRecord[];
}


export interface TriplicacaoCounterfactualSettlementReport {
  readonly totalLiveEvents:
    number;

  readonly decisionApplicableEvents:
    number;

  readonly scenarios:
    readonly TriplicacaoCounterfactualSettlementScenarioReport[];

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


/**
 * Read-only prospective counterfactual settlement.
 *
 * Candidate generation:
 *   only canonical WAITING_THIRD decision points are considered.
 *
 * Eligibility:
 *   delegated to TriplicacaoJointCounterfactualCalibrationMatrix.
 *
 * Action semantics:
 *   delegated to canonical TriplicacaoActionSemantics.
 *
 * Settlement:
 *   uses only the immediately following LIVE event.
 *
 * The third spin is NEVER consulted before the counterfactual
 * action has been resolved.
 *
 * This component cannot:
 * - alter the official thresholds;
 * - create an official recommendation;
 * - mutate bankroll;
 * - create recovery debt;
 * - execute a bet.
 */
export class TriplicacaoCounterfactualSettlementEngine {
  public constructor(
    private readonly calibrationMatrix:
      TriplicacaoJointCounterfactualCalibrationMatrix =
        new TriplicacaoJointCounterfactualCalibrationMatrix(),

    private readonly actionSemantics:
      TriplicacaoActionSemantics =
        new TriplicacaoActionSemantics(),
  ) {}


  public analyze(
    input: {
      readonly events:
        readonly TriplicacaoLiveDiagnosticEvent[];

      readonly calibration?:
        TriplicacaoJointCalibrationReport;
    },
  ): TriplicacaoCounterfactualSettlementReport {
    if (
      !Array.isArray(
        input.events,
      )
    ) {
      throw new Error(
        'triplicacao_counterfactual_settlement_invalid_events',
      );
    }

    this.validateChronology(
      input.events,
    );

    const calibration =
      input.calibration ??
      this.calibrationMatrix.analyze({
        events:
          input.events,
      });

    const eventsByLiveIndex =
      new Map(
        input.events.map(
          (event) => [
            event.liveSpinIndex,
            event,
          ],
        ),
      );

    const scenarios =
      calibration.scenarios.map(
        (scenario) => {
          const eligible =
            scenario.evaluations.filter(
              (evaluation) =>
                evaluation.counterfactualPaperOnly,
            );

          const records =
            eligible.map(
              (evaluation) => {
                const decision =
                  eventsByLiveIndex.get(
                    evaluation.liveSpinIndex,
                  );

                if (
                  decision ===
                  undefined
                ) {
                  throw new Error(
                    'triplicacao_counterfactual_settlement_decision_event_missing',
                  );
                }

                return this.settleDecision({
                  policyId:
                    scenario.policy.id,

                  decision,

                  eventsByLiveIndex,
                });
              },
            );

          return this.scenarioReport({
            policyId:
              scenario.policy.id,

            policyLabel:
              scenario.policy.label,

            official:
              scenario.policy.official,

            decisionApplicableEvents:
              scenario.decisionApplicableEvents,

            records,
          });
        },
      );

    return Object.freeze({
      totalLiveEvents:
        input.events.length,

      decisionApplicableEvents:
        calibration.decisionApplicableEvents,

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


  private settleDecision(
    input: {
      readonly policyId:
        string;

      readonly decision:
        TriplicacaoLiveDiagnosticEvent;

      readonly eventsByLiveIndex:
        ReadonlyMap<
          number,
          TriplicacaoLiveDiagnosticEvent
        >;
    },
  ): TriplicacaoCounterfactualSettlementRecord {
    const decision =
      input.decision;

    if (
      decision.formationState !==
        'WAITING_THIRD' ||
      decision.firstNumber ===
        null ||
      decision.secondNumber ===
        null ||
      decision.selectedPatternKind ===
        null ||
      decision.trioCompleted ||
      decision.trioDiscarded
    ) {
      throw new Error(
        'triplicacao_counterfactual_settlement_invalid_decision_boundary',
      );
    }

    /*
     * Counterfactual gates have already established PAPER_ONLY for
     * this alternative policy.
     *
     * We deliberately reuse canonical TriplicacaoActionSemantics
     * rather than duplicating TC/NTC/TA/NTA opening rules here.
     *
     * ActionSemantics does not consume baseAnalysis or recurrence
     * metrics when resolving the target. Those fields are therefore
     * supplied as inert adapter values solely to satisfy the canonical
     * analysis contract.
     */
    const analysis =
      this.counterfactualAnalysis(
        decision,
      );

    const action =
      this.actionSemantics.resolve({
        analysis,

        firstNumber:
          decision.firstNumber,

        secondNumber:
          decision.secondNumber,
      });

    if (
      action.status !==
        'ACTION' ||
      action.targetColor ===
        null
    ) {
      return this.record({
        policyId:
          input.policyId,

        decision,

        settlementEvent:
          null,

        actionStatus:
          action.status,

        targetColor:
          null,

        actualPatternKind:
          null,

        result:
          'NOT_ACTIONABLE',
      });
    }

    const expectedSettlementLiveIndex =
      decision.liveSpinIndex +
      1;

    const settlementEvent =
      input.eventsByLiveIndex.get(
        expectedSettlementLiveIndex,
      );

    if (
      settlementEvent ===
        undefined
    ) {
      return this.record({
        policyId:
          input.policyId,

        decision,

        settlementEvent:
          null,

        actionStatus:
          action.status,

        targetColor:
          action.targetColor,

        actualPatternKind:
          null,

        result:
          'PENDING',
      });
    }

    if (
      settlementEvent.liveSpinIndex !==
      expectedSettlementLiveIndex
    ) {
      return this.record({
        policyId:
          input.policyId,

        decision,

        settlementEvent,

        actionStatus:
          action.status,

        targetColor:
          action.targetColor,

        actualPatternKind:
          settlementEvent.actualPatternKind,

        result:
          'DATA_GAP',
      });
    }

    /*
     * Canonical zero rule:
     * zero on the third position voids the prospective trio.
     */
    if (
      settlementEvent.spin ===
        0 ||
      settlementEvent.trioDiscarded
    ) {
      return this.record({
        policyId:
          input.policyId,

        decision,

        settlementEvent,

        actionStatus:
          action.status,

        targetColor:
          action.targetColor,

        actualPatternKind:
          null,

        result:
          'VOID',
      });
    }

    /*
     * A normal third position must complete the same trio whose
     * decision point was the immediately preceding LIVE event.
     */
    if (
      !settlementEvent.trioCompleted ||
      settlementEvent.actualPatternKind ===
        null
    ) {
      return this.record({
        policyId:
          input.policyId,

        decision,

        settlementEvent,

        actionStatus:
          action.status,

        targetColor:
          action.targetColor,

        actualPatternKind:
          settlementEvent.actualPatternKind,

        result:
          'DATA_GAP',
      });
    }

    const result:
      TriplicacaoCounterfactualSettlement =
        settlementEvent
          .actualPatternKind ===
        decision.selectedPatternKind
          ? 'WIN'
          : 'LOSS';

    return this.record({
      policyId:
        input.policyId,

      decision,

      settlementEvent,

      actionStatus:
        action.status,

      targetColor:
        action.targetColor,

      actualPatternKind:
        settlementEvent.actualPatternKind,

      result,
    });
  }


  private counterfactualAnalysis(
    event:
      TriplicacaoLiveDiagnosticEvent,
  ): TriplicacaoAdvancedProbabilityAnalysis {
    return Object.freeze({
      /*
       * These two fields are intentionally inert.
       *
       * TriplicacaoActionSemantics reads the already-selected pattern,
       * PAPER_ONLY mode and advanced scores; it does not recalculate
       * statistical evidence.
       */
      baseAnalysis:
        Object.freeze(
          {},
        ) as TriplicacaoAdvancedProbabilityAnalysis['baseAnalysis'],

      metrics:
        Object.freeze([]),

      selectedPatternKind:
        event.selectedPatternKind,

      advancedEvidenceScore:
        event.advancedEvidenceScore,

      advancedConfidenceScore:
        event.advancedConfidenceScore,

      advancedRiskScore:
        event.advancedRiskScore,

      probabilityMode:
        'PAPER_ONLY',

      liveMoneyAuthorized:
        false as const,

      reasons:
        Object.freeze([
          'TRIPLICACAO_COUNTERFACTUAL_POLICY_PASSED',
        ]),

      warnings:
        Object.freeze([
          'TRIPLICACAO_COUNTERFACTUAL_ONLY',
        ]),

      blockers:
        Object.freeze([]),
    });
  }


  private record(
    input: {
      readonly policyId:
        string;

      readonly decision:
        TriplicacaoLiveDiagnosticEvent;

      readonly settlementEvent:
        TriplicacaoLiveDiagnosticEvent | null;

      readonly actionStatus:
        TriplicacaoActionStatus;

      readonly targetColor:
        TriplicacaoActionColor | null;

      readonly actualPatternKind:
        TriplicacaoEnginePatternKind | null;

      readonly result:
        TriplicacaoCounterfactualSettlement;
    },
  ): TriplicacaoCounterfactualSettlementRecord {
    if (
      input.decision.firstNumber ===
        null ||
      input.decision.secondNumber ===
        null ||
      input.decision.selectedPatternKind ===
        null
    ) {
      throw new Error(
        'triplicacao_counterfactual_settlement_record_invalid_decision',
      );
    }

    return Object.freeze({
      policyId:
        input.policyId,

      decisionLiveIndex:
        input.decision.liveSpinIndex,

      settlementLiveIndex:
        input.settlementEvent
          ?.liveSpinIndex ??
        null,

      firstNumber:
        input.decision.firstNumber,

      secondNumber:
        input.decision.secondNumber,

      thirdNumber:
        input.settlementEvent
          ?.spin ??
        null,

      selectedPatternKind:
        input.decision.selectedPatternKind,

      actionStatus:
        input.actionStatus,

      targetColor:
        input.targetColor,

      actualPatternKind:
        input.actualPatternKind,

      result:
        input.result,

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


  private scenarioReport(
    input: {
      readonly policyId:
        string;

      readonly policyLabel:
        string;

      readonly official:
        boolean;

      readonly decisionApplicableEvents:
        number;

      readonly records:
        readonly TriplicacaoCounterfactualSettlementRecord[];
    },
  ): TriplicacaoCounterfactualSettlementScenarioReport {
    const count =
      (
        result:
          TriplicacaoCounterfactualSettlement,
      ) =>
        input.records.filter(
          (record) =>
            record.result ===
            result,
        ).length;

    const wins =
      count(
        'WIN',
      );

    const losses =
      count(
        'LOSS',
      );

    const voids =
      count(
        'VOID',
      );

    const pending =
      count(
        'PENDING',
      );

    const notActionable =
      count(
        'NOT_ACTIONABLE',
      );

    const dataGaps =
      count(
        'DATA_GAP',
      );

    const decisive =
      wins +
      losses;

    const settled =
      wins +
      losses +
      voids;

    const actionable =
      input.records.length -
      notActionable;

    return Object.freeze({
      policyId:
        input.policyId,

      policyLabel:
        input.policyLabel,

      official:
        input.official,

      decisionApplicableEvents:
        input.decisionApplicableEvents,

      eligibleEvents:
        input.records.length,

      actionableEvents:
        actionable,

      notActionableEvents:
        notActionable,

      settledEvents:
        settled,

      pendingEvents:
        pending,

      dataGapEvents:
        dataGaps,

      wins,

      losses,

      voids,

      decisiveEvents:
        decisive,

      hitRate:
        decisive >
          0
          ? this.round4(
              wins /
              decisive,
            )
          : null,

      voidRate:
        settled >
          0
          ? this.round4(
              voids /
              settled,
            )
          : null,

      maxLossStreak:
        this.maxLossStreak(
          input.records,
        ),

      records:
        Object.freeze([
          ...input.records,
        ]),
    });
  }


  private maxLossStreak(
    records:
      readonly TriplicacaoCounterfactualSettlementRecord[],
  ): number {
    let current =
      0;

    let maximum =
      0;

    const ordered =
      [
        ...records,
      ].sort(
        (
          left,
          right,
        ) =>
          left.decisionLiveIndex -
          right.decisionLiveIndex,
      );

    for (
      const record of
      ordered
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

      /*
       * VOID, PENDING, NOT_ACTIONABLE and DATA_GAP do not invent
       * a win and therefore do not erase an existing loss sequence.
       */
    }

    return maximum;
  }


  private validateChronology(
    events:
      readonly TriplicacaoLiveDiagnosticEvent[],
  ): void {
    let previous =
      0;

    const seen =
      new Set<number>();

    for (
      const event of
      events
    ) {
      if (
        !Number.isInteger(
          event.liveSpinIndex,
        ) ||
        event.liveSpinIndex <=
          0
      ) {
        throw new Error(
          'triplicacao_counterfactual_settlement_invalid_live_index',
        );
      }

      if (
        seen.has(
          event.liveSpinIndex,
        )
      ) {
        throw new Error(
          'triplicacao_counterfactual_settlement_duplicate_live_index',
        );
      }

      if (
        event.liveSpinIndex <=
        previous
      ) {
        throw new Error(
          'triplicacao_counterfactual_settlement_non_monotonic_history',
        );
      }

      seen.add(
        event.liveSpinIndex,
      );

      previous =
        event.liveSpinIndex;
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
