export type PaperRuntimeCertificationDecision =
  | 'PAPER_COMPATIVEL'
  | 'AGUARDAR'
  | 'NAO_UTILIZAR';

export type PaperRuntimeCertificationReason =
  | 'PAPER_RUNTIME_CERTIFIED'
  | 'PAPER_RUNTIME_NEEDS_MORE_EVIDENCE'
  | 'PAPER_RUNTIME_STABILITY_RISK'
  | 'INVALID_PAPER_RUNTIME_CERTIFICATION_INPUT';

export interface PaperRuntimeCertificationPolicy {
  readonly minimumSessions: number;
  readonly minimumCompletedSessions: number;
  readonly minimumPaperCompatibleRatio: number;
  readonly maximumBlockedRatio: number;
  readonly maximumRuntimeErrorRatio: number;
  readonly maximumAverageDrawdownPercent: number;
  readonly minimumStabilityScore: number;
}

export interface PaperRuntimeCertificationSession {
  readonly sessionId: string;
  readonly completed: boolean;
  readonly totalDecisions: number;
  readonly paperCompatibleDecisions: number;
  readonly waitDecisions: number;
  readonly blockedDecisions: number;
  readonly runtimeErrors: number;
  readonly maxDrawdownPercent: number;
}

export interface PaperRuntimeCertificationInput {
  readonly sessions: readonly PaperRuntimeCertificationSession[];
  readonly policy: PaperRuntimeCertificationPolicy;
}

export interface PaperRuntimeCertificationMetrics {
  readonly totalSessions: number;
  readonly completedSessions: number;
  readonly totalDecisions: number;
  readonly paperCompatibleRatio: number;
  readonly waitRatio: number;
  readonly blockedRatio: number;
  readonly runtimeErrorRatio: number;
  readonly averageDrawdownPercent: number;
  readonly stabilityScore: number;
}

export interface PaperRuntimeCertificationEvaluation {
  readonly decision: PaperRuntimeCertificationDecision;
  readonly reason: PaperRuntimeCertificationReason;
  readonly metrics: PaperRuntimeCertificationMetrics;
  readonly productionMoneyAllowed: false;
  readonly explanation: string;
}

export type PaperRuntimeCertificationResult =
  | { readonly ok: true; readonly value: PaperRuntimeCertificationEvaluation }
  | { readonly ok: false; readonly error: PaperRuntimeCertificationEvaluation };

const EMPTY_METRICS: PaperRuntimeCertificationMetrics = {
  totalSessions: 0,
  completedSessions: 0,
  totalDecisions: 0,
  paperCompatibleRatio: 0,
  waitRatio: 0,
  blockedRatio: 0,
  runtimeErrorRatio: 0,
  averageDrawdownPercent: 0,
  stabilityScore: 0,
};

export class PaperRuntimeCertificationHarness {
  public evaluate(input: PaperRuntimeCertificationInput): PaperRuntimeCertificationResult {
    const invalidEvaluation = this.validate(input);

    if (invalidEvaluation !== null) {
      return { ok: false, error: invalidEvaluation };
    }

    const metrics = this.computeMetrics(input.sessions);

    if (
      metrics.totalSessions < input.policy.minimumSessions ||
      metrics.completedSessions < input.policy.minimumCompletedSessions
    ) {
      return {
        ok: true,
        value: {
          decision: 'AGUARDAR',
          reason: 'PAPER_RUNTIME_NEEDS_MORE_EVIDENCE',
          metrics,
          productionMoneyAllowed: false,
          explanation:
            'A certificação PAPER ainda precisa de mais sessões finalizadas para formar evidência institucional suficiente.',
        },
      };
    }

    const hasStabilityRisk =
      metrics.paperCompatibleRatio < input.policy.minimumPaperCompatibleRatio ||
      metrics.blockedRatio > input.policy.maximumBlockedRatio ||
      metrics.runtimeErrorRatio > input.policy.maximumRuntimeErrorRatio ||
      metrics.averageDrawdownPercent > input.policy.maximumAverageDrawdownPercent ||
      metrics.stabilityScore < input.policy.minimumStabilityScore;

    if (hasStabilityRisk) {
      return {
        ok: true,
        value: {
          decision: 'NAO_UTILIZAR',
          reason: 'PAPER_RUNTIME_STABILITY_RISK',
          metrics,
          productionMoneyAllowed: false,
          explanation:
            'A certificação PAPER detectou risco de estabilidade, bloqueio, erro ou drawdown acima do limite institucional.',
        },
      };
    }

    return {
      ok: true,
      value: {
        decision: 'PAPER_COMPATIVEL',
        reason: 'PAPER_RUNTIME_CERTIFIED',
        metrics,
        productionMoneyAllowed: false,
        explanation:
          'As sessões PAPER finalizadas atendem aos critérios institucionais mínimos de estabilidade e compatibilidade.',
      },
    };
  }

  private validate(input: PaperRuntimeCertificationInput): PaperRuntimeCertificationEvaluation | null {
    const invalidPolicy =
      !Number.isFinite(input.policy.minimumSessions) ||
      !Number.isFinite(input.policy.minimumCompletedSessions) ||
      !Number.isFinite(input.policy.minimumPaperCompatibleRatio) ||
      !Number.isFinite(input.policy.maximumBlockedRatio) ||
      !Number.isFinite(input.policy.maximumRuntimeErrorRatio) ||
      !Number.isFinite(input.policy.maximumAverageDrawdownPercent) ||
      !Number.isFinite(input.policy.minimumStabilityScore) ||
      input.policy.minimumSessions <= 0 ||
      input.policy.minimumCompletedSessions <= 0 ||
      input.policy.minimumCompletedSessions > input.policy.minimumSessions ||
      input.policy.minimumPaperCompatibleRatio < 0 ||
      input.policy.minimumPaperCompatibleRatio > 1 ||
      input.policy.maximumBlockedRatio < 0 ||
      input.policy.maximumBlockedRatio > 1 ||
      input.policy.maximumRuntimeErrorRatio < 0 ||
      input.policy.maximumRuntimeErrorRatio > 1 ||
      input.policy.maximumAverageDrawdownPercent < 0 ||
      input.policy.minimumStabilityScore < 0 ||
      input.policy.minimumStabilityScore > 1;

    const invalidSessions =
      !Array.isArray(input.sessions) ||
      input.sessions.some((session) => !this.isValidSession(session));

    if (!invalidPolicy && !invalidSessions) {
      return null;
    }

    return {
      decision: 'NAO_UTILIZAR',
      reason: 'INVALID_PAPER_RUNTIME_CERTIFICATION_INPUT',
      metrics: EMPTY_METRICS,
      productionMoneyAllowed: false,
      explanation:
        'Entrada inválida para certificação PAPER. O sistema bloqueia a certificação por segurança institucional.',
    };
  }

  private isValidSession(session: PaperRuntimeCertificationSession): boolean {
    const totalFromParts =
      session.paperCompatibleDecisions + session.waitDecisions + session.blockedDecisions;

    return (
      session.sessionId.trim().length > 0 &&
      Number.isFinite(session.totalDecisions) &&
      Number.isFinite(session.paperCompatibleDecisions) &&
      Number.isFinite(session.waitDecisions) &&
      Number.isFinite(session.blockedDecisions) &&
      Number.isFinite(session.runtimeErrors) &&
      Number.isFinite(session.maxDrawdownPercent) &&
      session.totalDecisions >= 0 &&
      session.paperCompatibleDecisions >= 0 &&
      session.waitDecisions >= 0 &&
      session.blockedDecisions >= 0 &&
      session.runtimeErrors >= 0 &&
      session.maxDrawdownPercent >= 0 &&
      totalFromParts === session.totalDecisions
    );
  }

  private computeMetrics(
    sessions: readonly PaperRuntimeCertificationSession[],
  ): PaperRuntimeCertificationMetrics {
    let completedSessions = 0;
    let totalDecisions = 0;
    let paperCompatibleDecisions = 0;
    let waitDecisions = 0;
    let blockedDecisions = 0;
    let runtimeErrors = 0;
    let drawdownSum = 0;

    for (const session of sessions) {
      if (session.completed) completedSessions += 1;

      totalDecisions += session.totalDecisions;
      paperCompatibleDecisions += session.paperCompatibleDecisions;
      waitDecisions += session.waitDecisions;
      blockedDecisions += session.blockedDecisions;
      runtimeErrors += session.runtimeErrors;
      drawdownSum += session.maxDrawdownPercent;
    }

    const safeTotalDecisions = totalDecisions === 0 ? 1 : totalDecisions;
    const averageDrawdownPercent = sessions.length === 0 ? 0 : drawdownSum / sessions.length;
    const blockedRatio = blockedDecisions / safeTotalDecisions;
    const runtimeErrorRatio = runtimeErrors / safeTotalDecisions;
    const drawdownPenalty = Math.min(1, averageDrawdownPercent / 100);
    const stabilityScore = Math.max(0, 1 - blockedRatio - runtimeErrorRatio - drawdownPenalty);

    return {
      totalSessions: sessions.length,
      completedSessions,
      totalDecisions,
      paperCompatibleRatio: paperCompatibleDecisions / safeTotalDecisions,
      waitRatio: waitDecisions / safeTotalDecisions,
      blockedRatio,
      runtimeErrorRatio,
      averageDrawdownPercent,
      stabilityScore,
    };
  }
}
