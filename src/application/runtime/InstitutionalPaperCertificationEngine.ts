import type {
  PaperValidationCampaignReport,
} from './PaperValidationCampaignEngine.js';

export type InstitutionalPaperCertificationStatus =
  | 'PAPER_CERTIFIED'
  | 'PAPER_REVIEW'
  | 'PAPER_BLOCKED';

export type InstitutionalPaperCertificationReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'CAMPAIGN_CERTIFIED'
  | 'CAMPAIGN_REVIEW_REQUIRED'
  | 'CAMPAIGN_BLOCKED'
  | 'LOW_CERTIFICATION_SCORE'
  | 'BLOCKED_RATIO_EXCEEDED'
  | 'INSUFFICIENT_CAMPAIGNS'
  | 'NO_LIVE_MONEY_AUTHORIZATION'
  | 'AUTOMATIC_BET_EXECUTION_BLOCKED'
  | 'HUMAN_SUPERVISION_REQUIRED';

export interface InstitutionalPaperCertificationInput {
  readonly certificationId: string;
  readonly generatedAtEpochMs: number;
  readonly campaigns: readonly PaperValidationCampaignReport[];
}

export interface InstitutionalPaperCertificationDecisionCounts {
  readonly paperFavoravel: number;
  readonly observar: number;
  readonly naoUtilizar: number;
}

export interface InstitutionalPaperCertificationReport {
  readonly certificationId: string;
  readonly status: InstitutionalPaperCertificationStatus;
  readonly generatedAtEpochMs: number;
  readonly campaignCount: number;
  readonly dryRunCount: number;
  readonly certifiedCampaignCount: number;
  readonly reviewCampaignCount: number;
  readonly blockedCampaignCount: number;
  readonly decisionCounts: InstitutionalPaperCertificationDecisionCounts;
  readonly averageReadinessRatio: number;
  readonly averageReviewRatio: number;
  readonly averageBlockedRatio: number;
  readonly certificationScore: number;
  readonly reasons: readonly InstitutionalPaperCertificationReason[];
  readonly operatorSummary: string;
  readonly paperOnly: true;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticSuggestionAllowed: true;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface InstitutionalPaperCertificationFailure {
  readonly code: 'INVALID_INSTITUTIONAL_PAPER_CERTIFICATION_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type InstitutionalPaperCertificationResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalPaperCertificationReport;
    }
  | {
      readonly ok: false;
      readonly error: InstitutionalPaperCertificationFailure;
    };

export interface InstitutionalPaperCertificationPolicy {
  readonly minimumCampaigns: number;
  readonly minimumPaperCertifiedScore: number;
  readonly minimumPaperReviewScore: number;
  readonly maximumBlockedRatio: number;
}

const DEFAULT_POLICY: InstitutionalPaperCertificationPolicy = Object.freeze({
  minimumCampaigns: 1,
  minimumPaperCertifiedScore: 0.72,
  minimumPaperReviewScore: 0.48,
  maximumBlockedRatio: 0.5,
});

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

const safeRatio = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return numerator / denominator;
};

/**
 * Final institutional PAPER certification engine.
 *
 * It consolidates validated PAPER campaigns into a certification report.
 * It never authorizes live money, never enables automatic execution and only
 * confirms supervised PAPER readiness.
 *
 * Complexity:
 * - Time: O(c)
 * - Space: O(1), excluding the input campaigns already held by caller.
 */
export class InstitutionalPaperCertificationEngine {
  private readonly policy: InstitutionalPaperCertificationPolicy;

  public constructor(policy: InstitutionalPaperCertificationPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumCampaigns: policy.minimumCampaigns,
      minimumPaperCertifiedScore: policy.minimumPaperCertifiedScore,
      minimumPaperReviewScore: policy.minimumPaperReviewScore,
      maximumBlockedRatio: policy.maximumBlockedRatio,
    });
  }

  public certify(
    input: InstitutionalPaperCertificationInput,
  ): InstitutionalPaperCertificationResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    let dryRunCount = 0;
    let certifiedCampaignCount = 0;
    let reviewCampaignCount = 0;
    let blockedCampaignCount = 0;
    let readinessRatioSum = 0;
    let reviewRatioSum = 0;
    let blockedRatioSum = 0;
    let paperFavoravel = 0;
    let observar = 0;
    let naoUtilizar = 0;

    for (const campaign of input.campaigns) {
      dryRunCount += campaign.dryRunCount;
      readinessRatioSum += campaign.readinessRatio;
      reviewRatioSum += campaign.reviewRatio;
      blockedRatioSum += campaign.blockedRatio;
      paperFavoravel += campaign.decisionCounts.paperFavoravel;
      observar += campaign.decisionCounts.observar;
      naoUtilizar += campaign.decisionCounts.naoUtilizar;

      if (campaign.status === 'CAMPAIGN_CERTIFIED') {
        certifiedCampaignCount += 1;
      } else if (campaign.status === 'CAMPAIGN_REVIEW') {
        reviewCampaignCount += 1;
      } else {
        blockedCampaignCount += 1;
      }
    }

    const campaignCount = input.campaigns.length;
    const averageReadinessRatio = round4(readinessRatioSum / campaignCount);
    const averageReviewRatio = round4(reviewRatioSum / campaignCount);
    const averageBlockedRatio = round4(blockedRatioSum / campaignCount);
    const certifiedCampaignRatio = safeRatio(certifiedCampaignCount, campaignCount);
    const reviewCampaignRatio = safeRatio(reviewCampaignCount, campaignCount);
    const blockedCampaignRatio = safeRatio(blockedCampaignCount, campaignCount);

    const certificationScore = round4(
      Math.max(
        0,
        Math.min(
          1,
          averageReadinessRatio * 0.42 +
            certifiedCampaignRatio * 0.28 +
            (1 - averageBlockedRatio) * 0.2 +
            reviewCampaignRatio * 0.1 -
            blockedCampaignRatio * 0.18,
        ),
      ),
    );

    const status = this.resolveStatus(certificationScore, averageBlockedRatio, blockedCampaignCount);
    const decisionCounts = Object.freeze({
      paperFavoravel,
      observar,
      naoUtilizar,
    });

    const reasons = this.resolveReasons(status, certificationScore, averageBlockedRatio, blockedCampaignCount);

    return {
      ok: true,
      value: Object.freeze({
        certificationId: input.certificationId,
        status,
        generatedAtEpochMs: input.generatedAtEpochMs,
        campaignCount,
        dryRunCount,
        certifiedCampaignCount,
        reviewCampaignCount,
        blockedCampaignCount,
        decisionCounts,
        averageReadinessRatio,
        averageReviewRatio,
        averageBlockedRatio,
        certificationScore,
        reasons: Object.freeze(reasons),
        operatorSummary: this.composeSummary(status, certificationScore, averageReadinessRatio, averageBlockedRatio),
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

  private validate(
    input: InstitutionalPaperCertificationInput,
  ): InstitutionalPaperCertificationFailure | null {
    if (input.certificationId.trim().length === 0) {
      return this.validationFailure('certificationId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.validationFailure('generatedAtEpochMs must be a positive finite number');
    }

    if (input.campaigns.length < this.policy.minimumCampaigns) {
      return this.validationFailure(`at least ${this.policy.minimumCampaigns} campaigns are required`);
    }

    const seen = new Set<string>();

    for (const campaign of input.campaigns) {
      if (seen.has(campaign.campaignId)) {
        return this.validationFailure(`duplicated campaignId: ${campaign.campaignId}`);
      }

      seen.add(campaign.campaignId);

      if (campaign.paperOnly !== true) {
        return this.validationFailure(`campaign ${campaign.campaignId} is not PAPER-only`);
      }

      if (
        campaign.productionMoneyAllowed !== false ||
        campaign.liveMoneyAuthorization !== false ||
        campaign.automaticExecutionAllowed !== false ||
        campaign.automaticBetExecutionAllowed !== false ||
        campaign.humanSupervisionRequired !== true
      ) {
        return this.validationFailure(`campaign ${campaign.campaignId} violates institutional PAPER locks`);
      }
    }

    return null;
  }

  private resolveStatus(
    certificationScore: number,
    averageBlockedRatio: number,
    blockedCampaignCount: number,
  ): InstitutionalPaperCertificationStatus {
    if (
      blockedCampaignCount > 0 ||
      averageBlockedRatio > this.policy.maximumBlockedRatio ||
      certificationScore < this.policy.minimumPaperReviewScore
    ) {
      return 'PAPER_BLOCKED';
    }

    if (certificationScore >= this.policy.minimumPaperCertifiedScore) {
      return 'PAPER_CERTIFIED';
    }

    return 'PAPER_REVIEW';
  }

  private resolveReasons(
    status: InstitutionalPaperCertificationStatus,
    certificationScore: number,
    averageBlockedRatio: number,
    blockedCampaignCount: number,
  ): InstitutionalPaperCertificationReason[] {
    const reasons: InstitutionalPaperCertificationReason[] = [
      'PAPER_ONLY_POLICY_LOCK',
      'NO_LIVE_MONEY_AUTHORIZATION',
      'AUTOMATIC_BET_EXECUTION_BLOCKED',
      'HUMAN_SUPERVISION_REQUIRED',
    ];

    if (status === 'PAPER_CERTIFIED') {
      reasons.push('CAMPAIGN_CERTIFIED');
    }

    if (status === 'PAPER_REVIEW') {
      reasons.push('CAMPAIGN_REVIEW_REQUIRED');
    }

    if (status === 'PAPER_BLOCKED') {
      reasons.push('CAMPAIGN_BLOCKED');
    }

    if (certificationScore < this.policy.minimumPaperCertifiedScore) {
      reasons.push('LOW_CERTIFICATION_SCORE');
    }

    if (blockedCampaignCount > 0 || averageBlockedRatio > this.policy.maximumBlockedRatio) {
      reasons.push('BLOCKED_RATIO_EXCEEDED');
    }

    return reasons;
  }

  private composeSummary(
    status: InstitutionalPaperCertificationStatus,
    certificationScore: number,
    averageReadinessRatio: number,
    averageBlockedRatio: number,
  ): string {
    if (status === 'PAPER_CERTIFIED') {
      return `PAPER_CERTIFIED: certificação institucional PAPER aprovada; score=${certificationScore}; readiness=${averageReadinessRatio}; blocked=${averageBlockedRatio}.`;
    }

    if (status === 'PAPER_REVIEW') {
      return `PAPER_REVIEW: certificação exige revisão manual; score=${certificationScore}; readiness=${averageReadinessRatio}; blocked=${averageBlockedRatio}.`;
    }

    return `PAPER_BLOCKED: certificação bloqueada defensivamente; score=${certificationScore}; readiness=${averageReadinessRatio}; blocked=${averageBlockedRatio}.`;
  }

  private validationFailure(message: string): InstitutionalPaperCertificationFailure {
    return Object.freeze({
      code: 'INVALID_INSTITUTIONAL_PAPER_CERTIFICATION_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
