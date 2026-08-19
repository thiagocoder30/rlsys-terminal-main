import type {
  TriplicacaoCounterfactualSettlementRecord,
  TriplicacaoCounterfactualSettlementReport,
  TriplicacaoCounterfactualSettlementScenarioReport,
} from './TriplicacaoCounterfactualSettlementEngine.js';


export class TriplicacaoCounterfactualSettlementPresenter {
  public present(
    report:
      TriplicacaoCounterfactualSettlementReport,
  ): string {
    return [
      '',
      '========================================',
      ' RL.SYS — SETTLEMENT CONTRAFACTUAL',
      '========================================',
      '',
      ' ESCOPO',
      '----------------------------------------',
      ` LIVE observados ........ ${report.totalLiveEvents}`,
      ` Pontos decisórios ...... ${report.decisionApplicableEvents}`,
      '',
      ' RESULTADOS POR CENÁRIO',
      '----------------------------------------',
      ...report.scenarios.flatMap(
        (scenario) =>
          this.scenarioLines(
            scenario,
          ),
      ),
      '',
      ' INTERPRETAÇÃO',
      '----------------------------------------',
      ...this.interpretation(
        report,
      ),
      '',
      ' Política oficial ...... PRESERVADA',
      ' Natureza .............. SOMENTE CONTRAFACTUAL',
      ' Banca ................. NÃO ALTERADA',
      ' Martingale ............ NÃO SIMULADO',
      ' Execução automática ... NÃO',
      '',
      ' Nenhuma recomendação oficial foi criada.',
      '========================================',
    ].join(
      '\n',
    );
  }


  public detail(
    report:
      TriplicacaoCounterfactualSettlementReport,

    limit =
      20,
  ): string {
    const records =
      report.scenarios
        .filter(
          (scenario) =>
            !scenario.official,
        )
        .flatMap(
          (scenario) =>
            scenario.records,
        )
        .sort(
          (
            left,
            right,
          ) =>
            left.decisionLiveIndex -
            right.decisionLiveIndex,
        );

    const recent =
      records.slice(
        Math.max(
          0,
          records.length -
          limit,
        ),
      );

    return [
      this.present(
        report,
      ),
      '',
      '========================================',
      ' RL.SYS — SETTLEMENT / DETALHES',
      '========================================',
      '',
      ` Registros exibidos ..... ${recent.length}`,
      '',
      ...(
        recent.length ===
          0
          ? [
              ' Nenhum settlement contrafactual disponível.',
            ]
          : recent.flatMap(
              (
                record,
                index,
              ) =>
                this.recordLines(
                  record,
                  index +
                  1,
                ),
            )
      ),
      '',
      ' Dados exclusivamente diagnósticos.',
      ' Nenhuma banca foi recalculada.',
      '========================================',
    ].join(
      '\n',
    );
  }


  private scenarioLines(
    scenario:
      TriplicacaoCounterfactualSettlementScenarioReport,
  ): string[] {
    return [
      `${scenario.policyId}${scenario.official ? ' [OFICIAL]' : ''}`,
      ` Política .............. ${scenario.policyLabel}`,
      ` Pontos decisórios ..... ${scenario.decisionApplicableEvents}`,
      ` Elegíveis ............. ${scenario.eligibleEvents}`,
      ` Acionáveis ............ ${scenario.actionableEvents}`,
      ` Não acionáveis ........ ${scenario.notActionableEvents}`,
      ` Liquidados ............ ${scenario.settledEvents}`,
      ` Pendentes ............. ${scenario.pendingEvents}`,
      ` Lacunas de dados ...... ${scenario.dataGapEvents}`,
      ` WIN .................... ${scenario.wins}`,
      ` LOSS ................... ${scenario.losses}`,
      ` VOID ................... ${scenario.voids}`,
      ` Decisivos .............. ${scenario.decisiveEvents}`,
      ` Hit rate ............... ${this.optionalFraction(scenario.hitRate)}`,
      ` Void rate .............. ${this.optionalFraction(scenario.voidRate)}`,
      ` Maior sequência LOSS .. ${scenario.maxLossStreak}`,
      '',
    ];
  }


  private recordLines(
    record:
      TriplicacaoCounterfactualSettlementRecord,

    index:
      number,
  ): string[] {
    return [
      `#${index} | ${record.policyId}`,
      ` Decisão LIVE .......... ${record.decisionLiveIndex}`,
      ` Settlement LIVE ....... ${record.settlementLiveIndex ?? 'pendente'}`,
      ` Formação .............. ${record.firstNumber} ${record.secondNumber} ${record.thirdNumber ?? '-'}`,
      ` Hipótese .............. ${record.selectedPatternKind}`,
      ` Action status ......... ${this.actionStatus(record.actionStatus)}`,
      ` Alvo .................. ${this.color(record.targetColor)}`,
      ` Família realizada ..... ${record.actualPatternKind ?? '-'}`,
      ` Resultado .............. ${this.result(record.result)}`,
      '',
    ];
  }


  private interpretation(
    report:
      TriplicacaoCounterfactualSettlementReport,
  ): string[] {
    const nonOfficial =
      report.scenarios.filter(
        (scenario) =>
          !scenario.official,
      );

    const settled =
      nonOfficial.filter(
        (scenario) =>
          scenario.decisiveEvents >
          0,
      );

    if (
      settled.length ===
      0
    ) {
      return [
        ' Ainda não existem resultados decisivos suficientes para comparação.',
        ' Continue coletando giros LIVE antes de avaliar qualquer política.',
      ];
    }

    const ordered =
      [
        ...settled,
      ].sort(
        (
          left,
          right,
        ) =>
          (
            right.hitRate ??
            0
          ) -
          (
            left.hitRate ??
            0
          ),
      );

    const leader =
      ordered[0];

    if (
      leader.decisiveEvents <
      10
    ) {
      return [
        ` ${leader.policyId} apresenta a maior taxa observada neste recorte.`,
        ` Entretanto, possui apenas ${leader.decisiveEvents} resultados decisivos.`,
        ' A amostra ainda é exploratória e não justifica alteração da política oficial.',
      ];
    }

    return [
      ' Existem cenários com resultados prospectivos mensuráveis.',
      ' Compare taxa de acerto, cobertura e sequência de perdas antes de qualquer promoção.',
      ' Nenhum cenário deve ser promovido apenas pela maior taxa de acerto isolada.',
    ];
  }


  private optionalFraction(
    value:
      number | null,
  ): string {
    if (
      value ===
      null
    ) {
      return '-';
    }

    return `${(
      value *
      100
    )
      .toFixed(1)
      .replace('.', ',')}%`;
  }


  private actionStatus(
    value:
      string,
  ): string {
    if (
      value ===
      'ACTION'
    ) {
      return 'ACTION';
    }

    if (
      value ===
      'ZERO_BLOCKED'
    ) {
      return 'BLOQUEADO POR ZERO';
    }

    return 'NÃO ACIONÁVEL';
  }


  private color(
    value:
      string | null,
  ): string {
    if (
      value ===
      'RED'
    ) {
      return 'VERMELHO';
    }

    if (
      value ===
      'BLACK'
    ) {
      return 'PRETO';
    }

    return '-';
  }


  private result(
    value:
      string,
  ): string {
    if (
      value ===
      'WIN'
    ) {
      return 'WIN';
    }

    if (
      value ===
      'LOSS'
    ) {
      return 'LOSS';
    }

    if (
      value ===
      'VOID'
    ) {
      return 'VOID';
    }

    if (
      value ===
      'PENDING'
    ) {
      return 'PENDENTE';
    }

    if (
      value ===
      'NOT_ACTIONABLE'
    ) {
      return 'NÃO ACIONÁVEL';
    }

    return 'LACUNA DE DADOS';
  }
}
