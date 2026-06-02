import { PaperOperationalAuditEngine } from './paper-operational-audit-engine';
import type { PaperOperationalAuditLedger } from './paper-operational-audit-engine';
import { PaperOperationalE2EHarness } from './paper-operational-e2e-harness';
import type { PaperOperationalE2EReport } from './paper-operational-e2e-harness';

export type PaperCertificationStatus =
  | 'BLOCKED'
  | 'NEEDS_REVIEW'
  | 'PAPER_READY'
  | 'PAPER_CERTIFIED';

export type PaperCertificationReason =
  | 'PAPER_CERTIFICATION_GRANTED'
  | 'PAPER_READY_PENDING_OBSERVATION'
  | 'PAPER_CERTIFICATION_NEEDS_REVIEW'
  | 'PAPER_CERTIFICATION_BLOCKED'
  | 'INVALID_PAPER_CERTIFICATION_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperCertificationRuntimeInput {
  readonly filePath: string;
  readonly sessionId: string;
  readonly tradeId: string;
  readonly balance: number;
  readonly stake: number;
  readonly startedAtEpochMs: number;
  readonly maxBytes: number;
  readonly minimumSuccessfulSteps: number;
  readonly minimumPersistedSteps: number;
  readonly requireAuditChain: boolean;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperCertificationRuntimeReport {
  readonly status: PaperCertificationStatus;
  readonly reason: PaperCertificationReason;
  readonly sessionId: string;
  readonly e2eFinalDecision: 'PAPER_COMPATIVEL' | 'AGUARDAR' | 'NAO_UTILIZAR';
  readonly e2eSuccessfulSteps: number;
  readonly e2ePersistedSteps: number;
  readonly auditChainValid: boolean;
  readonly auditLedger: PaperOperationalAuditLedger;
  readonly e2eReport: PaperOperationalE2EReport;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type PaperCertificationRuntimeResult =
  | {
      readonly ok: true;
      readonly value: PaperCertificationRuntimeReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperCertificationReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

/**
 * PaperCertificationRuntime
 *
 * Camada institucional de certificação PAPER. Ela consome o E2E Harness,
 * cria trilha de auditoria, valida cadeia hash e emite status certificável.
 *
 * Este runtime não abre aposta, não autoriza dinheiro real e não altera regras
 * de domínio. Ele apenas certifica a operação PAPER já existente.
 *
 * Complexidade: O(n), onde n é o número bounded de passos/auditorias.
 */
export class PaperCertificationRuntime {
  private readonly e2eHarness: PaperOperationalE2EHarness;
  private readonly auditEngine: PaperOperationalAuditEngine;

  public constructor(
    e2eHarness: PaperOperationalE2EHarness = new PaperOperationalE2EHarness(),
    auditEngine: PaperOperationalAuditEngine = new PaperOperationalAuditEngine(),
  ) {
    this.e2eHarness = e2eHarness;
    this.auditEngine = auditEngine;
  }

  public certify(input: PaperCertificationRuntimeInput): PaperCertificationRuntimeResult {
    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_CERTIFICATION_INPUT', invalidReason);
    }

    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper certification cannot run with live money flags enabled.');
    }

    const e2eResult = this.e2eHarness.run({
      filePath: input.filePath,
      sessionId: input.sessionId,
      tradeId: input.tradeId,
      balance: input.balance,
      stake: input.stake,
      startedAtEpochMs: input.startedAtEpochMs,
      maxBytes: input.maxBytes,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!e2eResult.ok) {
      return this.fail('PAPER_CERTIFICATION_BLOCKED', e2eResult.error.message);
    }

    const auditLedgerResult = this.buildAuditLedger(input, e2eResult.value);

    if (!auditLedgerResult.ok) {
      return this.fail('PAPER_CERTIFICATION_BLOCKED', auditLedgerResult.error.message);
    }

    const verification = this.auditEngine.verify(auditLedgerResult.value.ledger);

    if (!verification.ok) {
      return this.fail('PAPER_CERTIFICATION_BLOCKED', verification.error.message);
    }

    const auditChainValid = verification.value.reason === 'PAPER_OPERATIONAL_AUDIT_CHAIN_VALID';

    if (input.requireAuditChain && !auditChainValid) {
      return this.success(
        'BLOCKED',
        'PAPER_CERTIFICATION_BLOCKED',
        input.sessionId,
        e2eResult.value,
        auditLedgerResult.value.ledger,
        auditChainValid,
        'Certificação PAPER bloqueada por cadeia de auditoria inválida.',
      );
    }

    if (e2eResult.value.finalDecision === 'NAO_UTILIZAR') {
      return this.success(
        'BLOCKED',
        'PAPER_CERTIFICATION_BLOCKED',
        input.sessionId,
        e2eResult.value,
        auditLedgerResult.value.ledger,
        auditChainValid,
        'Certificação PAPER bloqueada porque o E2E Harness retornou NAO_UTILIZAR.',
      );
    }

    if (
      e2eResult.value.successfulSteps < input.minimumSuccessfulSteps ||
      e2eResult.value.persistedSteps < input.minimumPersistedSteps
    ) {
      return this.success(
        'NEEDS_REVIEW',
        'PAPER_CERTIFICATION_NEEDS_REVIEW',
        input.sessionId,
        e2eResult.value,
        auditLedgerResult.value.ledger,
        auditChainValid,
        'Certificação PAPER exige revisão por passos/persistência abaixo do mínimo institucional.',
      );
    }

    if (e2eResult.value.finalDecision === 'AGUARDAR') {
      return this.success(
        'PAPER_READY',
        'PAPER_READY_PENDING_OBSERVATION',
        input.sessionId,
        e2eResult.value,
        auditLedgerResult.value.ledger,
        auditChainValid,
        'Operação PAPER pronta para observação, mas ainda aguardando estabilidade adicional.',
      );
    }

    return this.success(
      'PAPER_CERTIFIED',
      'PAPER_CERTIFICATION_GRANTED',
      input.sessionId,
      e2eResult.value,
      auditLedgerResult.value.ledger,
      auditChainValid,
      'Operação PAPER certificada institucionalmente com E2E e auditoria válidos.',
    );
  }

  private buildAuditLedger(
    input: PaperCertificationRuntimeInput,
    e2eReport: PaperOperationalE2EReport,
  ): {
    readonly ok: true;
    readonly value: {
      readonly ledger: PaperOperationalAuditLedger;
    };
  } | {
    readonly ok: false;
    readonly error: {
      readonly message: string;
    };
  } {
    let ledger: PaperOperationalAuditLedger | undefined;

    for (let index = 0; index < e2eReport.steps.length; index += 1) {
      const step = e2eReport.steps[index];
      const audit = this.auditEngine.append({
        eventId: `cert-${input.sessionId}-${index}-${step.name}`,
        sessionId: input.sessionId,
        tradeId: `${input.tradeId}-${index}`,
        action: step.name === 'status-after-prepare' || step.name === 'status-after-finish'
          ? 'status'
          : step.name,
        result: step.ok ? 'PAPER_COMPATIVEL' : 'NAO_UTILIZAR',
        occurredAtEpochMs: input.startedAtEpochMs + 100 + index,
        payload: {
          stepName: step.name,
          persisted: step.persisted,
          reason: step.reason,
          productionMoneyAllowed: false,
          liveMoneyAuthorization: false,
        },
        previousLedger: ledger,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      });

      if (!audit.ok) {
        return {
          ok: false,
          error: {
            message: audit.error.message,
          },
        };
      }

      ledger = audit.value.ledger;
    }

    const certificationAudit = this.auditEngine.append({
      eventId: `cert-${input.sessionId}-final`,
      sessionId: input.sessionId,
      tradeId: input.tradeId,
      action: 'e2e-certification',
      result: e2eReport.finalDecision,
      occurredAtEpochMs: input.startedAtEpochMs + 1000,
      payload: {
        finalDecision: e2eReport.finalDecision,
        successfulSteps: e2eReport.successfulSteps,
        persistedSteps: e2eReport.persistedSteps,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
      previousLedger: ledger,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!certificationAudit.ok) {
      return {
        ok: false,
        error: {
          message: certificationAudit.error.message,
        },
      };
    }

    return {
      ok: true,
      value: {
        ledger: certificationAudit.value.ledger,
      },
    };
  }

  private success(
    status: PaperCertificationStatus,
    reason: PaperCertificationReason,
    sessionId: string,
    e2eReport: PaperOperationalE2EReport,
    auditLedger: PaperOperationalAuditLedger,
    auditChainValid: boolean,
    explanation: string,
  ): PaperCertificationRuntimeResult {
    return {
      ok: true,
      value: {
        status,
        reason,
        sessionId,
        e2eFinalDecision: e2eReport.finalDecision,
        e2eSuccessfulSteps: e2eReport.successfulSteps,
        e2ePersistedSteps: e2eReport.persistedSteps,
        auditChainValid,
        auditLedger,
        e2eReport,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation,
      },
    };
  }

  private validateInput(input: PaperCertificationRuntimeInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'input must be an object.';
    }

    if (typeof input.filePath !== 'string' || input.filePath.trim().length < 3) {
      return 'filePath must be a valid path string.';
    }

    if (!this.isSafeToken(input.sessionId, 3, 96)) {
      return 'sessionId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(input.tradeId, 3, 96)) {
      return 'tradeId must be a safe token with 3 to 96 characters.';
    }

    if (!Number.isFinite(input.balance) || input.balance <= 0) {
      return 'balance must be a positive finite number.';
    }

    if (!Number.isFinite(input.stake) || input.stake <= 0) {
      return 'stake must be a positive finite number.';
    }

    if (!Number.isInteger(input.startedAtEpochMs) || input.startedAtEpochMs <= 0) {
      return 'startedAtEpochMs must be a positive integer.';
    }

    if (!Number.isInteger(input.maxBytes) || input.maxBytes < 512 || input.maxBytes > 5_000_000) {
      return 'maxBytes must be an integer between 512 and 5000000.';
    }

    if (!Number.isInteger(input.minimumSuccessfulSteps) || input.minimumSuccessfulSteps < 1) {
      return 'minimumSuccessfulSteps must be a positive integer.';
    }

    if (!Number.isInteger(input.minimumPersistedSteps) || input.minimumPersistedSteps < 1) {
      return 'minimumPersistedSteps must be a positive integer.';
    }

    if (typeof input.requireAuditChain !== 'boolean') {
      return 'requireAuditChain must be boolean.';
    }

    return null;
  }

  private isSafeToken(value: string, min: number, max: number): boolean {
    return typeof value === 'string' && value.length >= min && value.length <= max && /^[0-9A-Za-z._:-]+$/.test(value);
  }

  private fail(reason: PaperCertificationReason, message: string): PaperCertificationRuntimeResult {
    return {
      ok: false,
      error: {
        reason,
        message,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }
}
