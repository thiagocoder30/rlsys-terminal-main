import { createHash } from 'node:crypto';

export type PaperEntrySupervisionLedgerFormat = 'JSON' | 'TEXT';

export interface PaperEntrySupervisionLedgerSource {
  readonly supervisionId: string;
  readonly generatedAtEpochMs: number;
  readonly sessionId: string;
  readonly strategyName: string;
  readonly status:
    | 'PAPER_ENTRY_AUTHORIZED'
    | 'PAPER_ENTRY_REJECTED_BY_OPERATOR'
    | 'PAPER_ENTRY_DENIED_BY_HUD';
  readonly paperEntryAuthorized: boolean;
  readonly hudRecommendation: 'ENTRAR' | 'AGUARDAR';
  readonly operatorDecision: 'CONFIRMAR' | 'RECUSAR';
  readonly operatorNote: string | null;
  readonly requestedStake: number;
  readonly authorizedStake: number;
  readonly confidencePercent: number;
  readonly evidence: readonly string[];
  readonly auditSummary: string;
  readonly renderedText: string;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
  readonly paperOnly: true;
}

export interface PaperEntrySupervisionLedgerExporterInput {
  readonly exportId: string;
  readonly generatedAtEpochMs: number;
  readonly format: PaperEntrySupervisionLedgerFormat;
  readonly supervision: PaperEntrySupervisionLedgerSource;
}

export interface PaperEntrySupervisionLedgerEntry {
  readonly ledgerEntryId: string;
  readonly exportId: string;
  readonly generatedAtEpochMs: number;
  readonly supervisionId: string;
  readonly sessionId: string;
  readonly strategyName: string;
  readonly status: PaperEntrySupervisionLedgerSource['status'];
  readonly paperEntryAuthorized: boolean;
  readonly hudRecommendation: PaperEntrySupervisionLedgerSource['hudRecommendation'];
  readonly operatorDecision: PaperEntrySupervisionLedgerSource['operatorDecision'];
  readonly operatorNote: string | null;
  readonly requestedStake: number;
  readonly authorizedStake: number;
  readonly confidencePercent: number;
  readonly evidence: readonly string[];
  readonly auditSummary: string;
  readonly checksum: string;
  readonly paperOnly: true;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly liveMoneyAuthorization: false;
}

export interface PaperEntrySupervisionLedgerExportReport {
  readonly exportId: string;
  readonly format: PaperEntrySupervisionLedgerFormat;
  readonly ledgerEntry: PaperEntrySupervisionLedgerEntry;
  readonly payload: string;
  readonly operatorSummary: string;
}

export interface PaperEntrySupervisionLedgerExporterFailure {
  readonly code: 'INVALID_PAPER_ENTRY_SUPERVISION_LEDGER_EXPORT_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type PaperEntrySupervisionLedgerExporterResult =
  | { readonly ok: true; readonly value: PaperEntrySupervisionLedgerExportReport }
  | { readonly ok: false; readonly error: PaperEntrySupervisionLedgerExporterFailure };

/**
 * Exports operator entry supervision decisions into deterministic ledger payloads.
 *
 * This exporter does not authorize entries, execute bets, click external UIs or
 * integrate with casino platforms. It only converts an already supervised PAPER
 * decision into audit-ready JSON/TEXT payloads.
 *
 * Complexity:
 * - Time: O(n), where n is evidence length.
 * - Space: O(n), because evidence and payload are materialized.
 */
export class PaperEntrySupervisionLedgerExporter {
  public export(
    input: PaperEntrySupervisionLedgerExporterInput,
  ): PaperEntrySupervisionLedgerExporterResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const ledgerEntryWithoutChecksum = {
      ledgerEntryId: this.ledgerEntryId(input),
      exportId: input.exportId.trim(),
      generatedAtEpochMs: input.generatedAtEpochMs,
      supervisionId: input.supervision.supervisionId,
      sessionId: input.supervision.sessionId,
      strategyName: input.supervision.strategyName,
      status: input.supervision.status,
      paperEntryAuthorized: input.supervision.paperEntryAuthorized,
      hudRecommendation: input.supervision.hudRecommendation,
      operatorDecision: input.supervision.operatorDecision,
      operatorNote: input.supervision.operatorNote,
      requestedStake: this.roundMoney(input.supervision.requestedStake),
      authorizedStake: this.roundMoney(input.supervision.authorizedStake),
      confidencePercent: this.roundMoney(input.supervision.confidencePercent),
      evidence: Object.freeze([...input.supervision.evidence]),
      auditSummary: input.supervision.auditSummary,
      paperOnly: true as const,
      operatorDecisionRequired: true as const,
      supervisedRecommendationOnly: true as const,
      institutionalAnalysisMode: true as const,
      automaticExecutionAllowed: false as const,
      automaticBetExecutionAllowed: false as const,
      liveMoneyAuthorization: false as const,
    };

    const checksum = this.sha256(this.stableStringify(ledgerEntryWithoutChecksum));

    const ledgerEntry: PaperEntrySupervisionLedgerEntry = Object.freeze({
      ...ledgerEntryWithoutChecksum,
      checksum,
    });

    const payload = input.format === 'JSON'
      ? this.toJson(ledgerEntry)
      : this.toText(ledgerEntry);

    return {
      ok: true,
      value: Object.freeze({
        exportId: input.exportId.trim(),
        format: input.format,
        ledgerEntry,
        payload,
        operatorSummary: this.summary(ledgerEntry),
      }),
    };
  }

  private validate(
    input: PaperEntrySupervisionLedgerExporterInput,
  ): PaperEntrySupervisionLedgerExporterFailure | null {
    if (typeof input.exportId !== 'string' || input.exportId.trim().length === 0) {
      return this.failure('exportId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('generatedAtEpochMs must be a positive finite number');
    }

    if (input.format !== 'JSON' && input.format !== 'TEXT') {
      return this.failure('format must be JSON or TEXT');
    }

    if (!this.isValidSupervision(input.supervision)) {
      return this.failure('supervision is invalid or violates supervised PAPER semantics');
    }

    return null;
  }

  private isValidSupervision(supervision: PaperEntrySupervisionLedgerSource): boolean {
    return (
      typeof supervision === 'object' &&
      supervision !== null &&
      typeof supervision.supervisionId === 'string' &&
      supervision.supervisionId.trim().length > 0 &&
      typeof supervision.sessionId === 'string' &&
      supervision.sessionId.trim().length > 0 &&
      typeof supervision.strategyName === 'string' &&
      supervision.strategyName.trim().length > 0 &&
      (
        supervision.status === 'PAPER_ENTRY_AUTHORIZED' ||
        supervision.status === 'PAPER_ENTRY_REJECTED_BY_OPERATOR' ||
        supervision.status === 'PAPER_ENTRY_DENIED_BY_HUD'
      ) &&
      typeof supervision.paperEntryAuthorized === 'boolean' &&
      (supervision.hudRecommendation === 'ENTRAR' || supervision.hudRecommendation === 'AGUARDAR') &&
      (supervision.operatorDecision === 'CONFIRMAR' || supervision.operatorDecision === 'RECUSAR') &&
      (supervision.operatorNote === null || typeof supervision.operatorNote === 'string') &&
      Number.isFinite(supervision.generatedAtEpochMs) &&
      Number.isFinite(supervision.requestedStake) &&
      Number.isFinite(supervision.authorizedStake) &&
      Number.isFinite(supervision.confidencePercent) &&
      Array.isArray(supervision.evidence) &&
      typeof supervision.auditSummary === 'string' &&
      typeof supervision.renderedText === 'string' &&
      supervision.operatorDecisionRequired === true &&
      supervision.supervisedRecommendationOnly === true &&
      supervision.institutionalAnalysisMode === true &&
      supervision.paperOnly === true
    );
  }

  private ledgerEntryId(input: PaperEntrySupervisionLedgerExporterInput): string {
    return [
      'paper-entry-ledger',
      input.supervision.sessionId.trim(),
      input.supervision.supervisionId.trim(),
      String(input.generatedAtEpochMs),
    ].join(':');
  }

  private toJson(entry: PaperEntrySupervisionLedgerEntry): string {
    return `${this.stableStringify(entry)}\n`;
  }

  private toText(entry: PaperEntrySupervisionLedgerEntry): string {
    return [
      'RL.SYS CORE — PAPER ENTRY SUPERVISION LEDGER',
      '============================================',
      `Ledger Entry ID: ${entry.ledgerEntryId}`,
      `Export ID: ${entry.exportId}`,
      `Generated At EpochMs: ${entry.generatedAtEpochMs}`,
      `Session ID: ${entry.sessionId}`,
      `Strategy: ${entry.strategyName}`,
      `Status: ${entry.status}`,
      `PAPER Entry Authorized: ${entry.paperEntryAuthorized}`,
      `HUD Recommendation: ${entry.hudRecommendation}`,
      `Operator Decision: ${entry.operatorDecision}`,
      `Requested Stake: R$ ${entry.requestedStake.toFixed(2)}`,
      `Authorized Stake: R$ ${entry.authorizedStake.toFixed(2)}`,
      `Confidence: ${entry.confidencePercent.toFixed(2)}%`,
      `Checksum: ${entry.checksum}`,
      '',
      'Audit Summary:',
      entry.auditSummary,
      '',
      'Governance:',
      'PAPER only: true',
      'Operator decision required: true',
      'Supervised recommendation only: true',
      'Automatic execution allowed: false',
      'Automatic bet execution allowed: false',
      'Live money authorization: false',
    ].join('\n');
  }

  private summary(entry: PaperEntrySupervisionLedgerEntry): string {
    if (entry.status === 'PAPER_ENTRY_AUTHORIZED') {
      return `${entry.strategyName}: decisão supervisionada autorizada e exportada para ledger PAPER.`;
    }

    if (entry.status === 'PAPER_ENTRY_REJECTED_BY_OPERATOR') {
      return `${entry.strategyName}: operador recusou a recomendação; decisão exportada para ledger PAPER.`;
    }

    return `${entry.strategyName}: HUD negou entrada; decisão exportada para ledger PAPER.`;
  }

  private stableStringify(value: unknown): string {
    return JSON.stringify(this.sortValue(value));
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortValue(item));
    }

    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      const keys = Object.keys(record).sort();

      for (const key of keys) {
        sorted[key] = this.sortValue(record[key]);
      }

      return sorted;
    }

    return value;
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private failure(message: string): PaperEntrySupervisionLedgerExporterFailure {
    return Object.freeze({
      code: 'INVALID_PAPER_ENTRY_SUPERVISION_LEDGER_EXPORT_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
