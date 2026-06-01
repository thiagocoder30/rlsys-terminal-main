import type { MultiSessionCertificationEvaluation } from '../multi-session';

export type PaperStabilityStressTestDecision =
  | 'PAPER_COMPATIVEL'
  | 'AGUARDAR'
  | 'NAO_UTILIZAR';

export type PaperStabilityStressTestReason =
  | 'PAPER_STABILITY_STRESS_TEST_PASSED'
  | 'PAPER_STABILITY_STRESS_TEST_NEEDS_MORE_EVIDENCE'
  | 'PAPER_STABILITY_STRESS_TEST_FAILED'
  | 'INVALID_PAPER_STABILITY_STRESS_TEST_INPUT';

export interface PaperStabilityStressTestPolicy {
  readonly minimumScenarios: number;
  readonly minimumCycles: number;
  readonly minimumPassRatio: number;
  readonly maximumBlockedRatio: number;
  readonly maximumInvalidRatio: number;
  readonly minimumAverageStabilityScore: number;
  readonly minimumWorstCaseStabilityScore: number;
  readonly maximumAverageSeverity: number;
}

export interface PaperStabilityStressScenario {
  readonly scenarioId: string;
  readonly label: string;
  readonly cycles: number;
  readonly severity: number;
  readonly evaluation: MultiSessionCertificationEvaluation;
}

export interface PaperStabilityStressTestInput {
  readonly scenarios: readonly PaperStabilityStressScenario[];
  readonly policy: PaperStabilityStressTestPolicy;
}

export interface PaperStabilityStressTestMetrics {
  readonly totalScenarios: number;
  readonly totalCycles: number;
  readonly passedScenarios: number;
  readonly waitScenarios: number;
  readonly blockedScenarios: number;
  readonly invalidScenarios: number;
  readonly passRatio: number;
  readonly waitRatio: number;
  readonly blockedRatio: number;
  readonly invalidRatio: number;
  readonly averageStabilityScore: number;
  readonly worstCaseStabilityScore: number;
  readonly averageSeverity: number;
}

export interface PaperStabilityStressTestEvaluation {
  readonly decision: PaperStabilityStressTestDecision;
  readonly reason: PaperStabilityStressTestReason;
  readonly metrics: PaperStabilityStressTestMetrics;
  readonly productionMoneyAllowed: false;
  readonly activeSessionMutationAllowed: false;
  readonly explanation: string;
}

export type PaperStabilityStressTestResult =
  | {
      readonly ok: true;
      readonly value: PaperStabilityStressTestEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: PaperStabilityStressTestEvaluation;
    };

const EMPTY_METRICS: PaperStabilityStressTestMetrics = {
  totalScenarios: 0,
  totalCycles: 0,
  passedScenarios: 0,
  waitScenarios: 0,
  blockedScenarios: 0,
  invalidScenarios: 0,
  passRatio: 0,
  waitRatio: 0,
  blockedRatio: 0,
  invalidRatio: 0,
  averageStabilityScore: 0,
  worstCaseStabilityScore: 0,
  averageSeverity: 0,
};

/**
 * PaperStabilityStressTestEngine evaluates offline PAPER certification stress
 * scenarios. It is deterministic, O(n), memory-safe, and never mutates active
 * runtime state.
 *
 * It intentionally works over already-produced certification evaluations
 * instead of touching live session state.
 */
export class PaperStabilityStressTestEngine {
  public evaluate(
    input: PaperStabilityStressTestInput,
  ): PaperStabilityStressTestResult {
    const invalidEvaluation = this.validate(input);

    if (invalidEvaluation !== null) {
      return {
        ok: false,
        error: invalidEvaluation,
      };
    }

    const metrics = this.computeMetrics(input.scenarios);

    if (
      metrics.totalScenarios < input.policy.minimumScenarios ||
      metrics.totalCycles < input.policy.minimumCycles
    ) {
      return {
        ok: true,
        value: {
          decision: 'AGUARDAR',
          reason: 'PAPER_STABILITY_STRESS_TEST_NEEDS_MORE_EVIDENCE',
          metrics,
          productionMoneyAllowed: false,
          activeSessionMutationAllowed: false,
          explanation:
            'O stress test PAPER precisa de mais cenários ou ciclos para formar evidência institucional suficiente.',
        },
      };
    }

    const hasStressRisk =
      metrics.passRatio < input.policy.minimumPassRatio ||
      metrics.blockedRatio > input.policy.maximumBlockedRatio ||
      metrics.invalidRatio > input.policy.maximumInvalidRatio ||
      metrics.averageStabilityScore <
        input.policy.minimumAverageStabilityScore ||
      metrics.worstCaseStabilityScore <
        input.policy.minimumWorstCaseStabilityScore ||
      metrics.averageSeverity > input.policy.maximumAverageSeverity;

    if (hasStressRisk) {
      return {
        ok: true,
        value: {
          decision: 'NAO_UTILIZAR',
          reason: 'PAPER_STABILITY_STRESS_TEST_FAILED',
          metrics,
          productionMoneyAllowed: false,
          activeSessionMutationAllowed: false,
          explanation:
            'O stress test PAPER detectou instabilidade operacional, bloqueios, invalidações ou severidade acima do limite institucional.',
        },
      };
    }

    return {
      ok: true,
      value: {
        decision: 'PAPER_COMPATIVEL',
        reason: 'PAPER_STABILITY_STRESS_TEST_PASSED',
        metrics,
        productionMoneyAllowed: false,
        activeSessionMutationAllowed: false,
        explanation:
          'O stress test PAPER confirmou estabilidade institucional suficiente em cenários offline.',
      },
    };
  }

  private validate(
    input: PaperStabilityStressTestInput,
  ): PaperStabilityStressTestEvaluation | null {
    const invalidPolicy =
      !Number.isFinite(input.policy.minimumScenarios) ||
      !Number.isFinite(input.policy.minimumCycles) ||
      !Number.isFinite(input.policy.minimumPassRatio) ||
      !Number.isFinite(input.policy.maximumBlockedRatio) ||
      !Number.isFinite(input.policy.maximumInvalidRatio) ||
      !Number.isFinite(input.policy.minimumAverageStabilityScore) ||
      !Number.isFinite(input.policy.minimumWorstCaseStabilityScore) ||
      !Number.isFinite(input.policy.maximumAverageSeverity) ||
      input.policy.minimumScenarios <= 0 ||
      input.policy.minimumCycles <= 0 ||
      input.policy.minimumPassRatio < 0 ||
      input.policy.minimumPassRatio > 1 ||
      input.policy.maximumBlockedRatio < 0 ||
      input.policy.maximumBlockedRatio > 1 ||
      input.policy.maximumInvalidRatio < 0 ||
      input.policy.maximumInvalidRatio > 1 ||
      input.policy.minimumAverageStabilityScore < 0 ||
      input.policy.minimumAverageStabilityScore > 1 ||
      input.policy.minimumWorstCaseStabilityScore < 0 ||
      input.policy.minimumWorstCaseStabilityScore > 1 ||
      input.policy.maximumAverageSeverity < 0 ||
      input.policy.maximumAverageSeverity > 1;

    const invalidScenarios =
      !Array.isArray(input.scenarios) ||
      input.scenarios.some((scenario) => !this.isValidScenario(scenario));

    if (!invalidPolicy && !invalidScenarios) {
      return null;
    }

    return {
      decision: 'NAO_UTILIZAR',
      reason: 'INVALID_PAPER_STABILITY_STRESS_TEST_INPUT',
      metrics: EMPTY_METRICS,
      productionMoneyAllowed: false,
      activeSessionMutationAllowed: false,
      explanation:
        'Entrada inválida para stress test PAPER. O sistema bloqueia a avaliação por segurança institucional.',
    };
  }

  private isValidScenario(scenario: PaperStabilityStressScenario): boolean {
    return (
      scenario.scenarioId.trim().length > 0 &&
      scenario.label.trim().length > 0 &&
      Number.isFinite(scenario.cycles) &&
      Number.isFinite(scenario.severity) &&
      scenario.cycles > 0 &&
      scenario.severity >= 0 &&
      scenario.severity <= 1 &&
      this.isValidEvaluation(scenario.evaluation)
    );
  }

  private isValidEvaluation(
    evaluation: MultiSessionCertificationEvaluation,
  ): boolean {
    return (
      Number.isFinite(evaluation.metrics.aggregateStabilityScore) &&
      evaluation.metrics.aggregateStabilityScore >= 0 &&
      evaluation.metrics.aggregateStabilityScore <= 1 &&
      Number.isFinite(evaluation.metrics.blockedBatchRatio) &&
      evaluation.metrics.blockedBatchRatio >= 0 &&
      evaluation.metrics.blockedBatchRatio <= 1 &&
      Number.isFinite(evaluation.metrics.invalidBatchRatio) &&
      evaluation.metrics.invalidBatchRatio >= 0 &&
      evaluation.metrics.invalidBatchRatio <= 1 &&
      evaluation.productionMoneyAllowed === false
    );
  }

  private computeMetrics(
    scenarios: readonly PaperStabilityStressScenario[],
  ): PaperStabilityStressTestMetrics {
    let totalCycles = 0;
    let passedScenarios = 0;
    let waitScenarios = 0;
    let blockedScenarios = 0;
    let invalidScenarios = 0;
    let stabilityScoreSum = 0;
    let severitySum = 0;
    let worstCaseStabilityScore = 1;

    for (const scenario of scenarios) {
      totalCycles += scenario.cycles;
      severitySum += scenario.severity;

      const stabilityScore = scenario.evaluation.metrics.aggregateStabilityScore;
      stabilityScoreSum += stabilityScore;

      if (stabilityScore < worstCaseStabilityScore) {
        worstCaseStabilityScore = stabilityScore;
      }

      if (scenario.evaluation.decision === 'PAPER_COMPATIVEL') {
        passedScenarios += 1;
      } else if (scenario.evaluation.decision === 'AGUARDAR') {
        waitScenarios += 1;
      } else {
        blockedScenarios += 1;
      }

      if (scenario.evaluation.metrics.invalidBatchRatio > 0) {
        invalidScenarios += 1;
      }
    }

    const totalScenarios = scenarios.length;
    const safeTotalScenarios = totalScenarios === 0 ? 1 : totalScenarios;

    return {
      totalScenarios,
      totalCycles,
      passedScenarios,
      waitScenarios,
      blockedScenarios,
      invalidScenarios,
      passRatio: passedScenarios / safeTotalScenarios,
      waitRatio: waitScenarios / safeTotalScenarios,
      blockedRatio: blockedScenarios / safeTotalScenarios,
      invalidRatio: invalidScenarios / safeTotalScenarios,
      averageStabilityScore: stabilityScoreSum / safeTotalScenarios,
      worstCaseStabilityScore:
        totalScenarios === 0 ? 0 : worstCaseStabilityScore,
      averageSeverity: severitySum / safeTotalScenarios,
    };
  }
}
