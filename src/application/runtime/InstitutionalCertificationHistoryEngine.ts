import type {
  CertificationLedgerEntry,
  CertificationLedgerExportStatus,
} from './CertificationLedgerExportEngine.js';

export type InstitutionalCertificationHistoryTrend =
  | 'CERTIFICATION_HISTORY_IMPROVING'
  | 'CERTIFICATION_HISTORY_STABLE'
  | 'CERTIFICATION_HISTORY_DEGRADING'
  | 'CERTIFICATION_HISTORY_BLOCKED'
  | 'CERTIFICATION_HISTORY_INSUFFICIENT_DATA';

export interface InstitutionalCertificationHistoryInput {
  readonly ledgerLines: readonly string[];
}

export interface InstitutionalCertificationHistoryReport {
  readonly totalCertifications: number;
  readonly certifiedCount: number;
  readonly reviewCount: number;
  readonly blockedCount: number;
  readonly latestCertification: {
    readonly ledgerEntryId: string;
    readonly certificationId: string;
    readonly exportId: string;
    readonly status: CertificationLedgerExportStatus;
    readonly generatedAtEpochMs: number;
    readonly checksum: string;
  } | null;
  readonly certificationTrend: InstitutionalCertificationHistoryTrend;
  readonly firstGeneratedAtEpochMs: number | null;
  readonly latestGeneratedAtEpochMs: number | null;
  readonly paperOnly: true;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticSuggestionAllowed: true;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

/**
 * Builds institutional PAPER certification history from append-only ledger lines.
 *
 * Complexity:
 * - Time: O(n), where n is the number of NDJSON ledger lines.
 * - Space: O(1), excluding the caller-provided input lines.
 */
export class InstitutionalCertificationHistoryEngine {
  public summarize(input: InstitutionalCertificationHistoryInput) {
    let totalCertifications = 0;
    let certifiedCount = 0;
    let reviewCount = 0;
    let blockedCount = 0;

    let firstGeneratedAtEpochMs: number | null = null;
    let latestGeneratedAtEpochMs: number | null = null;
    let latestEntry: CertificationLedgerEntry | null = null;

    let previousStatus: CertificationLedgerExportStatus | null = null;
    let positiveTransitions = 0;
    let negativeTransitions = 0;

    for (let index = 0; index < input.ledgerLines.length; index += 1) {
      const line = input.ledgerLines[index].trim();

      if (line.length === 0) {
        continue;
      }

      let entry: CertificationLedgerEntry;

      try {
        entry = JSON.parse(line) as CertificationLedgerEntry;
      } catch {
        return {
          ok: false as const,
          error: Object.freeze({
            code: 'INVALID_CERTIFICATION_LEDGER_LINE',
            stage: 'PARSING',
            message: 'invalid NDJSON ledger line',
            lineIndex: index,
          }),
        };
      }

      if (!this.isValidEntry(entry)) {
        return {
          ok: false as const,
          error: Object.freeze({
            code: 'INVALID_CERTIFICATION_LEDGER_LINE',
            stage: 'PARSING',
            message: 'ledger line is missing required certification fields',
            lineIndex: index,
          }),
        };
      }

      if (!this.hasSafeGovernance(entry)) {
        return {
          ok: false as const,
          error: Object.freeze({
            code: 'CERTIFICATION_LEDGER_GOVERNANCE_VIOLATION',
            stage: 'GOVERNANCE',
            message: 'ledger entry violates institutional PAPER governance locks',
            lineIndex: index,
          }),
        };
      }

      totalCertifications += 1;

      if (entry.status === 'PAPER_CERTIFIED') {
        certifiedCount += 1;
      } else if (entry.status === 'PAPER_REVIEW') {
        reviewCount += 1;
      } else if (entry.status === 'PAPER_BLOCKED') {
        blockedCount += 1;
      }

      if (firstGeneratedAtEpochMs === null || entry.generatedAtEpochMs < firstGeneratedAtEpochMs) {
        firstGeneratedAtEpochMs = entry.generatedAtEpochMs;
      }

      if (latestGeneratedAtEpochMs === null || entry.generatedAtEpochMs >= latestGeneratedAtEpochMs) {
        latestGeneratedAtEpochMs = entry.generatedAtEpochMs;
        latestEntry = entry;
      }

      if (previousStatus !== null) {
        const previousRank = this.statusRank(previousStatus);
        const currentRank = this.statusRank(entry.status);

        if (currentRank > previousRank) {
          positiveTransitions += 1;
        } else if (currentRank < previousRank) {
          negativeTransitions += 1;
        }
      }

      previousStatus = entry.status;
    }

    return {
      ok: true as const,
      value: Object.freeze({
        totalCertifications,
        certifiedCount,
        reviewCount,
        blockedCount,
        latestCertification: latestEntry === null
          ? null
          : Object.freeze({
              ledgerEntryId: latestEntry.ledgerEntryId,
              certificationId: latestEntry.certificationId,
              exportId: latestEntry.exportId,
              status: latestEntry.status,
              generatedAtEpochMs: latestEntry.generatedAtEpochMs,
              checksum: latestEntry.checksum,
            }),
        certificationTrend: this.trend(
          totalCertifications,
          blockedCount,
          positiveTransitions,
          negativeTransitions,
        ),
        firstGeneratedAtEpochMs,
        latestGeneratedAtEpochMs,
        paperOnly: true,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        automaticExecutionAllowed: false,
        automaticSuggestionAllowed: true,
        automaticBetExecutionAllowed: false,
        humanSupervisionRequired: true,
      } satisfies InstitutionalCertificationHistoryReport),
    };
  }

  private isValidEntry(entry: CertificationLedgerEntry): boolean {
    return (
      typeof entry.ledgerEntryId === 'string' &&
      typeof entry.certificationId === 'string' &&
      typeof entry.exportId === 'string' &&
      typeof entry.checksum === 'string' &&
      entry.checksum.startsWith('sha256:') &&
      typeof entry.sourceHead === 'string' &&
      typeof entry.generatedAtEpochMs === 'number' &&
      Number.isFinite(entry.generatedAtEpochMs) &&
      entry.generatedAtEpochMs > 0 &&
      (
        entry.status === 'PAPER_CERTIFIED' ||
        entry.status === 'PAPER_REVIEW' ||
        entry.status === 'PAPER_BLOCKED'
      ) &&
      typeof entry.governance === 'object' &&
      entry.governance !== null
    );
  }

  private hasSafeGovernance(entry: CertificationLedgerEntry): boolean {
    return (
      entry.governance.paperOnly === true &&
      entry.governance.productionMoneyAllowed === false &&
      entry.governance.liveMoneyAuthorization === false &&
      entry.governance.automaticExecutionAllowed === false &&
      entry.governance.automaticSuggestionAllowed === true &&
      entry.governance.automaticBetExecutionAllowed === false &&
      entry.governance.humanSupervisionRequired === true &&
      entry.governance.appendOnly === true
    );
  }

  private statusRank(status: CertificationLedgerExportStatus): number {
    if (status === 'PAPER_CERTIFIED') {
      return 2;
    }

    if (status === 'PAPER_REVIEW') {
      return 1;
    }

    return 0;
  }

  private trend(
    totalCertifications: number,
    blockedCount: number,
    positiveTransitions: number,
    negativeTransitions: number,
  ): InstitutionalCertificationHistoryTrend {
    if (totalCertifications < 2) {
      return 'CERTIFICATION_HISTORY_INSUFFICIENT_DATA';
    }

    if (blockedCount === totalCertifications) {
      return 'CERTIFICATION_HISTORY_BLOCKED';
    }

    if (positiveTransitions > negativeTransitions) {
      return 'CERTIFICATION_HISTORY_IMPROVING';
    }

    if (negativeTransitions > positiveTransitions) {
      return 'CERTIFICATION_HISTORY_DEGRADING';
    }

    return 'CERTIFICATION_HISTORY_STABLE';
  }
}
