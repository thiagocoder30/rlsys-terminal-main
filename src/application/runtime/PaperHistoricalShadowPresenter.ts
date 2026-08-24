import type {
  HistoricalShadowReplaySnapshot,
} from './HistoricalShadowReplayEngine.js';

import type {
  PaperHistoricalShadowSessionSnapshot,
} from './PaperHistoricalShadowSessionEngine.js';


export class PaperHistoricalShadowPresenter {
  public render(
    snapshot:
      PaperHistoricalShadowSessionSnapshot,
  ): string {
    const lines = [
      '',
      '======================================================',
      ' RL.SYS — SHADOW HISTÓRICO DO SYNC',
      '======================================================',
      '',
      ` Histórico ............. ${snapshot.totalSpins} giros`,
      ` Banca inicial ......... ${this.money(snapshot.initialBankroll)}`,
      ` Provedor ............... ${snapshot.provider}`,
      ` Perfil ................. ${snapshot.riskMode.toUpperCase()}`,
      ` Ficha mínima ........... ${this.money(snapshot.minimumChipValue)}`,
      ` Recovery Triplicação ... ${snapshot.martingaleEnabled ? 'HABILITADO' : 'DESABILITADO'}`,
      '',
      '------------------------------------------------------',
      ' TRIPLICAÇÃO',
      '------------------------------------------------------',
      ...this.strategyLines(
        snapshot.triplicacao,
      ),
      '',
      '------------------------------------------------------',
      ' FUSION REDUZIDA',
      '------------------------------------------------------',
      ...this.strategyLines(
        snapshot.fusionReduced,
      ),
      '',
      '------------------------------------------------------',
      ' HEATMAP DYNAMIC',
      '------------------------------------------------------',
      ...this.strategyLines(
        snapshot.heatmapDynamic,
      ),
      '',
      '------------------------------------------------------',
      ' GOVERNANÇA SHADOW',
      '------------------------------------------------------',
      ' Natureza ............... RETROSPECTIVA',
      ` Look-ahead .............. ${snapshot.lookAheadAllowed ? 'PERMITIDO' : 'BLOQUEADO'}`,
      ` Banca real alterada ..... ${snapshot.realBankrollChanged ? 'SIM' : 'NÃO'}`,
      ` Execução automática ..... ${snapshot.automaticExecution ? 'SIM' : 'NÃO'}`,
      ` Execução humana ......... ${snapshot.humanExecutionRequired ? 'OBRIGATÓRIA' : 'NÃO'}`,
      '',
      ' O Shadow mede o que teria acontecido',
      ' exclusivamente dentro do histórico do Sync.',
      '',
      ' Ele NÃO autoriza entrada prospectiva.',
      ' Ele NÃO altera a banca real.',
      ' Ele NÃO executa apostas.',
      '======================================================',
      '',
    ];

    return lines.join(
      '\n',
    );
  }


  private strategyLines(
    snapshot:
      HistoricalShadowReplaySnapshot,
  ): string[] {
    return [
      ` Warm-up ................ ${snapshot.warmupSpins} giros`,
      ` Pontos avaliados ....... ${snapshot.evaluatedDecisionPointCount}`,
      ` Sem sinal .............. ${snapshot.noSignalDecisionPointCount}`,
      ` Bloqueios financeiros .. ${snapshot.financiallyBlockedDecisionCount}`,
      ` Bloqueios de capital ... ${snapshot.capitalBlockedDecisionPointCount}`,
      '',
      ` Trades ................. ${snapshot.tradeCount}`,
      ` WIN / LOSS / VOID ...... ${snapshot.winCount} / ${snapshot.lossCount} / ${snapshot.voidCount}`,
      ` Hit rate ............... ${this.percentOrNA(
        snapshot.hitRate ===
          null
          ? null
          : snapshot.hitRate *
            100,
      )}`,
      '',
      ` Total apostado ......... ${this.money(snapshot.totalStake)}`,
      ` Retorno bruto .......... ${this.money(snapshot.grossReturn)}`,
      ` P&L .................... ${this.signedMoney(snapshot.totalPnl)}`,
      ` ROI .................... ${this.percentOrNA(snapshot.roiPercent)}`,
      ` Retorno da banca ....... ${this.percent(snapshot.bankrollReturnPercent)}`,
      '',
      ` Banca final ............ ${this.money(snapshot.currentBankroll)}`,
      ` Pico da banca .......... ${this.money(snapshot.peakBankroll)}`,
      ` Drawdown máximo ........ ${this.money(snapshot.maxDrawdownAmount)}`,
      ` Drawdown máximo % ...... ${this.percent(snapshot.maxDrawdownPercent)}`,
      ` Maior sequência LOSS ... ${snapshot.maxLossStreak}`,
      '',
      ` Capital ................ ${snapshot.capitalDecision}`,
      ` Capital STOP ........... ${snapshot.capitalStop ? 'SIM' : 'NÃO'}`,
      ` Motivo STOP ............ ${snapshot.capitalStopReason ?? 'N/A'}`,
    ];
  }


  private money(
    value:
      number,
  ): string {
    return `R$ ${value
      .toFixed(
        2,
      )
      .replace(
        '.',
        ',',
      )}`;
  }


  private signedMoney(
    value:
      number,
  ): string {
    if (
      value >
      0
    ) {
      return `+${this.money(
        value,
      )}`;
    }

    return this.money(
      value,
    );
  }


  private percent(
    value:
      number,
  ): string {
    return `${value
      .toFixed(
        2,
      )
      .replace(
        '.',
        ',',
      )}%`;
  }


  private percentOrNA(
    value:
      number | null,
  ): string {
    return value ===
      null
      ? 'N/A'
      : this.percent(
          value,
        );
  }
}
