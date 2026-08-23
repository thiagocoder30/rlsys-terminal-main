import type {
  HeatmapDynamicLiveStatsSnapshot,
} from './HeatmapDynamicLiveStatsDiagnostics.js';


export class HeatmapDynamicLiveStatsPresenter {
  public compact(
    snapshot:
      HeatmapDynamicLiveStatsSnapshot,
  ): string {
    const lines = [
      '========================================',
      ' RL.SYS — HEATMAP DYNAMIC / ESTATÍSTICAS',
      '========================================',
      '',
      ' LIVE',
      '----------------------------------------',
      ` Giros observados ....... ${snapshot.liveSpinCount}`,
      ` BLOCKED ................ ${snapshot.blockedCount} (${this.percent(snapshot.blockedPercent)})`,
      ` OBSERVE ................ ${snapshot.observeCount} (${this.percent(snapshot.observePercent)})`,
      ` PAPER_READY ............ ${snapshot.paperReadyCount} (${this.percent(snapshot.paperReadyPercent)})`,
      '',
      ' MÉTRICAS MÉDIAS',
      '----------------------------------------',
      ` Pressão dinâmica ....... ${this.percent(snapshot.averageFusionPressureScore)}`,
      ` Pressão recente ........ ${this.percent(snapshot.averageRecencyPressureScore)}`,
      ` Dispersão .............. ${this.percent(snapshot.averageDispersionScore)}`,
      ` Confiança .............. ${this.percent(snapshot.averageConfidenceScore * 100)}`,
      ` Risco .................. ${this.percent(snapshot.averageRiskScore * 100)}`,
      '',
      ' COBERTURA',
      '----------------------------------------',
      ` Tamanho médio alvo ..... ${this.decimal(snapshot.averageTargetSize)}`,
      ` Cobertura média roda ... ${this.percent(snapshot.averageCoveragePercent)}`,
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
      ' REGIÕES DINÂMICAS',
      '----------------------------------------',
      ` Predominante ........... ${snapshot.predominantTargetRegion ?? 'nenhuma'}`,
    ];

    if (
      snapshot.targetRegionFrequency.length ===
      0
    ) {
      lines.push(
        ' Nenhuma região dinâmica observada.',
      );
    } else {
      for (
        const item of
        snapshot.targetRegionFrequency.slice(
          0,
          5,
        )
      ) {
        lines.push(
          ` ${item.regionId} = ${item.count} (${this.percent(item.percent)})`,
        );
      }
    }

    lines.push(
      '',
      ' BLOCKERS MAIS FREQUENTES',
      '----------------------------------------',
    );

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
      ' Estratégia ............. HEATMAP DYNAMIC',
      ' Natureza ............... SOMENTE CONTRAFACTUAL',
      ' Banca .................. NÃO ALTERADA',
      ' Execução automática ... NÃO',
      '',
      ' Hit rate deve ser interpretado junto da cobertura média.',
      ' Nenhum threshold é alterado por este comando.',
      '========================================',
    );

    return lines.join(
      '\n',
    );
  }


  public detail(
    snapshot:
      HeatmapDynamicLiveStatsSnapshot,
  ): string {
    const lines = [
      this.compact(
        snapshot,
      ),
      '',
      '========================================',
      ' RL.SYS — HEATMAP DYNAMIC / DETALHES',
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
          ` Modo analítico ....... ${event.analyticalMode}`,
          ` Sinal ................. ${event.signalStrength}`,
          ` Pressão dinâmica ...... ${this.percent(event.fusionPressureScore)}`,
          ` Pressão recente ....... ${this.percent(event.recencyPressureScore)}`,
          ` Dispersão ............. ${this.percent(event.dispersionScore)}`,
          ` Confiança ............. ${this.percent(event.confidenceScore * 100)}`,
          ` Risco ................. ${this.percent(event.riskScore * 100)}`,
          ` Região ................ ${event.targetRegionId ?? '-'}`,
          ` Números ............... ${
            event.targetNumbers.length > 0
              ? event.targetNumbers.join(' ')
              : '-'
          }`,
          ` Tamanho alvo .......... ${event.targetSize}`,
          ` Cobertura roda ........ ${this.percent(event.coveragePercent)}`,
        );

        if (
          event.registeredDecisionIndex !==
          null
        ) {
          lines.push(
            '',
            ' Hipótese criada',
            ` Decision #............ ${event.registeredDecisionIndex}`,
            ` Alvo congelado ....... ${
              event.targetNumbers.length > 0
                ? event.targetNumbers.join(' ')
                : '-'
            }`,
            ` Cobertura ............. ${this.percent(event.coveragePercent)}`,
            ' Liquidação ........... AGUARDANDO PRÓXIMO GIRO',
          );
        }

        if (
          event.settledDecisionIndex !==
          null
        ) {
          lines.push(
            '',
            ' Settlement anterior',
            ` Decision #............ ${event.settledDecisionIndex}`,
            ` Giro liquidador ...... ${event.settledBySpin ?? '-'}`,
            ` Resultado ............. ${event.settlementOutcome ?? '-'}`,
          );
        }

        lines.push(
          '',
        );
      }
    }

    lines.push(
      ' Estratégia ............. HEATMAP DYNAMIC',
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
      .toFixed(1)
      .replace('.', ',')}%`;
  }


  private decimal(
    value:
      number,
  ): string {
    return value
      .toFixed(2)
      .replace('.', ',');
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
