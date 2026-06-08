import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

import type {
  PaperCertificationReportExporterReport,
  PaperCertificationJsonExport,
} from './PaperCertificationReportExporter.js';

export type CertificationLedgerExportStatus =
  | 'PAPER_CERTIFIED'
  | 'PAPER_REVIEW'
  | 'PAPER_BLOCKED';

export interface CertificationLedgerExportInput {
  readonly ledgerEntryId: string;
  readonly generatedAtEpochMs: number;
  readonly sourceHead: string;
  readonly certificationExport: PaperCertificationReportExporterReport;
}

export interface CertificationLedgerEntry {
  readonly ledgerEntryId: string;
  readonly checksum: string;
  readonly checksumAlgorithm: 'sha256';
  readonly sourceHead: string;
  readonly certificationId: string;
  readonly exportId: string;
  readonly status: CertificationLedgerExportStatus;
  readonly generatedAtEpochMs: number;
  readonly immutablePayload: PaperCertificationJsonExport;
  readonly governance: {
    readonly paperOnly: true;
    readonly productionMoneyAllowed: false;
    readonly liveMoneyAuthorization: false;
    readonly automaticExecutionAllowed: false;
    readonly automaticSuggestionAllowed: true;
    readonly automaticBetExecutionAllowed: false;
    readonly humanSupervisionRequired: true;
    readonly appendOnly: true;
  };
}

export interface CertificationLedgerExportReport {
  readonly ledgerEntryId: string;
  readonly certificationId: string;
  readonly exportId: string;
  readonly status: CertificationLedgerExportStatus;
  readonly checksum: string;
  readonly ndjsonLine: string;
  readonly byteLength: number;
  readonly paperOnly: true;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticSuggestionAllowed: true;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface CertificationLedgerExportFailure {
  readonly code: 'INVALID_CERTIFICATION_LEDGER_EXPORT_INPUT' | 'CERTIFICATION_LEDGER_WRITE_FAILED';
  readonly stage: 'VALIDATION' | 'PERSISTENCE';
  readonly message: string;
}

export type CertificationLedgerExportResult =
  | { readonly ok: true; readonly value: CertificationLedgerExportReport }
  | { readonly ok: false; readonly error: CertificationLedgerExportFailure };

type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

/**
 * Exports PAPER certification reports to an append-only NDJSON ledger.
 *
 * Complexity:
 * - Time: O(n), where n is the serialized certification payload size.
 * - Space: O(n), only for one ledger entry line. It never loads history.
 *
 * This engine is PAPER-only. It never authorizes live money, never executes
 * bets and never changes RuntimeKernel behavior.
 */
export class CertificationLedgerExportEngine {
  public export(input: CertificationLedgerExportInput): CertificationLedgerExportResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const entryWithoutChecksum = Object.freeze({
      ledgerEntryId: input.ledgerEntryId,
      checksumAlgorithm: 'sha256' as const,
      sourceHead: input.sourceHead,
      certificationId: input.certificationExport.certificationId,
      exportId: input.certificationExport.exportId,
      status: input.certificationExport.status as CertificationLedgerExportStatus,
      generatedAtEpochMs: input.generatedAtEpochMs,
      immutablePayload: input.certificationExport.json,
      governance: Object.freeze({
        paperOnly: true,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        automaticExecutionAllowed: false,
        automaticSuggestionAllowed: true,
        automaticBetExecutionAllowed: false,
        humanSupervisionRequired: true,
        appendOnly: true,
      }),
    });

    const checksum = this.sha256(this.canonicalStringify(entryWithoutChecksum));
    const entry: CertificationLedgerEntry = Object.freeze({
      ...entryWithoutChecksum,
      checksum,
    });

    const ndjsonLine = this.canonicalStringify(entry);
    const byteLength = Buffer.byteLength(ndjsonLine, 'utf8');

    return {
      ok: true,
      value: Object.freeze({
        ledgerEntryId: entry.ledgerEntryId,
        certificationId: entry.certificationId,
        exportId: entry.exportId,
        status: entry.status,
        checksum: entry.checksum,
        ndjsonLine,
        byteLength,
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

  public appendToFile(
    ledgerFilePath: string,
    input: CertificationLedgerExportInput,
  ): CertificationLedgerExportResult {
    if (ledgerFilePath.trim().length === 0) {
      return {
        ok: false,
        error: this.failure(
          'INVALID_CERTIFICATION_LEDGER_EXPORT_INPUT',
          'VALIDATION',
          'ledgerFilePath is required',
        ),
      };
    }

    const exported = this.export(input);
    if (!exported.ok) {
      return exported;
    }

    try {
      mkdirSync(dirname(ledgerFilePath), { recursive: true });
      appendFileSync(ledgerFilePath, `${exported.value.ndjsonLine}\n`, {
        encoding: 'utf8',
        flag: 'a',
      });
      return exported;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown persistence failure';
      return {
        ok: false,
        error: this.failure(
          'CERTIFICATION_LEDGER_WRITE_FAILED',
          'PERSISTENCE',
          `failed to append certification ledger entry: ${message}`,
        ),
      };
    }
  }

  private validate(input: CertificationLedgerExportInput): CertificationLedgerExportFailure | null {
    if (input.ledgerEntryId.trim().length === 0) {
      return this.failure(
        'INVALID_CERTIFICATION_LEDGER_EXPORT_INPUT',
        'VALIDATION',
        'ledgerEntryId is required',
      );
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure(
        'INVALID_CERTIFICATION_LEDGER_EXPORT_INPUT',
        'VALIDATION',
        'generatedAtEpochMs must be a positive finite number',
      );
    }

    if (input.sourceHead.trim().length === 0) {
      return this.failure(
        'INVALID_CERTIFICATION_LEDGER_EXPORT_INPUT',
        'VALIDATION',
        'sourceHead is required',
      );
    }

    const exported = input.certificationExport;

    if (exported.exportId.trim().length === 0) {
      return this.failure(
        'INVALID_CERTIFICATION_LEDGER_EXPORT_INPUT',
        'VALIDATION',
        'exportId is required',
      );
    }

    if (exported.certificationId.trim().length === 0) {
      return this.failure(
        'INVALID_CERTIFICATION_LEDGER_EXPORT_INPUT',
        'VALIDATION',
        'certificationId is required',
      );
    }

    if (
      exported.status !== 'PAPER_CERTIFIED' &&
      exported.status !== 'PAPER_REVIEW' &&
      exported.status !== 'PAPER_BLOCKED'
    ) {
      return this.failure(
        'INVALID_CERTIFICATION_LEDGER_EXPORT_INPUT',
        'VALIDATION',
        'status must be PAPER_CERTIFIED, PAPER_REVIEW or PAPER_BLOCKED',
      );
    }

    if (
      exported.paperOnly !== true ||
      exported.productionMoneyAllowed !== false ||
      exported.liveMoneyAuthorization !== false ||
      exported.automaticExecutionAllowed !== false ||
      exported.automaticSuggestionAllowed !== true ||
      exported.automaticBetExecutionAllowed !== false ||
      exported.humanSupervisionRequired !== true
    ) {
      return this.failure(
        'INVALID_CERTIFICATION_LEDGER_EXPORT_INPUT',
        'VALIDATION',
        'certification export violates institutional PAPER locks',
      );
    }

    const governance = exported.json.governance;
    if (
      governance.paperOnly !== true ||
      governance.productionMoneyAllowed !== false ||
      governance.liveMoneyAuthorization !== false ||
      governance.automaticExecutionAllowed !== false ||
      governance.automaticSuggestionAllowed !== true ||
      governance.automaticBetExecutionAllowed !== false ||
      governance.humanSupervisionRequired !== true
    ) {
      return this.failure(
        'INVALID_CERTIFICATION_LEDGER_EXPORT_INPUT',
        'VALIDATION',
        'certification JSON payload violates institutional PAPER locks',
      );
    }

    return null;
  }

  private sha256(payload: string): string {
    return `sha256:${createHash('sha256').update(payload, 'utf8').digest('hex')}`;
  }

  private canonicalStringify(value: unknown): string {
    return JSON.stringify(this.toCanonicalValue(value));
  }

  private toCanonicalValue(value: unknown): CanonicalValue {
    if (value === null) {
      return null;
    }

    const valueType = typeof value;
    if (valueType === 'string' || valueType === 'boolean') {
      return value as string | boolean;
    }

    if (valueType === 'number') {
      const numericValue = value as number;
      if (!Number.isFinite(numericValue)) {
        return null;
      }
      return numericValue;
    }

    if (Array.isArray(value)) {
      return Object.freeze(value.map((item) => this.toCanonicalValue(item)));
    }

    if (valueType === 'object') {
      const record = value as Record<string, unknown>;
      const ordered: { [key: string]: CanonicalValue } = {};
      for (const key of Object.keys(record).sort()) {
        const item = record[key];
        if (typeof item !== 'undefined' && typeof item !== 'function' && typeof item !== 'symbol') {
          ordered[key] = this.toCanonicalValue(item);
        }
      }
      return Object.freeze(ordered);
    }

    return null;
  }

  private failure(
    code: CertificationLedgerExportFailure['code'],
    stage: CertificationLedgerExportFailure['stage'],
    message: string,
  ): CertificationLedgerExportFailure {
    return Object.freeze({ code, stage, message });
  }
}
