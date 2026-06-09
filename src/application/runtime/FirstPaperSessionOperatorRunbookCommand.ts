import type {
  PaperEntryLedgerRepositoryPort,
} from '../ledger/PaperEntryLedgerRepositoryPort.js';
import {
  FirstSupervisedPaperTradingSessionRecorder,
  type FirstSupervisedPaperTradingSessionRecorderInput,
  type FirstSupervisedPaperTradingSessionRecordStatus,
} from './FirstSupervisedPaperTradingSessionRecorder.js';

export type FirstPaperSessionOperatorRunbookStatus =
  | 'RUNBOOK_READY'
  | 'RUNBOOK_NEEDS_REVIEW'
  | 'RUNBOOK_BLOCKED';

export interface FirstPaperSessionOperatorRunbookStep {
  readonly order: number;
  readonly title: string;
  readonly instruction: string;
  readonly required: boolean;
  readonly completedBySystem: boolean;
}

export interface FirstPaperSessionOperatorRunbookReport {
  readonly status: FirstPaperSessionOperatorRunbookStatus;
  readonly generatedAtEpochMs: number;
  readonly sessionId: string;
  readonly recorderStatus: FirstSupervisedPaperTradingSessionRecordStatus;
  readonly steps: readonly FirstPaperSessionOperatorRunbookStep[];
  readonly operatorCommandPreview: string;
  readonly recommendation: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstPaperSessionOperatorRunbookTextReport {
  readonly status: FirstPaperSessionOperatorRunbookStatus;
  readonly generatedAtEpochMs: number;
  readonly text: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstPaperSessionOperatorRunbookSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface FirstPaperSessionOperatorRunbookFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'FIRST_PAPER_SESSION_OPERATOR_RUNBOOK_COMMAND_ERROR';
    readonly message: string;
  };
}

export type FirstPaperSessionOperatorRunbookResult<T> =
  | FirstPaperSessionOperatorRunbookSuccess<T>
  | FirstPaperSessionOperatorRunbookFailure;

/**
 * Operator runbook for launching the first supervised PAPER session.
 *
 * This command only produces procedural guidance. It does not execute bets,
 * does not open external platforms, does not automate UI clicks and does not
 * authorize live money.
 */
export class FirstPaperSessionOperatorRunbookCommand {
  private readonly recorder: FirstSupervisedPaperTradingSessionRecorder;

  public constructor(repository: PaperEntryLedgerRepositoryPort) {
    this.recorder = new FirstSupervisedPaperTradingSessionRecorder(repository);
  }

  public async compose(
    input: FirstSupervisedPaperTradingSessionRecorderInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstPaperSessionOperatorRunbookResult<FirstPaperSessionOperatorRunbookReport>> {
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';

    if (sessionId.length === 0) {
      return this.failure('sessionId is required');
    }

    const recorded = await this.recorder.record(input, generatedAtEpochMs);

    if (!recorded.ok) {
      return this.failure(recorded.error.message);
    }

    const status = this.statusFor(recorded.value.record.status);
    const steps = this.stepsFor(recorded.value.record.status, sessionId);
    const operatorCommandPreview = [
      'node scripts/first-supervised-paper-trading-session-recorder.js',
      `--sessionId ${sessionId}`,
      '--operatorConfirmedLaunch true',
      `--operatorId ${recorded.value.record.operatorId}`,
      `--tableId ${recorded.value.record.tableId}`,
      `--strategyName ${recorded.value.record.strategyName}`,
      `--bankrollLabel ${recorded.value.record.bankrollLabel}`,
      `--plannedRounds ${recorded.value.record.plannedRounds}`,
      '--format text',
    ].join(' ');

    return {
      ok: true,
      value: Object.freeze({
        status,
        generatedAtEpochMs,
        sessionId,
        recorderStatus: recorded.value.record.status,
        steps: Object.freeze(steps),
        operatorCommandPreview,
        recommendation: this.recommendationFor(status),
        paperOnly: true as const,
        liveMoneyAuthorization: false as const,
        automaticExecutionAllowed: false as const,
        automaticBetExecutionAllowed: false as const,
        humanSupervisionRequired: true as const,
      }),
    };
  }

  public async textReport(
    input: FirstSupervisedPaperTradingSessionRecorderInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstPaperSessionOperatorRunbookResult<FirstPaperSessionOperatorRunbookTextReport>> {
    const composed = await this.compose(input, generatedAtEpochMs);

    if (!composed.ok) {
      return composed;
    }

    const lines = [
      'RL.SYS CORE — FIRST PAPER SESSION OPERATOR RUNBOOK',
      '==================================================',
      `Generated At EpochMs: ${composed.value.generatedAtEpochMs}`,
      `SessionId: ${composed.value.sessionId}`,
      `Status: ${composed.value.status}`,
      `RecorderStatus: ${composed.value.recorderStatus}`,
      `Recommendation: ${composed.value.recommendation}`,
      '',
      'Operator Command Preview:',
      composed.value.operatorCommandPreview,
      '',
      'Runbook Steps:',
    ];

    for (const step of composed.value.steps) {
      lines.push(`${step.order}. ${step.title}`);
      lines.push(`   Required: ${step.required}`);
      lines.push(`   CompletedBySystem: ${step.completedBySystem}`);
      lines.push(`   Instruction: ${step.instruction}`);
    }

    lines.push('');
    lines.push('Governance:');
    lines.push('PaperOnly: true');
    lines.push('LiveMoneyAuthorization: false');
    lines.push('AutomaticExecutionAllowed: false');
    lines.push('AutomaticBetExecutionAllowed: false');
    lines.push('HumanSupervisionRequired: true');

    return {
      ok: true,
      value: Object.freeze({
        status: composed.value.status,
        generatedAtEpochMs,
        text: `${lines.join('\n')}\n`,
        paperOnly: true as const,
        liveMoneyAuthorization: false as const,
        automaticExecutionAllowed: false as const,
        automaticBetExecutionAllowed: false as const,
        humanSupervisionRequired: true as const,
      }),
    };
  }

  private statusFor(
    recorderStatus: FirstSupervisedPaperTradingSessionRecordStatus,
  ): FirstPaperSessionOperatorRunbookStatus {
    if (recorderStatus === 'FIRST_PAPER_SESSION_RECORDED') {
      return 'RUNBOOK_READY';
    }

    if (recorderStatus === 'FIRST_PAPER_SESSION_RECORDED_WITH_REVIEW') {
      return 'RUNBOOK_NEEDS_REVIEW';
    }

    return 'RUNBOOK_BLOCKED';
  }

  private stepsFor(
    recorderStatus: FirstSupervisedPaperTradingSessionRecordStatus,
    sessionId: string,
  ): readonly FirstPaperSessionOperatorRunbookStep[] {
    const blocked = recorderStatus === 'FIRST_PAPER_SESSION_NOT_RECORDED_BLOCKED';

    return Object.freeze([
      {
        order: 1,
        title: 'Confirmar modo PAPER',
        instruction: 'Verifique que a sessão será PAPER, sem dinheiro real e sem execução automática.',
        required: true,
        completedBySystem: true,
      },
      {
        order: 2,
        title: 'Confirmar SessionId',
        instruction: `Use o sessionId institucional: ${sessionId}.`,
        required: true,
        completedBySystem: true,
      },
      {
        order: 3,
        title: 'Revisar launch checklist',
        instruction: blocked
          ? 'Checklist bloqueou a abertura. Corrija os bloqueios antes de continuar.'
          : 'Checklist liberou ou marcou revisão controlada para abertura PAPER.',
        required: true,
        completedBySystem: true,
      },
      {
        order: 4,
        title: 'Registrar abertura auditável',
        instruction: blocked
          ? 'Não registre abertura da sessão enquanto o estado estiver bloqueado.'
          : 'Registrar a abertura da sessão usando o recorder JSONL antes do primeiro spin.',
        required: true,
        completedBySystem: !blocked,
      },
      {
        order: 5,
        title: 'Executar warmup manual',
        instruction: 'Coletar warmup manual conforme protocolo atual antes de aceitar qualquer sugestão.',
        required: true,
        completedBySystem: false,
      },
      {
        order: 6,
        title: 'Operar apenas sugestões supervisionadas',
        instruction: 'Somente considerar entrada PAPER quando HUD, operador e gates institucionais estiverem alinhados.',
        required: true,
        completedBySystem: false,
      },
      {
        order: 7,
        title: 'Encerrar com relatório',
        instruction: 'Ao finalizar, gerar relatório e consultar ledger para auditoria da sessão.',
        required: true,
        completedBySystem: false,
      },
    ]);
  }

  private recommendationFor(status: FirstPaperSessionOperatorRunbookStatus): string {
    if (status === 'RUNBOOK_READY') {
      return 'Operator may follow this runbook to start the first supervised PAPER session.';
    }

    if (status === 'RUNBOOK_NEEDS_REVIEW') {
      return 'Operator must review warnings before following the PAPER session runbook.';
    }

    return 'Operator must not start the PAPER session while the runbook is blocked.';
  }

  private failure(message: string): FirstPaperSessionOperatorRunbookFailure {
    return {
      ok: false,
      error: {
        code: 'FIRST_PAPER_SESSION_OPERATOR_RUNBOOK_COMMAND_ERROR',
        message,
      },
    };
  }
}
