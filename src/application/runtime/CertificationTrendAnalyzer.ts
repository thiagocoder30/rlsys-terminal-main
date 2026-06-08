import type {
  InstitutionalCertificationHistoryReport,
  InstitutionalCertificationHistoryTrend,
} from './InstitutionalCertificationHistoryEngine.js';

export type CertificationTrendAnalyzerDecision =
  | 'TREND_IMPROVING'
  | 'TREND_STABLE'
  | 'TREND_DEGRADING'
  | 'TREND_BLOCKED'
  | 'TREND_INSUFFICIENT_DATA';

export interface CertificationTrendAnalyzerInput {
  readonly history: InstitutionalCertificationHistoryReport;
}

export interface CertificationTrendAnalyzerReport {
  readonly decision: CertificationTrendAnalyzerDecision;
  readonly historyTrend: InstitutionalCertificationHistoryTrend;
  readonly totalCertifications: number;
  readonly certifiedRatio: number;
  readonly reviewRatio: number;
  readonly blockedRatio: number;
  readonly latestStatus: 'PAPER_CERTIFIED' | 'PAPER_REVIEW' | 'PAPER_BLOCKED' | null;
  readonly confidenceScore: number;
  readonly operatorRecommendation:
    | 'CERTIFICATION_TREND_SUPPORTS_PAPER_CONTINUITY'
    | 'CERTIFICATION_TREND_SUPPORTS_OBSERVATION'
    | 'CERTIFICATION_TREND_REQUIRES_REVIEW'
    | 'CERTIFICATION_TREND_BLOCKS_OPERATION';
  readonly reasons: readonly string[];
  readonly paperOnly: true;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticSuggestionAllowed: true;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface CertificationTrendAnalyzerFailure {
  readonly code: 'INVALID_CERTIFICATION_TREND_INPUT' | 'CERTIFICATION_TREND_GOVERNANCE_VIOLATION';
  readonly stage: 'VALIDATION' | 'GOVERNANCE';
  readonly message: string;
}

export type CertificationTrendAnalyzerResult =
  | { readonly ok: true; readonly value: CertificationTrendAnalyzerReport }
  | { readonly ok: false; readonly error: CertificationTrendAnalyzerFailure };

/**
 * Analyzes institutional PAPER certification history into an operator-facing trend signal.
 *
 * Complexity:
 * - Time: O(1), because it consumes the already summarized history report.
 * - Space: O(1).
 *
 * This analyzer never reads or rewrites the ledger, never touches RuntimeKernel,
 * never authorizes live money and never executes bets.
 */
export class CertificationTrendAnalyzer {
  public analyze(input: CertificationTrendAnalyzerInput): CertificationTrendAnalyzerResult {
    const history = input.history;

    if (!this.isValidHistory(history)) {
      return {
        ok: false,
        error: this.failure(
          'INVALID_CERTIFICATION_TREND_INPUT',
          'VALIDATION',
          'history report is invalid or incomplete',
        ),
      };
    }

    if (!this.hasSafeGovernance(history)) {
      return {
        ok: false,
        error: this.failure(
          'CERTIFICATION_TREND_GOVERNANCE_VIOLATION',
          'GOVERNANCE',
          'history report violates institutional PAPER governance locks',
        ),
      };
    }

    const total = history.totalCertifications;
    const certifiedRatio = this.ratio(history.certifiedCount, total);
    const reviewRatio = this.ratio(history.reviewCount, total);
    const blockedRatio = this.ratio(history.blockedCount, total);

    const decision = this.decision(history.certificationTrend, blockedRatio);
    const confidenceScore = this.confidence(decision, certifiedRatio, reviewRatio, blockedRatio, total);

    return {
      ok: true,
      value: Object.freeze({
        decision,
        historyTrend: history.certificationTrend,
        totalCertifications: total,
        certifiedRatio,
        reviewRatio,
        blockedRatio,
        latestStatus: history.latestCertification === null ? null : history.latestCertification.status,
        confidenceScore,
        operatorRecommendation: this.operatorRecommendation(decision),
        reasons: Object.freeze(this.reasons(decision, history, certifiedRatio, reviewRatio, blockedRatio)),
        paperOnly: true,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        automaticExecutionAllowed: false,
        automaticSuggestionAllowed: true,
        automaticBetExecutionAllowed: false,
        humanSupervisionRequired: true,
      }),
    };
  }

  private isValidHistory(history: InstitutionalCertificationHistoryReport): boolean {
    return (
      typeof history === 'object' &&
      history !== null &&
      Number.isInteger(history.totalCertifications) &&
      Number.isInteger(history.certifiedCount) &&
      Number.isInteger(history.reviewCount) &&
      Number.isInteger(history.blockedCount) &&
      history.totalCertifications >= 0 &&
      history.certifiedCount >= 0 &&
      history.reviewCount >= 0 &&
      history.blockedCount >= 0 &&
      history.certifiedCount + history.reviewCount + history.blockedCount === history.totalCertifications
    );
  }

  private hasSafeGovernance(history: InstitutionalCertificationHistoryReport): boolean {
    return (
      history.paperOnly === true &&
      history.productionMoneyAllowed === false &&
      history.liveMoneyAuthorization === false &&
      history.automaticExecutionAllowed === false &&
      history.automaticSuggestionAllowed === true &&
      history.automaticBetExecutionAllowed === false &&
      history.humanSupervisionRequired === true
    );
  }

  private ratio(count: number, total: number): number {
    if (total <= 0) {
      return 0;
    }

    return Number((count / total).toFixed(6));
  }

  private decision(
    historyTrend: InstitutionalCertificationHistoryTrend,
    blockedRatio: number,
  ): CertificationTrendAnalyzerDecision {
    if (historyTrend === 'CERTIFICATION_HISTORY_INSUFFICIENT_DATA') {
      return 'TREND_INSUFFICIENT_DATA';
    }

    if (historyTrend === 'CERTIFICATION_HISTORY_BLOCKED' || blockedRatio >= 0.5) {
      return 'TREND_BLOCKED';
    }

    if (historyTrend === 'CERTIFICATION_HISTORY_DEGRADING') {
      return 'TREND_DEGRADING';
    }

    if (historyTrend === 'CERTIFICATION_HISTORY_IMPROVING') {
      return 'TREND_IMPROVING';
    }

    return 'TREND_STABLE';
  }

  private confidence(
    decision: CertificationTrendAnalyzerDecision,
    certifiedRatio: number,
    reviewRatio: number,
    blockedRatio: number,
    totalCertifications: number,
  ): number {
    const sampleWeight = Math.min(1, totalCertifications / 10);

    if (decision === 'TREND_IMPROVING') {
      return this.clamp((0.55 + certifiedRatio * 0.35 - blockedRatio * 0.2) * sampleWeight);
    }

    if (decision === 'TREND_STABLE') {
      return this.clamp((0.45 + certifiedRatio * 0.25 + reviewRatio * 0.1 - blockedRatio * 0.25) * sampleWeight);
    }

    if (decision === 'TREND_DEGRADING') {
      return this.clamp((0.55 + blockedRatio * 0.25 + reviewRatio * 0.15) * sampleWeight);
    }

    if (decision === 'TREND_BLOCKED') {
      return this.clamp((0.7 + blockedRatio * 0.3) * sampleWeight);
    }

    return this.clamp(0.2 * sampleWeight);
  }

  private clamp(value: number): number {
    if (value < 0) {
      return 0;
    }

    if (value > 1) {
      return 1;
    }

    return Number(value.toFixed(6));
  }

  private operatorRecommendation(
    decision: CertificationTrendAnalyzerDecision,
  ): CertificationTrendAnalyzerReport['operatorRecommendation'] {
    if (decision === 'TREND_IMPROVING') {
      return 'CERTIFICATION_TREND_SUPPORTS_PAPER_CONTINUITY';
    }

    if (decision === 'TREND_STABLE' || decision === 'TREND_INSUFFICIENT_DATA') {
      return 'CERTIFICATION_TREND_SUPPORTS_OBSERVATION';
    }

    if (decision === 'TREND_DEGRADING') {
      return 'CERTIFICATION_TREND_REQUIRES_REVIEW';
    }

    return 'CERTIFICATION_TREND_BLOCKS_OPERATION';
  }

  private reasons(
    decision: CertificationTrendAnalyzerDecision,
    history: InstitutionalCertificationHistoryReport,
    certifiedRatio: number,
    reviewRatio: number,
    blockedRatio: number,
  ): readonly string[] {
    const reasons: string[] = [
      'PAPER_ONLY_POLICY_LOCK',
      'NO_LIVE_MONEY_AUTHORIZATION',
      'AUTOMATIC_BET_EXECUTION_BLOCKED',
      'HUMAN_SUPERVISION_REQUIRED',
      `TOTAL_CERTIFICATIONS:${history.totalCertifications}`,
      `CERTIFIED_RATIO:${certifiedRatio.toFixed(6)}`,
      `REVIEW_RATIO:${reviewRatio.toFixed(6)}`,
      `BLOCKED_RATIO:${blockedRatio.toFixed(6)}`,
      `HISTORY_TREND:${history.certificationTrend}`,
      `ANALYZER_DECISION:${decision}`,
    ];

    if (history.latestCertification !== null) {
      reasons.push(`LATEST_STATUS:${history.latestCertification.status}`);
    }

    return Object.freeze(reasons);
  }

  private failure(
    code: CertificationTrendAnalyzerFailure['code'],
    stage: CertificationTrendAnalyzerFailure['stage'],
    message: string,
  ): CertificationTrendAnalyzerFailure {
    return Object.freeze({ code, stage, message });
  }
}
