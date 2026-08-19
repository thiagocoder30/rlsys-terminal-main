import {
  TriplicacaoPatternEngine,
  type TriplicacaoEnginePatternKind,
  type TriplicacaoPatternAnalysis,
  type TriplicacaoTrio,
} from '../../domain/analytics/TriplicacaoPatternEngine.js';

import type {
  TriplicacaoAdvancedProbabilityAnalysis,
} from '../../domain/analytics/TriplicacaoAdvancedProbabilityEngine.js';

import type {
  TriplicacaoProspectiveResult,
} from './TriplicacaoProspectiveFormationCoordinator.js';

import type {
  TriplicacaoProspectiveSessionEvent,
} from './TriplicacaoProspectiveSessionRuntime.js';

import type {
  TriplicacaoActionStatus,
} from './TriplicacaoActionSemantics.js';


/*
 * Current institutional thresholds.
 *
 * IMPORTANT:
 * These values mirror the current production defaults exactly.
 * They are diagnostic references only.
 *
 * This module does NOT supply these values to either probability engine
 * and therefore cannot change strategy behavior.
 */
export const TRIPLICACAO_GATE_POLICY =
  Object.freeze({
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
  });


export type TriplicacaoGateId =
  | 'BASE_DOMINANCE'
  | 'BASE_CONFIDENCE'
  | 'BASE_RISK'
  | 'BASE_PAPER_ONLY'
  | 'ADVANCED_PATTERN_SELECTED'
  | 'ADVANCED_EVIDENCE'
  | 'ADVANCED_CONFIDENCE'
  | 'ADVANCED_RISK';


export type TriplicacaoGateComparator =
  | 'MINIMUM'
  | 'MAXIMUM'
  | 'REQUIRED';


export interface TriplicacaoGateEvaluation {
  readonly id:
    TriplicacaoGateId;

  readonly label:
    string;

  readonly comparator:
    TriplicacaoGateComparator;

  readonly observed:
    number | boolean;

  readonly threshold:
    number | boolean;

  readonly passed:
    boolean;

  /*
   * Numeric distance to the gate.
   *
   * Positive:
   *   gate satisfied with this margin.
   *
   * Negative:
   *   gate failed by the absolute value of this margin.
   *
   * Boolean gates use:
   *   1  = satisfied
   *  -1  = failed
   */
  readonly margin:
    number;
}


export interface TriplicacaoGateSummary {
  readonly total:
    number;

  readonly passed:
    number;

  readonly failed:
    number;

  readonly allPassed:
    boolean;

  readonly evaluations:
    readonly TriplicacaoGateEvaluation[];
}


export interface TriplicacaoLiveDiagnosticEvent {
  readonly liveSpinIndex:
    number;

  readonly spin:
    number;

  readonly sessionEvent:
    TriplicacaoProspectiveSessionEvent;

  readonly formationState:
    string;

  readonly firstNumber:
    number | null;

  readonly secondNumber:
    number | null;

  readonly trioCompleted:
    boolean;

  readonly trioDiscarded:
    boolean;

  readonly trioNumbers:
    readonly [number, number, number] | null;

  readonly actualPatternKind:
    TriplicacaoEnginePatternKind | null;

  readonly actionStatus:
    TriplicacaoActionStatus | null;

  readonly selectedPatternKind:
    TriplicacaoEnginePatternKind | null;

  readonly probabilityMode:
    TriplicacaoAdvancedProbabilityAnalysis['probabilityMode'];

  readonly advancedEvidenceScore:
    number;

  readonly advancedConfidenceScore:
    number;

  readonly advancedRiskScore:
    number;

  readonly baseOperationalMode:
    string;

  readonly baseDominantPattern:
    string;

  readonly baseDominantFrequencyScore:
    number;

  readonly baseConfidenceScore:
    number;

  readonly baseRiskScore:
    number;

  readonly gateSummary:
    TriplicacaoGateSummary;

  readonly rationale:
    string | null;

  readonly reasons:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly blockers:
    readonly string[];

  readonly recommendationIssued:
    boolean;
}


export interface TriplicacaoPatternStats {
  readonly total:
    number;

  readonly tc:
    number;

  readonly ntc:
    number;

  readonly ta:
    number;

  readonly nta:
    number;

  readonly zeroDiscarded:
    number;

  readonly dominantPattern:
    string;

  readonly dominantFrequencyScore:
    number;

  readonly confidenceScore:
    number;

  readonly riskScore:
    number;

  readonly operationalMode:
    string;

  readonly trios:
    readonly TriplicacaoTrio[];
}


export interface TriplicacaoLiveStatsReport {
  readonly synchronizedHistorySize:
    number;

  readonly catchUpSpinCount:
    number;

  readonly liveSpinCount:
    number;

  readonly totalHistorySize:
    number;

  readonly synchronized:
    TriplicacaoPatternStats;

  readonly context:
    TriplicacaoPatternStats;

  readonly live:
    TriplicacaoPatternStats;

  readonly liveCompletedTrios:
    number;

  readonly liveDiscardedTrios:
    number;

  readonly recommendationCount:
    number;

  readonly probabilityModes: {
    readonly insufficientData:
      number;

    readonly observe:
      number;

    readonly paperOnly:
      number;
  };

  readonly actionStatuses: {
    readonly action:
      number;

    readonly noAction:
      number;

    readonly zeroBlocked:
      number;

    readonly none:
      number;
  };

  readonly latestEvents:
    readonly TriplicacaoLiveDiagnosticEvent[];

  readonly paperOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly humanExecutionRequired:
    true;

  readonly automaticBetExecutionAllowed:
    false;
}


export class TriplicacaoLiveStatsDiagnostics {
  public constructor(
    private readonly patternEngine:
      TriplicacaoPatternEngine =
        new TriplicacaoPatternEngine(),
  ) {}


  public analyze(
    input: {
      readonly history:
        readonly number[];

      readonly synchronizedHistorySize:
        number;

      readonly catchUpSpinCount:
        number;

      readonly liveSpinCount:
        number;

      readonly events:
        readonly TriplicacaoLiveDiagnosticEvent[];

      readonly latestEventLimit?:
        number;
    },
  ): TriplicacaoLiveStatsReport {
    this.validateInput(
      input,
    );

    const synchronizedEnd =
      input.synchronizedHistorySize;

    const catchUpEnd =
      synchronizedEnd +
      input.catchUpSpinCount;

    const synchronizedHistory =
      input.history.slice(
        0,
        synchronizedEnd,
      );

    const contextHistory =
      input.history.slice(
        0,
        catchUpEnd,
      );

    const synchronized =
      this.patternStats(
        this.patternEngine.analyze(
          synchronizedHistory,
        ),
      );

    const context =
      this.patternStats(
        this.patternEngine.analyze(
          contextHistory,
        ),
      );

    const live =
      this.livePatternStats(
        input.events,
      );

    const latestEventLimit =
      this.positiveInteger(
        input.latestEventLimit,
        12,
      );

    return Object.freeze({
      synchronizedHistorySize:
        input.synchronizedHistorySize,

      catchUpSpinCount:
        input.catchUpSpinCount,

      liveSpinCount:
        input.liveSpinCount,

      totalHistorySize:
        input.history.length,

      synchronized,

      context,

      live,

      liveCompletedTrios:
        input.events.filter(
          (event) =>
            event.trioCompleted,
        ).length,

      liveDiscardedTrios:
        input.events.filter(
          (event) =>
            event.trioDiscarded,
        ).length,

      recommendationCount:
        input.events.filter(
          (event) =>
            event.recommendationIssued,
        ).length,

      probabilityModes:
        Object.freeze({
          insufficientData:
            input.events.filter(
              (event) =>
                event.probabilityMode ===
                'INSUFFICIENT_DATA',
            ).length,

          observe:
            input.events.filter(
              (event) =>
                event.probabilityMode ===
                'OBSERVE',
            ).length,

          paperOnly:
            input.events.filter(
              (event) =>
                event.probabilityMode ===
                'PAPER_ONLY',
            ).length,
        }),

      actionStatuses:
        Object.freeze({
          action:
            input.events.filter(
              (event) =>
                event.actionStatus ===
                'ACTION',
            ).length,

          noAction:
            input.events.filter(
              (event) =>
                event.actionStatus ===
                'NO_ACTION',
            ).length,

          zeroBlocked:
            input.events.filter(
              (event) =>
                event.actionStatus ===
                'ZERO_BLOCKED',
            ).length,

          none:
            input.events.filter(
              (event) =>
                event.actionStatus ===
                null,
            ).length,
        }),

      latestEvents:
        Object.freeze(
          input.events.slice(
            -latestEventLimit,
          ),
        ),

      paperOnly:
        true as const,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  public event(
    input: {
      readonly liveSpinIndex:
        number;

      readonly spin:
        number;

      readonly sessionEvent:
        TriplicacaoProspectiveSessionEvent;

      readonly formationState:
        string;

      readonly formation:
        TriplicacaoProspectiveResult;

      readonly recommendationIssued:
        boolean;

      readonly analysis:
        TriplicacaoAdvancedProbabilityAnalysis;
    },
  ): TriplicacaoLiveDiagnosticEvent {
    const formation =
      input.formation;

    const trioNumbers =
      this.completedTrioNumbers(
        formation,
      );

    const actualPatternKind =
      trioNumbers ===
        null
        ? null
        : this.classifyTrio(
            trioNumbers,
          );

    const base =
      input.analysis
        .baseAnalysis;

    const baseOperationalMode =
      String(
        base
          ?.operationalMode ??
        'UNKNOWN',
      );

    const baseDominantFrequencyScore =
      Number(
        base
          ?.dominantFrequencyScore ??
        0,
      );

    const baseConfidenceScore =
      Number(
        base
          ?.confidenceScore ??
        0,
      );

    const baseRiskScore =
      Number(
        base
          ?.riskScore ??
        0,
      );

    const gateSummary =
      this.evaluateGates({
        baseOperationalMode,

        baseDominantFrequencyScore,

        baseConfidenceScore,

        baseRiskScore,

        selectedPatternKind:
          input.analysis
            .selectedPatternKind,

        advancedEvidenceScore:
          input.analysis
            .advancedEvidenceScore,

        advancedConfidenceScore:
          input.analysis
            .advancedConfidenceScore,

        advancedRiskScore:
          input.analysis
            .advancedRiskScore,
      });

    return Object.freeze({
      liveSpinIndex:
        input.liveSpinIndex,

      spin:
        input.spin,

      sessionEvent:
        input.sessionEvent,

      formationState:
        input.formationState,

      firstNumber:
        formation.firstNumber,

      secondNumber:
        formation.secondNumber,

      trioCompleted:
        formation.trioCompleted,

      trioDiscarded:
        formation.trioDiscarded,

      trioNumbers,

      actualPatternKind,

      actionStatus:
        formation.action
          ?.status ??
        null,

      selectedPatternKind:
        input.analysis
          .selectedPatternKind,

      probabilityMode:
        input.analysis
          .probabilityMode,

      advancedEvidenceScore:
        input.analysis
          .advancedEvidenceScore,

      advancedConfidenceScore:
        input.analysis
          .advancedConfidenceScore,

      advancedRiskScore:
        input.analysis
          .advancedRiskScore,

      baseOperationalMode,

      baseDominantPattern:
        String(
          base
            ?.dominantPatternKind ??
          'UNKNOWN',
        ),

      baseDominantFrequencyScore,

      baseConfidenceScore,

      baseRiskScore,

      gateSummary,

      rationale:
        formation.action
          ?.rationale ??
        null,

      reasons:
        Object.freeze([
          ...input.analysis.reasons,
          ...formation.reasons,
        ]),

      warnings:
        Object.freeze([
          ...input.analysis.warnings,
        ]),

      blockers:
        Object.freeze([
          ...input.analysis.blockers,
        ]),

      recommendationIssued:
        input.recommendationIssued,
    });
  }


  public evaluateGates(
    input: {
      readonly baseOperationalMode:
        string;

      readonly baseDominantFrequencyScore:
        number;

      readonly baseConfidenceScore:
        number;

      readonly baseRiskScore:
        number;

      readonly selectedPatternKind:
        TriplicacaoEnginePatternKind | null;

      readonly advancedEvidenceScore:
        number;

      readonly advancedConfidenceScore:
        number;

      readonly advancedRiskScore:
        number;
    },
  ): TriplicacaoGateSummary {
    const policy =
      TRIPLICACAO_GATE_POLICY;

    const evaluations:
      TriplicacaoGateEvaluation[] =
        [
          this.minimumGate(
            'BASE_DOMINANCE',
            'Dominância base',
            input.baseDominantFrequencyScore,
            policy.baseDominanceMinimum,
          ),

          this.minimumGate(
            'BASE_CONFIDENCE',
            'Confiança base',
            input.baseConfidenceScore,
            policy.baseConfidenceMinimum,
          ),

          this.maximumGate(
            'BASE_RISK',
            'Risco base',
            input.baseRiskScore,
            policy.baseRiskMaximum,
          ),

          this.requiredGate(
            'BASE_PAPER_ONLY',
            'Base em PAPER_ONLY',
            input.baseOperationalMode ===
              'PAPER_ONLY',
          ),

          this.requiredGate(
            'ADVANCED_PATTERN_SELECTED',
            'Padrão avançado selecionado',
            input.selectedPatternKind !==
              null,
          ),

          this.minimumGate(
            'ADVANCED_EVIDENCE',
            'Evidência avançada',
            input.advancedEvidenceScore,
            policy.advancedEvidenceMinimum,
          ),

          this.minimumGate(
            'ADVANCED_CONFIDENCE',
            'Confiança avançada',
            input.advancedConfidenceScore,
            policy.advancedConfidenceMinimum,
          ),

          this.maximumGate(
            'ADVANCED_RISK',
            'Risco avançado',
            input.advancedRiskScore,
            policy.advancedRiskMaximum,
          ),
        ];

    const passed =
      evaluations.filter(
        (gate) =>
          gate.passed,
      ).length;

    const failed =
      evaluations.length -
      passed;

    return Object.freeze({
      total:
        evaluations.length,

      passed,

      failed,

      allPassed:
        failed ===
        0,

      evaluations:
        Object.freeze(
          evaluations,
        ),
    });
  }


  private minimumGate(
    id:
      TriplicacaoGateId,

    label:
      string,

    observed:
      number,

    threshold:
      number,
  ): TriplicacaoGateEvaluation {
    return Object.freeze({
      id,

      label,

      comparator:
        'MINIMUM' as const,

      observed,

      threshold,

      passed:
        observed >=
        threshold,

      margin:
        this.round4(
          observed -
          threshold,
        ),
    });
  }


  private maximumGate(
    id:
      TriplicacaoGateId,

    label:
      string,

    observed:
      number,

    threshold:
      number,
  ): TriplicacaoGateEvaluation {
    return Object.freeze({
      id,

      label,

      comparator:
        'MAXIMUM' as const,

      observed,

      threshold,

      passed:
        observed <=
        threshold,

      margin:
        this.round4(
          threshold -
          observed,
        ),
    });
  }


  private requiredGate(
    id:
      TriplicacaoGateId,

    label:
      string,

    observed:
      boolean,
  ): TriplicacaoGateEvaluation {
    return Object.freeze({
      id,

      label,

      comparator:
        'REQUIRED' as const,

      observed,

      threshold:
        true,

      passed:
        observed,

      margin:
        observed
          ? 1
          : -1,
    });
  }


  private completedTrioNumbers(
    formation:
      TriplicacaoProspectiveResult,
  ):
    readonly [number, number, number] |
    null {
    if (
      !formation.trioCompleted ||
      formation.firstNumber ===
        null ||
      formation.secondNumber ===
        null
    ) {
      return null;
    }

    return Object.freeze([
      formation.firstNumber,
      formation.secondNumber,
      formation.spin,
    ]) as readonly [
      number,
      number,
      number,
    ];
  }


  private classifyTrio(
    trio:
      readonly [number, number, number],
  ):
    TriplicacaoEnginePatternKind |
    null {
    const analysis =
      this.patternEngine.analyze(
        trio,
        {
          maxHistorySize:
            3,
        },
      );

    return analysis.trios[0]
      ?.patternKind ??
      null;
  }


  private livePatternStats(
    events:
      readonly TriplicacaoLiveDiagnosticEvent[],
  ): TriplicacaoPatternStats {
    const completed =
      events.filter(
        (event) =>
          event.actualPatternKind !==
          null,
      );

    const count =
      (
        pattern:
          TriplicacaoEnginePatternKind,
      ) =>
        completed.filter(
          (event) =>
            event.actualPatternKind ===
            pattern,
        ).length;

    const tc =
      count(
        'TC',
      );

    const ntc =
      count(
        'NTC',
      );

    const ta =
      count(
        'TA',
      );

    const nta =
      count(
        'NTA',
      );

    const total =
      tc +
      ntc +
      ta +
      nta;

    const ordered =
      [
        {
          pattern:
            'TC',
          count:
            tc,
        },
        {
          pattern:
            'NTC',
          count:
            ntc,
        },
        {
          pattern:
            'TA',
          count:
            ta,
        },
        {
          pattern:
            'NTA',
          count:
            nta,
        },
      ];

    ordered.sort(
      (
        left,
        right,
      ) =>
        right.count -
        left.count,
    );

    const dominant =
      ordered[0];

    const latest =
      events[
        events.length -
        1
      ];

    return Object.freeze({
      total,

      tc,

      ntc,

      ta,

      nta,

      zeroDiscarded:
        events.filter(
          (event) =>
            event.trioDiscarded,
        ).length,

      dominantPattern:
        total >
          0
          ? dominant.pattern
          : 'NONE',

      dominantFrequencyScore:
        total >
          0
          ? this.round2(
              (
                dominant.count /
                total
              ) *
                100,
            )
          : 0,

      confidenceScore:
        latest
          ?.baseConfidenceScore ??
        0,

      riskScore:
        latest
          ?.baseRiskScore ??
        0,

      operationalMode:
        latest
          ?.baseOperationalMode ??
        'UNKNOWN',

      trios:
        Object.freeze([]),
    });
  }


  private patternStats(
    analysis:
      TriplicacaoPatternAnalysis,
  ): TriplicacaoPatternStats {
    const count =
      (
        pattern:
          TriplicacaoEnginePatternKind,
      ) =>
        analysis.trios.filter(
          (trio) =>
            trio.patternKind ===
            pattern,
        ).length;

    return Object.freeze({
      total:
        analysis.validTrioCount,

      tc:
        count(
          'TC',
        ),

      ntc:
        count(
          'NTC',
        ),

      ta:
        count(
          'TA',
        ),

      nta:
        count(
          'NTA',
        ),

      zeroDiscarded:
        analysis.discardedZeroTrioCount,

      dominantPattern:
        analysis.dominantPatternKind,

      dominantFrequencyScore:
        analysis.dominantFrequencyScore,

      confidenceScore:
        analysis.confidenceScore,

      riskScore:
        analysis.riskScore,

      operationalMode:
        analysis.operationalMode,

      trios:
        Object.freeze([
          ...analysis.trios,
        ]),
    });
  }


  private validateInput(
    input: {
      readonly history:
        readonly number[];

      readonly synchronizedHistorySize:
        number;

      readonly catchUpSpinCount:
        number;

      readonly liveSpinCount:
        number;

      readonly events:
        readonly TriplicacaoLiveDiagnosticEvent[];
    },
  ): void {
    if (
      !Array.isArray(
        input.history,
      ) ||
      !Array.isArray(
        input.events,
      )
    ) {
      throw new Error(
        'triplicacao_stats_invalid_input',
      );
    }

    for (
      const value of
      input.history
    ) {
      if (
        !Number.isInteger(
          value,
        ) ||
        value <
          0 ||
        value >
          36
      ) {
        throw new Error(
          'triplicacao_stats_invalid_spin',
        );
      }
    }

    if (
      input.synchronizedHistorySize +
        input.catchUpSpinCount +
        input.liveSpinCount !==
      input.history.length
    ) {
      throw new Error(
        'triplicacao_stats_history_count_mismatch',
      );
    }
  }


  private positiveInteger(
    value:
      number | undefined,

    fallback:
      number,
  ): number {
    return (
      Number.isInteger(
        value,
      ) &&
      Number(
        value,
      ) >
        0
    )
      ? Number(
          value,
        )
      : fallback;
  }


  private round2(
    value:
      number,
  ): number {
    return Math.round(
      value *
      100,
    ) /
    100;
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
