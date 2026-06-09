import type { BankrollSafetyGateResult } from '../../domain/risk/BankrollSafetyGate';
import type { LocalizedDailyRiskLockPresenterReport } from './LocalizedDailyRiskLockPresenter';
import type { PaperCertificationJsonExport } from './PaperCertificationReportExporter';

export interface OperatorHudMinimalistAdapterInput {
  readonly presentationId: string;
  readonly generatedAtEpochMs: number;
  readonly bankrollGate: BankrollSafetyGateResult;
  readonly dailyRiskLock: LocalizedDailyRiskLockPresenterReport;
  readonly triplicacaoStatus: {
    trigger: 'FAVORABLE' | 'NOT_FAVORABLE';
    confidence: number;
  };
  readonly paperCertification: PaperCertificationJsonExport;
  readonly suggestedStake: number;
}

export class OperatorHudMinimalistAdapter {
  public render(input: OperatorHudMinimalistAdapterInput): string {
    const lines: string[] = [];
    lines.push('╔════════════════════════════════════╗');
    lines.push('║       RL.SYS CORE — PAPER HUD      ║');
    lines.push('╠════════════════════════════════════╣');
    lines.push(`║ Sessão ID: ${input.presentationId} ║`);
    lines.push(`║ Hora: ${new Date(input.generatedAtEpochMs).toLocaleTimeString()} ║`);
    lines.push('╠════════════════════════════════════╣');

    // Bankroll
    if (input.bankrollGate.verdict === 'BLOCKED') {
      lines.push(`║ 💰 Banca: BLOQUEADA — ${input.bankrollGate.reason}`);
    } else {
      lines.push(`║ 💰 Banca: SAFE — Limite restante R$ ${input.bankrollGate.allowedStake}`);
    }

    // Daily Risk Lock
    switch(input.dailyRiskLock.status) {
      case 'PRESENTATION_BLOCKED':
        lines.push(`║ 🔹 Trava diária: BLOQUEADA — ${input.dailyRiskLock.reasonLabel}`);
        break;
      case 'PRESENTATION_INFORMATIONAL_LOCK':
        lines.push(`║ 🔹 Trava diária: informativa — ${input.dailyRiskLock.reasonLabel}`);
        break;
      default:
        lines.push(`║ 🔹 Trava diária: liberada`);
    }

    // Triplicação
    lines.push(`╠════════════════════════════════════╣`);
    lines.push(`║ 🔹 Estratégia Triplicação           ║`);
    lines.push(`║ • Status: ${input.triplicacaoStatus.trigger}`);
    lines.push(`║ • Confiança: ${input.triplicacaoStatus.confidence}%`);

    // Paper Certification
    lines.push(`╠════════════════════════════════════╣`);
    lines.push(`║ 📄 PAPER Certification: ${input.paperCertification.status}`);

    // Recommendation
    const entryAllowed = input.bankrollGate.verdict !== 'BLOCKED' &&
                         input.dailyRiskLock.status !== 'PRESENTATION_BLOCKED' &&
                         input.triplicacaoStatus.trigger === 'FAVORABLE' &&
                         input.paperCertification.status === 'PAPER_CERTIFIED';

    lines.push(`╠════════════════════════════════════╣`);
    lines.push(`║ 📝 Recomendação: ${entryAllowed ? 'ENTRAR ✅' : 'AGUARDAR ❌'}`);
    lines.push(`║ • Stake sugerido: R$ ${input.suggestedStake}`);

    lines.push('╚════════════════════════════════════╝');
    return lines.join('\n');
  }
}
