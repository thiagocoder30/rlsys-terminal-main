import type {
  PaperEntryLedgerRepositoryPort,
} from '../ledger/PaperEntryLedgerRepositoryPort.js';
import {
  FirstPaperSessionFinalPreflightOrchestrator,
  type FirstPaperSessionFinalPreflightInput,
  type FirstPaperSessionFinalPreflightVerdict,
} from './FirstPaperSessionFinalPreflightOrchestrator.js';

export type FirstPaperSessionManualExecutionProtocolStatus =
  | 'MANUAL_PROTOCOL_READY'
  | 'MANUAL_PROTOCOL_REVIEW'
  | 'MANUAL_PROTOCOL_BLOCKED';

export type FirstPaperSessionManualExecutionPhaseId =
  | 'OPEN_SESSION'
  | 'WARMUP_COLLECTION'
  | 'CONTEXT_QUALIFICATION'
  | 'SUGGESTION_MONITORING'
  | 'OPERATOR_CONFIRMATION'
  | 'PAPER_REGISTRATION'
  | 'SESSION_CLOSE'
  | 'AUDIT_EXPORT';

export interface FirstPaperSessionManualExecutionStep {
  readonly order: number;
  readonly title: string;
  readonly instruction: string;
  readonly mandatory: boolean;
  readonly systemExecutes: false;
}

export interface FirstPaperSessionManualExecutionPhase {
  readonly phaseId: FirstPaperSessionManualExecutionPhaseId;
  readonly title: string;
  readonly description: string;
  readonly mandatory: boolean;
  readonly steps: readonly FirstPaperSessionManualExecutionStep[];
}

export interface FirstPaperSessionManualExecutionProtocolReport {
  readonly status: FirstPaperSessionManualExecutionProtocolStatus;
  readonly generatedAtEpochMs: number;
  readonly sessionId: string;
  readonly preflightVerdict: FirstPaperSessionFinalPreflightVerdict;
  readonly phases: readonly FirstPaperSessionManualExecutionPhase[];
  readonly totalPhases: number;
  readonly totalSteps: number;
  readonly recommendation: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstPaperSessionManualExecutionProtocolTextReport {
  readonly status: FirstPaperSessionManualExecutionProtocolStatus;
  readonly generatedAtEpochMs: number;
  readonly text: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstPaperSessionManualExecutionProtocolSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface FirstPaperSessionManualExecutionProtocolFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'FIRST_PAPER_SESSION_MANUAL_EXECUTION_PROTOCOL_ERROR';
    readonly message: string;
  };
}

export type FirstPaperSessionManualExecutionProtocolResult<T> =
  | FirstPaperSessionManualExecutionProtocolSuccess<T>
  | FirstPaperSessionManualExecutionProtocolFailure;

/**
 * Manual execution protocol for the first supervised PAPER session.
 *
 * This protocol tells the human operator how to run the session from opening to
 * audit export. It does not execute bets, does not click external interfaces,
 * does not open casino/platform UIs and does not authorize live money.
 */
export class FirstPaperSessionManualExecutionProtocol {
  private readonly preflight: FirstPaperSessionFinalPreflightOrchestrator;

  public constructor(repository: PaperEntryLedgerRepositoryPort) {
    this.preflight = new FirstPaperSessionFinalPreflightOrchestrator(repository);
  }

  public async compose(
    input: FirstPaperSessionFinalPreflightInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstPaperSessionManualExecutionProtocolResult<FirstPaperSessionManualExecutionProtocolReport>> {
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';

    if (sessionId.length === 0) {
      return this.failure('sessionId is required');
    }

    const preflight = await this.preflight.evaluate(input, generatedAtEpochMs);

    if (!preflight.ok) {
      return this.failure(preflight.error.message);
    }

    const status = this.statusFor(preflight.value.verdict);
    const phases = this.createPhases(preflight.value.verdict, sessionId);
    const totalSteps = phases.reduce((sum, phase) => sum + phase.steps.length, 0);

    return {
      ok: true,
      value: Object.freeze({
        status,
        generatedAtEpochMs,
        sessionId,
        preflightVerdict: preflight.value.verdict,
        phases: Object.freeze(phases),
        totalPhases: phases.length,
        totalSteps,
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
    input: FirstPaperSessionFinalPreflightInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstPaperSessionManualExecutionProtocolResult<FirstPaperSessionManualExecutionProtocolTextReport>> {
    const composed = await this.compose(input, generatedAtEpochMs);

    if (!composed.ok) {
      return composed;
    }

    const lines = [
      'RL.SYS CORE — FIRST PAPER SESSION MANUAL EXECUTION PROTOCOL',
      '============================================================',
      `Generated At EpochMs: ${composed.value.generatedAtEpochMs}`,
      `SessionId: ${composed.value.sessionId}`,
      `Status: ${composed.value.status}`,
      `PreflightVerdict: ${composed.value.preflightVerdict}`,
      `Total Phases: ${composed.value.totalPhases}`,
      `Total Steps: ${composed.value.totalSteps}`,
      `Recommendation: ${composed.value.recommendation}`,
      '',
      'Protocol Phases:',
    ];

    for (const phase of composed.value.phases) {
      lines.push('');
      lines.push(`${phase.phaseId} — ${phase.title}`);
      lines.push(`Mandatory: ${phase.mandatory}`);
      lines.push(`Description: ${phase.description}`);

      for (const step of phase.steps) {
        lines.push(` ${step.order}. ${step.title}`);
        lines.push(`    Mandatory: ${step.mandatory}`);
        lines.push(`    SystemExecutes: ${step.systemExecutes}`);
        lines.push(`    Instruction: ${step.instruction}`);
      }
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
    verdict: FirstPaperSessionFinalPreflightVerdict,
  ): FirstPaperSessionManualExecutionProtocolStatus {
    if (verdict === 'PAPER_OPERATIONAL_GO') {
      return 'MANUAL_PROTOCOL_READY';
    }

    if (verdict === 'PAPER_OPERATIONAL_REVIEW') {
      return 'MANUAL_PROTOCOL_REVIEW';
    }

    return 'MANUAL_PROTOCOL_BLOCKED';
  }

  private createPhases(
    verdict: FirstPaperSessionFinalPreflightVerdict,
    sessionId: string,
  ): readonly FirstPaperSessionManualExecutionPhase[] {
    const blocked = verdict === 'PAPER_OPERATIONAL_BLOCKED';

    return Object.freeze([
      this.phase('OPEN_SESSION', 'Session Opening', 'Abrir a sessão PAPER apenas após preflight final.', [
        this.step(1, 'Confirmar verdict final', blocked
          ? 'Não iniciar sessão enquanto o verdict final estiver bloqueado.'
          : 'Confirmar que o preflight final permite execução PAPER supervisionada.'),
        this.step(2, 'Fixar SessionId', `Usar sessionId institucional: ${sessionId}.`),
        this.step(3, 'Confirmar modo PAPER', 'Garantir que a sessão é fictícia/PAPER, sem dinheiro real.'),
      ]),
      this.phase('WARMUP_COLLECTION', 'Warmup Collection', 'Coletar histórico manual antes de qualquer sugestão operacional.', [
        this.step(1, 'Coletar 100 ou 200 rodadas', 'Registrar o warmup conforme protocolo atual antes de aceitar qualquer recomendação.'),
        this.step(2, 'Descartar entrada com zero conforme estratégia', 'Quando aplicável à Triplicação, trios com zero devem ser anulados/descartados.'),
        this.step(3, 'Evitar decisão antes do warmup', 'Nenhuma entrada PAPER deve ser considerada antes da qualificação contextual.'),
      ]),
      this.phase('CONTEXT_QUALIFICATION', 'Context Qualification', 'Avaliar mesa, contexto, risco e inteligência institucional.', [
        this.step(1, 'Verificar momentum e volatilidade', 'Observar sinais contextuais sem assumir vantagem garantida.'),
        this.step(2, 'Verificar consenso institucional', 'Só prosseguir se os gates e o consenso não bloquearem.'),
        this.step(3, 'Verificar Triplicação e clusters', 'Usar a estratégia apenas como evidência contextual, nunca como autorização isolada.'),
      ]),
      this.phase('SUGGESTION_MONITORING', 'Suggestion Monitoring', 'Monitorar sugestões sem execução automática.', [
        this.step(1, 'Observar HUD', 'Aguardar recomendação institucional do HUD.'),
        this.step(2, 'Bloquear impulso operacional', 'Não antecipar entrada por intuição, tilt, pressa ou recuperação.'),
        this.step(3, 'Preservar cooldown', 'Respeitar cooldowns e bloqueios mesmo quando houver aparente oportunidade.'),
      ]),
      this.phase('OPERATOR_CONFIRMATION', 'Operator Confirmation', 'A decisão final é humana e supervisionada.', [
        this.step(1, 'Confirmar alinhamento', 'Mesa favorável + operador apto + risco controlado são obrigatórios.'),
        this.step(2, 'Confirmar stake PAPER', 'A stake autorizada deve ser fictícia e respeitar política de banca PAPER.'),
        this.step(3, 'Recusar quando houver dúvida', 'Em dúvida, o operador deve escolher AGUARDAR/RECUSAR.'),
      ]),
      this.phase('PAPER_REGISTRATION', 'Paper Registration', 'Registrar cada decisão e resultado em modo auditável.', [
        this.step(1, 'Registrar decisão', 'Registrar CONFIRMAR, RECUSAR ou AGUARDAR conforme fluxo do runtime.'),
        this.step(2, 'Registrar resultado', 'Registrar WIN, LOSS ou SKIP apenas como resultado PAPER.'),
        this.step(3, 'Preservar ledger', 'Não editar manualmente registros JSONL auditáveis.'),
      ]),
      this.phase('SESSION_CLOSE', 'Session Closing', 'Encerrar a sessão de forma explícita.', [
        this.step(1, 'Executar fechamento', 'Finalizar a sessão com comando de finish/encerramento quando disponível.'),
        this.step(2, 'Gerar snapshot', 'Garantir snapshot ou registro equivalente para recovery/auditoria.'),
        this.step(3, 'Não continuar após stop', 'Respeitar stop loss/stop win PAPER e bloqueios de sessão.'),
      ]),
      this.phase('AUDIT_EXPORT', 'Audit Export', 'Exportar relatório e evidências para revisão institucional.', [
        this.step(1, 'Consultar ledger', 'Usar CLI de ledger para revisar entradas e estatísticas.'),
        this.step(2, 'Exportar relatório', 'Gerar relatório textual/JSON da sessão PAPER.'),
        this.step(3, 'Registrar aprendizado', 'Usar os dados da sessão para certificação, não para prometer lucro.'),
      ]),
    ]);
  }

  private phase(
    phaseId: FirstPaperSessionManualExecutionPhaseId,
    title: string,
    description: string,
    steps: readonly FirstPaperSessionManualExecutionStep[],
  ): FirstPaperSessionManualExecutionPhase {
    return Object.freeze({
      phaseId,
      title,
      description,
      mandatory: true,
      steps: Object.freeze(steps),
    });
  }

  private step(order: number, title: string, instruction: string): FirstPaperSessionManualExecutionStep {
    return Object.freeze({
      order,
      title,
      instruction,
      mandatory: true,
      systemExecutes: false as const,
    });
  }

  private recommendationFor(status: FirstPaperSessionManualExecutionProtocolStatus): string {
    if (status === 'MANUAL_PROTOCOL_READY') {
      return 'Operator may execute the first supervised PAPER session by following this manual protocol.';
    }

    if (status === 'MANUAL_PROTOCOL_REVIEW') {
      return 'Operator must review warnings before executing the manual PAPER protocol.';
    }

    return 'Operator must not execute the PAPER session while final preflight is blocked.';
  }

  private failure(message: string): FirstPaperSessionManualExecutionProtocolFailure {
    return {
      ok: false,
      error: {
        code: 'FIRST_PAPER_SESSION_MANUAL_EXECUTION_PROTOCOL_ERROR',
        message,
      },
    };
  }
}
