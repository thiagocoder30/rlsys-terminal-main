import {
  PaperRuntimeDryRunHarness,
  type PaperRuntimeDryRunInput,
  type PaperRuntimeDryRunReport,
} from './PaperRuntimeDryRunHarness.js';

export type PaperValidationCampaignStatus =
  | 'CAMPAIGN_CERTIFIED'
  | 'CAMPAIGN_REVIEW'
  | 'CAMPAIGN_BLOCKED';

export interface PaperValidationCampaignInput {
  readonly campaignId: string;
  readonly generatedAtEpochMs: number;
  readonly dryRuns: readonly PaperRuntimeDryRunInput[];
}

export interface PaperValidationCampaignDecisionCounts {
  readonly paperFavoravel: number;
  readonly observar: number;
  readonly naoUtilizar: number;
}

export interface PaperValidationCampaignReport {
  readonly campaignId: string;
  readonly status: PaperValidationCampaignStatus;
  readonly generatedAtEpochMs: number;
  readonly dryRunCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly decisionCounts: PaperValidationCampaignDecisionCounts;
  readonly readinessRatio: number;
  readonly reviewRatio: number;
  readonly blockedRatio: number;
  readonly reports: readonly PaperRuntimeDryRunReport[];
  readonly operatorSummary: string;
  readonly paperOnly: true;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticSuggestionAllowed: true;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface PaperValidationCampaignFailure {
  readonly code: 'INVALID_PAPER_VALIDATION_CAMPAIGN_INPUT' | 'PAPER_VALIDATION_CAMPAIGN_STAGE_FAILED';
  readonly stage: 'VALIDATION' | 'DRY_RUN';
  readonly message: string;
}

export type PaperValidationCampaignResult =
  | {
      readonly ok: true;
      readonly value: PaperValidationCampaignReport;
    }
  | {
      readonly ok: false;
      readonly error: PaperValidationCampaignFailure;
    };

export interface PaperValidationCampaignPolicy {
  readonly minimumDryRuns: number;
  readonly minimumCertifiedReadinessRatio: number;
  readonly maximumBlockedRatio: number;
  readonly failOnDryRunError: boolean;
}

const DEFAULT_POLICY: PaperValidationCampaignPolicy = Object.freeze({
  minimumDryRuns: 2,
  minimumCertifiedReadinessRatio: 0.5,
  maximumBlockedRatio: 0.5,
  failOnDryRunError: true,
});

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

const safeRatio = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return numerator / denominator;
};

/**
 * Executes a supervised PAPER validation campaign over multiple dry runs.
 *
 * This engine composes PaperRuntimeDryRunHarness without connecting to live
 * platforms, without altering RuntimeKernel and without enabling automatic bet
 * execution. It provides campaign-level certification evidence for PAPER mode.
 *
 * Complexity:
 * - Time: O(n + r), where n is dry-run count and r is total round count.
 * - Space: O(n), storing only final dry-run reports.
 */
export class PaperValidationCampaignEngine {
  private readonly policy: PaperValidationCampaignPolicy;

  public constructor(
    private readonly harness: PaperRuntimeDryRunHarness = new PaperRuntimeDryRunHarness(),
    policy: PaperValidationCampaignPolicy = DEFAULT_POLICY,
  ) {
    this.policy = Object.freeze({
      minimumDryRuns: policy.minimumDryRuns,
      minimumCertifiedReadinessRatio: policy.minimumCertifiedReadinessRatio,
      maximumBlockedRatio: policy.maximumBlockedRatio,
      failOnDryRunError: policy.failOnDryRunError,
    });
  }

  public run(input: PaperValidationCampaignInput): PaperValidationCampaignResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const reports: PaperRuntimeDryRunReport[] = [];
    let failureCount = 0;

    for (const dryRun of input.dryRuns) {
      const result = this.harness.run(dryRun);

      if (!result.ok) {
        failureCount += 1;

        if (this.policy.failOnDryRunError) {
          return {
            ok: false,
            error: Object.freeze({
              code: 'PAPER_VALIDATION_CAMPAIGN_STAGE_FAILED',
              stage: 'DRY_RUN',
              message: `Dry run ${dryRun.dryRunId} failed: ${result.error.message}`,
            }),
          };
        }

        continue;
      }

      reports.push(result.value);
    }

    const decisionCounts = this.countDecisions(reports);
    const successCount = reports.length;
    const readinessRatio = round4(safeRatio(decisionCounts.paperFavoravel, successCount));
    const reviewRatio = round4(safeRatio(decisionCounts.observar, successCount));
    const blockedRatio = round4(safeRatio(decisionCounts.naoUtilizar, successCount));
    const status = this.resolveStatus(successCount, readinessRatio, blockedRatio, failureCount);

    return {
      ok: true,
      value: Object.freeze({
        campaignId: input.campaignId,
        status,
        generatedAtEpochMs: input.generatedAtEpochMs,
        dryRunCount: input.dryRuns.length,
        successCount,
        failureCount,
        decisionCounts,
        readinessRatio,
        reviewRatio,
        blockedRatio,
        reports: Object.freeze(reports),
        operatorSummary: this.composeSummary(status, successCount, decisionCounts, readinessRatio, blockedRatio),
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

  private validate(input: PaperValidationCampaignInput): PaperValidationCampaignFailure | null {
    if (input.campaignId.trim().length === 0) {
      return this.validationFailure('campaignId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.validationFailure('generatedAtEpochMs must be a positive finite number');
    }

    if (input.dryRuns.length < this.policy.minimumDryRuns) {
      return this.validationFailure(`at least ${this.policy.minimumDryRuns} dry runs are required`);
    }

    const seen = new Set<string>();

    for (const dryRun of input.dryRuns) {
      if (seen.has(dryRun.dryRunId)) {
        return this.validationFailure(`duplicated dryRunId: ${dryRun.dryRunId}`);
      }

      seen.add(dryRun.dryRunId);
    }

    return null;
  }

  private countDecisions(
    reports: readonly PaperRuntimeDryRunReport[],
  ): PaperValidationCampaignDecisionCounts {
    let paperFavoravel = 0;
    let observar = 0;
    let naoUtilizar = 0;

    for (const report of reports) {
      if (report.finalDecision === 'PAPER_FAVORAVEL') {
        paperFavoravel += 1;
      } else if (report.finalDecision === 'OBSERVAR') {
        observar += 1;
      } else {
        naoUtilizar += 1;
      }
    }

    return Object.freeze({
      paperFavoravel,
      observar,
      naoUtilizar,
    });
  }

  private resolveStatus(
    successCount: number,
    readinessRatio: number,
    blockedRatio: number,
    failureCount: number,
  ): PaperValidationCampaignStatus {
    if (successCount === 0 || failureCount > 0 || blockedRatio > this.policy.maximumBlockedRatio) {
      return 'CAMPAIGN_BLOCKED';
    }

    if (readinessRatio >= this.policy.minimumCertifiedReadinessRatio) {
      return 'CAMPAIGN_CERTIFIED';
    }

    return 'CAMPAIGN_REVIEW';
  }

  private composeSummary(
    status: PaperValidationCampaignStatus,
    successCount: number,
    decisionCounts: PaperValidationCampaignDecisionCounts,
    readinessRatio: number,
    blockedRatio: number,
  ): string {
    if (status === 'CAMPAIGN_CERTIFIED') {
      return `CAMPAIGN_CERTIFIED: ${successCount} dry runs avaliados; readiness=${readinessRatio}; bloqueios=${blockedRatio}.`;
    }

    if (status === 'CAMPAIGN_REVIEW') {
      return `CAMPAIGN_REVIEW: campanha exige avaliação manual; favoráveis=${decisionCounts.paperFavoravel}; observar=${decisionCounts.observar}; bloqueios=${decisionCounts.naoUtilizar}.`;
    }

    return `CAMPAIGN_BLOCKED: bloqueios institucionais excederam limite; bloqueios=${decisionCounts.naoUtilizar}; ratio=${blockedRatio}.`;
  }

  private validationFailure(message: string): PaperValidationCampaignFailure {
    return Object.freeze({
      code: 'INVALID_PAPER_VALIDATION_CAMPAIGN_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
