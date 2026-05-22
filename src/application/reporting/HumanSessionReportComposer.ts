import { OperatorRiskProfile } from '../../domain/risk';
import { PaperLedgerRuntimeState } from '../ledger';

export type HumanSessionReportVerdict =
  | 'SESSION_HEALTHY'
  | 'SESSION_PROFIT_PROTECTED'
  | 'SESSION_RISK_REVIEW'
  | 'SESSION_STOP_LOSS';

export interface HumanSessionReportInput {
  readonly profile: OperatorRiskProfile;
  readonly ledger: PaperLedgerRuntimeState;
  readonly blockedEntries: number;
  readonly reviewEntries: number;
  readonly cooldownBlocks: number;
}

export interface HumanSessionReport {
  readonly verdict: HumanSessionReportVerdict;
  readonly title: string;
  readonly summary: string;
  readonly recommendedAction: string;
  readonly markdown: string;
}

/**
 * Builds a human-readable report focused on operator discipline.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class HumanSessionReportComposer {
  public compose(input: HumanSessionReportInput): HumanSessionReport {
    this.assertInput(input);

    const verdict = this.verdict(input);
    const title = this.title(verdict);
    const summary = this.summary(verdict);
    const recommendedAction = this.recommendedAction(verdict);

    return {
      verdict,
      title,
      summary,
      recommendedAction,
      markdown: this.markdown(input, verdict, title, summary, recommendedAction),
    };
  }

  private verdict(input: HumanSessionReportInput): HumanSessionReportVerdict {
    if (input.ledger.sessionPnl <= -input.profile.dailyStopLoss) {
      return 'SESSION_STOP_LOSS';
    }

    if (input.ledger.sessionPnl >= input.profile.dailyStopWin) {
      return 'SESSION_PROFIT_PROTECTED';
    }

    if (
      input.blockedEntries > 0 ||
      input.cooldownBlocks > 0 ||
      input.reviewEntries >= 3 ||
      input.ledger.drawdown >= input.profile.dailyStopLoss * 0.7
    ) {
      return 'SESSION_RISK_REVIEW';
    }

    return 'SESSION_HEALTHY';
  }

  private title(verdict: HumanSessionReportVerdict): string {
    if (verdict === 'SESSION_PROFIT_PROTECTED') {
      return 'Sessão positiva — lucro deve ser preservado';
    }

    if (verdict === 'SESSION_STOP_LOSS') {
      return 'Sessão encerrada por proteção de banca';
    }

    if (verdict === 'SESSION_RISK_REVIEW') {
      return 'Sessão exige revisão de disciplina';
    }

    return 'Sessão saudável';
  }

  private summary(verdict: HumanSessionReportVerdict): string {
    if (verdict === 'SESSION_PROFIT_PROTECTED') {
      return 'A meta de lucro foi atingida. Encerrar agora preserva o resultado positivo.';
    }

    if (verdict === 'SESSION_STOP_LOSS') {
      return 'O limite de perda foi atingido. Continuar aumenta o risco emocional.';
    }

    if (verdict === 'SESSION_RISK_REVIEW') {
      return 'A sessão apresentou bloqueios, revisões ou sinais de risco operacional.';
    }

    return 'A sessão permaneceu dentro dos limites saudáveis de banca e disciplina.';
  }

  private recommendedAction(verdict: HumanSessionReportVerdict): string {
    if (verdict === 'SESSION_PROFIT_PROTECTED') {
      return 'Encerrar a sessão e registrar o lucro.';
    }

    if (verdict === 'SESSION_STOP_LOSS') {
      return 'Encerrar imediatamente e evitar recuperação no impulso.';
    }

    if (verdict === 'SESSION_RISK_REVIEW') {
      return 'Pausar, revisar entradas e reduzir frequência operacional.';
    }

    return 'Manter o padrão conservador na próxima sessão.';
  }

  private markdown(
    input: HumanSessionReportInput,
    verdict: HumanSessionReportVerdict,
    title: string,
    summary: string,
    recommendedAction: string,
  ): string {
    return [
      '# RL.SYS — Relatório Humano de Sessão',
      '',
      `## ${title}`,
      '',
      `**Veredito:** ${verdict}`,
      '',
      `**Resumo:** ${summary}`,
      '',
      '## Banca',
      '',
      `- Banca inicial: R$ ${this.money(input.ledger.initialBalance)}`,
      `- Saldo final: R$ ${this.money(input.ledger.currentBalance)}`,
      `- PNL da sessão: R$ ${this.money(input.ledger.sessionPnl)}`,
      `- Drawdown: R$ ${this.money(input.ledger.drawdown)}`,
      '',
      '## Limites saudáveis',
      '',
      `- Entrada base: R$ ${this.money(input.profile.baseStake)}`,
      `- Stop win: R$ ${this.money(input.profile.dailyStopWin)}`,
      `- Stop loss: R$ ${this.money(input.profile.dailyStopLoss)}`,
      `- Exposição máxima: R$ ${this.money(input.profile.maxSingleExposure)}`,
      `- Martingale máximo: ${input.profile.maxMartingaleSteps}`,
      '',
      '## Disciplina operacional',
      '',
      `- Vitórias registradas: ${input.ledger.wins}`,
      `- Perdas registradas: ${input.ledger.losses}`,
      `- Entradas bloqueadas: ${input.blockedEntries}`,
      `- Entradas em revisão: ${input.reviewEntries}`,
      `- Bloqueios por cooldown: ${input.cooldownBlocks}`,
      '',
      '## Ação recomendada',
      '',
      recommendedAction,
      '',
    ].join('\n');
  }

  private assertInput(input: HumanSessionReportInput): void {
    if (!Number.isInteger(input.blockedEntries) || input.blockedEntries < 0) {
      throw new Error('blockedEntries must be a non-negative integer');
    }

    if (!Number.isInteger(input.reviewEntries) || input.reviewEntries < 0) {
      throw new Error('reviewEntries must be a non-negative integer');
    }

    if (!Number.isInteger(input.cooldownBlocks) || input.cooldownBlocks < 0) {
      throw new Error('cooldownBlocks must be a non-negative integer');
    }
  }

  private money(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }
}
