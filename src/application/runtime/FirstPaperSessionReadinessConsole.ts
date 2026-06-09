import type { LocalizedDailyRiskLockPresenterReport } from './LocalizedDailyRiskLockPresenter';
import type { BankrollSafetyGateResult } from '../../domain/risk/BankrollSafetyGate';
import type { PaperCertificationJsonExport } from './PaperCertificationReportExporter';

export interface FirstPaperSessionReadinessConsoleInput {
  readonly presentationId: string;
  readonly generatedAtEpochMs: number;
  readonly bankrollGate: BankrollSafetyGateResult;
  readonly dailyRiskLock: LocalizedDailyRiskLockPresenterReport;
  readonly paperCertification: PaperCertificationJsonExport;
}

export interface FirstPaperSessionReadinessConsoleReport {
  readonly presentationId: string;
  readonly generatedAtEpochMs: number;
  readonly ready: boolean;
  readonly messages: string[];
  readonly summaryText: string;
}

export class FirstPaperSessionReadinessConsole {
  public generate(input: FirstPaperSessionReadinessConsoleInput): FirstPaperSessionReadinessConsoleReport {
    const messages: string[] = [];

    if (input.bankrollGate.verdict === 'BLOCKED') {
      messages.push(`Banca: bloqueada — ${input.bankrollGate.reason}`);
    } else {
      messages.push(`Banca: liberada — permitido operar até R$ ${input.bankrollGate.allowedStake}`);
    }

    switch(input.dailyRiskLock.status) {
      case 'PRESENTATION_BLOCKED':
        messages.push(`Trava diária: bloqueada — ${input.dailyRiskLock.reasonLabel}`);
        break;
      case 'PRESENTATION_INFORMATIONAL_LOCK':
        messages.push(`Trava diária: informativa — ${input.dailyRiskLock.reasonLabel}`);
        break;
      default:
        messages.push('Trava diária: liberada');
    }

    switch(input.paperCertification.status) {
      case 'PAPER_CERTIFIED':
        messages.push('Certificação PAPER: OK');
        break;
      case 'PAPER_REVIEW':
        messages.push('Certificação PAPER: Revisão necessária');
        break;
      case 'PAPER_BLOCKED':
        messages.push('Certificação PAPER: Bloqueada');
        break;
    }

    const summaryText = `RL.SYS CORE — STATUS DA SESSÃO PAPER\n` +
                        `=====================================\n` +
                        messages.map(msg => `• ${msg}`).join('\n') +
                        `\n=====================================\n` +
                        `Decisão final do operador: obrigatória\n` +
                        `Recomendação supervisionada: sim\n` +
                        `Modo institucional PAPER: sim`;

    return {
      presentationId: input.presentationId,
      generatedAtEpochMs: input.generatedAtEpochMs,
      ready: messages.every(m => !m.includes('bloqueada') && !m.includes('Bloqueada')),
      messages,
      summaryText,
    };
  }
}
