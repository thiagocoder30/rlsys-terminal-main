import {
  BankrollSafetyGateResult,
  BankrollSafetyVerdict,
} from '../risk';

export type OperatorGuidanceSeverity = 'INFO' | 'CAUTION' | 'STOP';

export interface OperatorGuidanceMessage {
  readonly severity: OperatorGuidanceSeverity;
  readonly title: string;
  readonly body: string;
  readonly recommendedAction: string;
}

/**
 * Converts technical bankroll safety verdicts into clear operator guidance.
 *
 * This class intentionally does not decide whether an entry is safe. It only
 * translates a risk verdict into calm, human-readable operational guidance.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class OperatorGuidanceMessageComposer {
  public compose(result: BankrollSafetyGateResult): OperatorGuidanceMessage {
    if (result.verdict === 'SAFE') {
      return this.safe(result);
    }

    if (result.verdict === 'REVIEW') {
      return this.review(result);
    }

    return this.blocked(result);
  }

  private safe(result: BankrollSafetyGateResult): OperatorGuidanceMessage {
    return {
      severity: 'INFO',
      title: 'Entrada saudável',
      body: `A entrada está compatível com sua banca. Orçamento de perda restante: R$ ${this.money(result.remainingLossBudget)}.`,
      recommendedAction: 'Operar apenas se o sinal também estiver favorável. Não aumentar a exposição.',
    };
  }

  private review(result: BankrollSafetyGateResult): OperatorGuidanceMessage {
    return {
      severity: 'CAUTION',
      title: 'Entrada exige cautela',
      body: `A entrada está acima da base recomendada. Lucro alvo restante: R$ ${this.money(result.remainingProfitTarget)}.`,
      recommendedAction: 'Reduzir a entrada ou aguardar uma oportunidade mais clara.',
    };
  }

  private blocked(result: BankrollSafetyGateResult): OperatorGuidanceMessage {
    const reason = result.reason.toLowerCase();

    if (reason.includes('stop loss')) {
      return {
        severity: 'STOP',
        title: 'Sessão em zona de perda',
        body: 'O limite de perda saudável foi atingido. Continuar agora aumenta o risco de decisões emocionais.',
        recommendedAction: 'Encerrar a sessão e preservar o restante da banca.',
      };
    }

    if (reason.includes('stop win')) {
      return {
        severity: 'STOP',
        title: 'Meta saudável atingida',
        body: 'Você já atingiu o lucro planejado para a sessão. Preservar lucro também é operação vencedora.',
        recommendedAction: 'Encerrar a sessão e registrar o resultado positivo.',
      };
    }

    if (reason.includes('martingale')) {
      return {
        severity: 'STOP',
        title: 'Progressão bloqueada',
        body: 'A progressão solicitada ultrapassa o limite seguro definido para sua banca.',
        recommendedAction: 'Não aumentar a mão. Voltar para observação ou encerrar a sessão.',
      };
    }

    if (reason.includes('exposição')) {
      return {
        severity: 'STOP',
        title: 'Exposição excessiva',
        body: 'A entrada colocaria uma parte grande demais da banca em risco.',
        recommendedAction: 'Reduzir a entrada para o limite sugerido ou aguardar.',
      };
    }

    return {
      severity: 'STOP',
      title: 'Entrada bloqueada',
      body: 'A operação não está saudável para o perfil atual da banca.',
      recommendedAction: 'Aguardar uma condição mais segura antes de operar.',
    };
  }

  private money(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }
}
