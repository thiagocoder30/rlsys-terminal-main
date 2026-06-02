import { PaperOperationalStateStore } from './paper-operational-state-store';
import { PaperOperationalStatefulCliEngine } from './paper-operational-stateful-cli-engine';
import type {
  PaperOperationalStatefulCommand,
  PaperOperationalStatefulInput,
  PaperOperationalStatefulResponse,
} from './paper-operational-stateful-cli-engine';

export type PaperOperationalE2EFinalDecision = 'PAPER_COMPATIVEL' | 'AGUARDAR' | 'NAO_UTILIZAR';

export type PaperOperationalE2EReason =
  | 'PAPER_OPERATIONAL_E2E_CERTIFIED'
  | 'PAPER_OPERATIONAL_E2E_NEEDS_REVIEW'
  | 'PAPER_OPERATIONAL_E2E_BLOCKED'
  | 'INVALID_PAPER_OPERATIONAL_E2E_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export type PaperOperationalE2EStepName =
  | 'prepare'
  | 'status-after-prepare'
  | 'open-paper'
  | 'settle-win'
  | 'settle-loss'
  | 'settle-push'
  | 'snapshot'
  | 'recover'
  | 'finish'
  | 'status-after-finish';

export interface PaperOperationalE2EHarnessInput {
  readonly filePath: string;
  readonly sessionId: string;
  readonly tradeId: string;
  readonly balance: number;
  readonly stake: number;
  readonly startedAtEpochMs: number;
  readonly maxBytes: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperOperationalE2EStep {
  readonly name: PaperOperationalE2EStepName;
  readonly ok: boolean;
  readonly persisted: boolean;
  readonly reason: string;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
}

export interface PaperOperationalE2EReport {
  readonly finalDecision: PaperOperationalE2EFinalDecision;
  readonly reason: PaperOperationalE2EReason;
  readonly sessionId: string;
  readonly totalSteps: number;
  readonly successfulSteps: number;
  readonly persistedSteps: number;
  readonly steps: readonly PaperOperationalE2EStep[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type PaperOperationalE2EResult =
  | {
      readonly ok: true;
      readonly value: PaperOperationalE2EReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperOperationalE2EReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

/**
 * PaperOperationalE2EHarness
 *
 * Harness institucional de ponta a ponta para o modo PAPER persistido.
 * Ele executa o ciclo operacional usando o StateStore e o Stateful CLI:
 * prepare -> status -> open-paper -> settlements -> snapshot -> recover -> finish.
 *
 * Este componente pertence à infraestrutura/aplicação. Ele não implementa
 * regras de banca; apenas certifica que os motores já existentes funcionam
 * juntos, mantendo live money bloqueado.
 *
 * Complexidade: O(k + n), onde k é número fixo de comandos e n é o tamanho
 * bounded do JSON persistido.
 */
export class PaperOperationalE2EHarness {
  public run(input: PaperOperationalE2EHarnessInput): PaperOperationalE2EResult {
    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_OPERATIONAL_E2E_INPUT', invalidReason);
    }

    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper operational E2E harness cannot run with live money flags enabled.');
    }

    const store = new PaperOperationalStateStore({
      filePath: input.filePath,
      maxBytes: input.maxBytes,
    });
    const engine = new PaperOperationalStatefulCliEngine(store);

    const steps: PaperOperationalE2EStep[] = [];
    const plan: readonly PaperOperationalE2EStepName[] = Object.freeze([
      'prepare',
      'status-after-prepare',
      'open-paper',
      'settle-win',
      'settle-loss',
      'settle-push',
      'snapshot',
      'recover',
      'finish',
      'status-after-finish',
    ]);

    for (let index = 0; index < plan.length; index += 1) {
      const stepName = plan[index];
      const command = this.commandForStep(stepName);
      const result = engine.execute({
        command,
        sessionId: input.sessionId,
        tradeId: `${input.tradeId}-${index}`,
        balance: input.balance,
        stake: input.stake,
        timestamp: input.startedAtEpochMs + index + 1,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      });

      steps.push(this.toStep(stepName, result));

      if (!result.ok) {
        break;
      }
    }

    const totalSteps = steps.length;
    const successfulSteps = steps.filter((step) => step.ok).length;
    const persistedSteps = steps.filter((step) => step.persisted).length;
    const hasLiveMoneyViolation = steps.some(
      (step) => step.productionMoneyAllowed !== false || step.liveMoneyAuthorization !== false,
    );

    if (hasLiveMoneyViolation) {
      return this.success(
        'NAO_UTILIZAR',
        'PAPER_OPERATIONAL_E2E_BLOCKED',
        input.sessionId,
        totalSteps,
        successfulSteps,
        persistedSteps,
        steps,
        'Harness PAPER bloqueado por violação de invariantes live money.',
      );
    }

    if (successfulSteps !== plan.length) {
      return this.success(
        'NAO_UTILIZAR',
        'PAPER_OPERATIONAL_E2E_BLOCKED',
        input.sessionId,
        totalSteps,
        successfulSteps,
        persistedSteps,
        steps,
        'Harness PAPER não completou todos os passos operacionais.',
      );
    }

    if (persistedSteps < 6) {
      return this.success(
        'AGUARDAR',
        'PAPER_OPERATIONAL_E2E_NEEDS_REVIEW',
        input.sessionId,
        totalSteps,
        successfulSteps,
        persistedSteps,
        steps,
        'Harness PAPER completou, mas persistiu menos etapas que o mínimo esperado.',
      );
    }

    return this.success(
      'PAPER_COMPATIVEL',
      'PAPER_OPERATIONAL_E2E_CERTIFIED',
      input.sessionId,
      totalSteps,
      successfulSteps,
      persistedSteps,
      steps,
      'Modo PAPER persistido certificado em cenário operacional ponta a ponta.',
    );
  }

  private commandForStep(step: PaperOperationalE2EStepName): PaperOperationalStatefulCommand {
    if (step === 'status-after-prepare' || step === 'status-after-finish') {
      return 'status';
    }

    return step;
  }

  private toStep(
    name: PaperOperationalE2EStepName,
    result: ReturnType<PaperOperationalStatefulCliEngine['execute']>,
  ): PaperOperationalE2EStep {
    if (!result.ok) {
      return Object.freeze({
        name,
        ok: false,
        persisted: false,
        reason: result.error.reason,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      });
    }

    const value: PaperOperationalStatefulResponse = result.value;

    return Object.freeze({
      name,
      ok: true,
      persisted: value.persisted,
      reason: value.reason,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });
  }

  private validateInput(input: PaperOperationalE2EHarnessInput): string | null {
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

    return null;
  }

  private success(
    finalDecision: PaperOperationalE2EFinalDecision,
    reason: PaperOperationalE2EReason,
    sessionId: string,
    totalSteps: number,
    successfulSteps: number,
    persistedSteps: number,
    steps: readonly PaperOperationalE2EStep[],
    explanation: string,
  ): PaperOperationalE2EResult {
    return {
      ok: true,
      value: {
        finalDecision,
        reason,
        sessionId,
        totalSteps,
        successfulSteps,
        persistedSteps,
        steps: Object.freeze([...steps]),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation,
      },
    };
  }

  private fail(reason: PaperOperationalE2EReason, message: string): PaperOperationalE2EResult {
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

  private isSafeToken(value: string, min: number, max: number): boolean {
    return typeof value === 'string' && value.length >= min && value.length <= max && /^[0-9A-Za-z._:-]+$/.test(value);
  }
}
