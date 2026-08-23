import type {
  FusionReducedLiveStatsSnapshot,
} from './FusionReducedLiveStatsDiagnostics.js';


export class FusionReducedLiveStatsPresenter {
  public compact(
    snapshot:
      FusionReducedLiveStatsSnapshot,
  ): string {
    const lines = [
      '========================================',
      ' RL.SYS — FUSION REDUZIDA / ESTATÍSTICAS',
      '========================================',
      '',
      ' LIVE',
      '----------------------------------------',
      ` Giros observados ....... ${snapshot.liveSpinCount}`,
      ` BLOCKED ................ ${snapshot.blockedCount} (${this.percent(snapshot.blockedPercent)})`,
      ` OBSERVE ................ ${snapshot.observeCount} (${this.percent(snapshot.observePercent)})`,
      ` PAPER_READY ............ ${snapshot.paperReadyCount} (${this.percent(snapshot.paperReadyPercent)})`,
      '',
      ' DOUTRINA',
      '----------------------------------------',
      ` Centro .................. ${snapshot.targetCenter}`,
      ` Tamanho do alvo ........ ${snapshot.targetSize}`,
      ` Cobertura nominal ...... ${this.percent(snapshot.coveragePercent)}`,
      ' Alvo .................... 23 ± 9',
      '',
      ' EVIDÊNCIA MÉDIA',
      '----------------------------------------',
      ` Confiança .............. ${this.ratePercent(snapshot.averageConfidenceScore)}`,
      ` Risco .................. ${this.ratePercent(snapshot.averageRiskScore)}`,
      ` Hit rate global obs. ... ${this.ratePercent(snapshot.averageObservedHitRate)}`,
      ` Hit rate recente obs. .. ${this.ratePercent(snapshot.averageRecentHitRate)}`,
      ` Rate drift ............. ${this.ratePercent(snapshot.averageRateDrift)}`,
      '',
      ' SETTLEMENT CONTRAFACTUAL',
      '----------------------------------------',
      ` Hipóteses criadas ...... ${snapshot.counterfactualDecisionCount}`,
      ` Liquidadas ............. ${snapshot.counterfactualSettledCount}`,
      ` Pendentes .............. ${snapshot.counterfactualPendingCount}`,
      ` WIN ..................... ${snapshot.counterfactualWinCount}`,
      ` LOSS .................... ${snapshot.counterfactualLossCount}`,
      ` Hit rate ................ ${this.optionalPercent(snapshot.counterfactualHitRate)}`,
      ` Maior sequência LOSS ... ${snapshot.counterfactualMaxLossStreak}`,
      '',
      ' BLOCKERS MAIS FREQUENTES',
      '----------------------------------------',
    ];

    if (
      snapshot.blockerFrequency.length ===
      0
    ) {
      lines.push(
        ' Nenhum blocker registrado.',
      );
    } else {
      for (
        const item of
        snapshot.blockerFrequency.slice(
          0,
          5,
        )
      ) {
        lines.push(
          ` ${item.blocker} = ${item.count}`,
        );
      }
    }

    lines.push(
      '',
      ' Estratégia ............. FUSION REDUZIDA',
      ' Natureza ............... SOMENTE CONTRAFACTUAL',
      ' Banca .................. NÃO ALTERADA',
      ' Execução automática ... NÃO',
      '',
      ' A taxa de acerto deve ser comparada à cobertura nominal de 19/37.',
      ' Os thresholds empíricos não são promovidos por este comando.',
      '========================================',
    );

    return lines.join(
      '\n',
    );
  }


  public detail(
    snapshot:
      FusionReducedLiveStatsSnapshot,
  ): string {
    const lines = [
      this.compact(
        snapshot,
      ),
      '',
      '========================================',
      ' RL.SYS — FUSION REDUZIDA / DETALHES',
      '========================================',
      '',
      ' JANELA DETALHADA',
      '----------------------------------------',
      ` Eventos exibidos ....... ${snapshot.latestEvents.length}`,
    ];

    if (
      snapshot.latestEvents.length >
      0
    ) {
      lines.push(
        ` LIVE inicial ........... ${snapshot.latestEvents[0].liveSpinIndex}`,
        ` LIVE final ............. ${snapshot.latestEvents[snapshot.latestEvents.length - 1].liveSpinIndex}`,
      );
    }

    lines.push(
      '',
      ' EVENTOS LIVE — ORDEM TEMPORAL',
      '----------------------------------------',
    );

    if (
      snapshot.latestEvents.length ===
      0
    ) {
      lines.push(
        ' Nenhum evento LIVE registrado.',
      );
    } else {
      for (
        const event of
        snapshot.latestEvents
      ) {
        lines.push(
          ` LIVE ${event.liveSpinIndex}`,
          ` Giro recebido ........ ${event.spin}`,
          ` Decisão .............. ${event.decisionStatus}`,
          ` Elegível .............. ${event.eligible ? 'SIM' : 'NÃO'}`,
          ` Confiança ............. ${this.ratePercent(event.confidenceScore)}`,
          ` Risco ................. ${this.ratePercent(event.riskScore)}`,
          ` Hit global ............ ${this.ratePercent(event.observedHitRate)}`,
          ` Hit recente ........... ${this.ratePercent(event.recentHitRate)}`,
          ` Drift ................. ${this.ratePercent(event.rateDrift)}`,
          ` Amostra ............... ${event.sampleSize}`,
          ` Janela recente ........ ${event.recentSampleSize}`,
          ` Tamanho alvo .......... ${event.targetSize}`,
          ` Cobertura ............. ${this.percent(event.coveragePercent)}`,
          ` Hipótese criada ....... ${event.hypothesisCreated ? 'SIM' : 'NÃO'}`,
          ` Settlement ............ ${event.settlementOutcome ?? '-'}`,
          ` Giro liquidador ....... ${event.settlementSpin ?? '-'}`,
        );

        if (
          event.blockers.length >
          0
        ) {
          lines.push(
            ` Blockers .............. ${event.blockers.join(', ')}`,
          );
        }

        if (
          event.warnings.length >
          0
        ) {
          lines.push(
            ` Warnings .............. ${event.warnings.join(', ')}`,
          );
        }

        lines.push(
          '',
        );
      }
    }

    lines.push(
      ' Estratégia ............. FUSION REDUZIDA',
      ' Alvo ................... 23 ± 9 / 19 NÚMEROS',
      ' Settlement ............. CONTRAFACTUAL',
      ' Banca .................. NÃO ALTERADA',
      ' Execução automática ... NÃO',
      '========================================',
    );

    return lines.join(
      '\n',
    );
  }


  private percent(
    value:
      number,
  ): string {
    return `${value
      .toFixed(2)
      .replace('.', ',')}%`;
  }


  private ratePercent(
    value:
      number,
  ): string {
    return this.percent(
      value *
      100,
    );
  }


  private optionalPercent(
    value:
      number | null,
  ): string {
    if (
      value ===
      null
    ) {
      return '-';
    }

    return this.percent(
      value,
    );
  }
}
