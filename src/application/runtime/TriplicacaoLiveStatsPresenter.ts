import type {
  TriplicacaoGateEvaluation,
  TriplicacaoLiveDiagnosticEvent,
  TriplicacaoLiveStatsReport,
} from './TriplicacaoLiveStatsDiagnostics.js';


export class TriplicacaoLiveStatsPresenter {
  public compact(
    report:
      TriplicacaoLiveStatsReport,
  ): string {
    const latest =
      report.latestEvents[
        report.latestEvents.length -
        1
      ];

    return [
      '========================================',
      ' RL.SYS — ESTATÍSTICAS TRIPLICAÇÃO',
      '========================================',
      '',
      ' HISTÓRICO',
      '----------------------------------------',
      ` Sync ................ ${report.synchronizedHistorySize} giros`,
      ` Catch-up ............ ${report.catchUpSpinCount} giros`,
      ` LIVE ................ ${report.liveSpinCount} giros`,
      ` Total ............... ${report.totalHistorySize} giros`,
      '',
      ' TRIOS — SYNC',
      '----------------------------------------',
      ...this.patternLines(
        report.synchronized,
      ),
      '',
      ' TRIOS — LIVE PROSPECTIVO',
      '----------------------------------------',
      ` Concluídos .......... ${report.liveCompletedTrios}`,
      ` Anulados ............ ${report.liveDiscardedTrios}`,
      ` Recomendações ....... ${report.recommendationCount}`,
      '',
      ...this.patternLines(
        report.live,
      ),
      '',
      ' FORMAÇÃO ATUAL',
      '----------------------------------------',
      ...this.currentFormation(
        latest,
      ),
      '',
      ' Diagnóstico somente leitura.',
      ' Nenhuma entrada é executada pelo sistema.',
      '========================================',
    ].join(
      '\n',
    );
  }


  public detail(
    report:
      TriplicacaoLiveStatsReport,
  ): string {
    const events =
      report.latestEvents;

    const firstLiveIndex =
      events[0]
        ?.liveSpinIndex ??
      null;

    const lastLiveIndex =
      events[
        events.length -
        1
      ]
        ?.liveSpinIndex ??
      null;

    return [
      this.compact(
        report,
      ),
      '',
      '========================================',
      ' RL.SYS — TRIPLICAÇÃO / DETALHES',
      '========================================',
      '',
      ` Probability OBSERVE .... ${report.probabilityModes.observe}`,
      ` Probability PAPER_ONLY . ${report.probabilityModes.paperOnly}`,
      ` Action ACTION .......... ${report.actionStatuses.action}`,
      ` Action NO_ACTION ....... ${report.actionStatuses.noAction}`,
      ` Action não aplicável ... ${report.actionStatuses.none}`,
      '',
      ' JANELA DETALHADA',
      '----------------------------------------',
      ...(
        firstLiveIndex !==
          null &&
        lastLiveIndex !==
          null
          ? [
              ` LIVE inicial .......... ${firstLiveIndex}`,
              ` LIVE final ............ ${lastLiveIndex}`,
              ` Eventos exibidos ...... ${events.length}`,
              ' Continuidade .......... SEM OMISSÕES',
            ]
          : [
              ' Nenhum giro LIVE registrado ainda.',
            ]
      ),
      '',
      ' EVENTOS LIVE — ORDEM TEMPORAL',
      '----------------------------------------',
      ...(
        events.length >
          0
          ? events.flatMap(
              (event) =>
                this.eventLines(
                  event,
                ),
            )
          : [
              ' Nenhum evento LIVE registrado ainda.',
            ]
      ),
      '',
      ' Dados técnicos de diagnóstico.',
      ' Todos os LIVE da janela são exibidos.',
      ' Nenhum threshold é alterado por este comando.',
      '========================================',
    ].join(
      '\n',
    );
  }


  private patternLines(
    stats: {
      readonly total:
        number;

      readonly tc:
        number;

      readonly ntc:
        number;

      readonly ta:
        number;

      readonly nta:
        number;

      readonly zeroDiscarded:
        number;

      readonly dominantPattern:
        string;

      readonly dominantFrequencyScore:
        number;
    },
  ): string[] {
    return [
      ` Trios válidos ........ ${stats.total}`,
      ` Anulados por zero .... ${stats.zeroDiscarded}`,
      ` TC ................... ${stats.tc} (${this.share(stats.tc, stats.total)})`,
      ` NTC .................. ${stats.ntc} (${this.share(stats.ntc, stats.total)})`,
      ` TA ................... ${stats.ta} (${this.share(stats.ta, stats.total)})`,
      ` NTA .................. ${stats.nta} (${this.share(stats.nta, stats.total)})`,
      ` Predominante ......... ${stats.dominantPattern}`,
      ` Dominância ........... ${this.percent(stats.dominantFrequencyScore)}`,
    ];
  }


  private currentFormation(
    event:
      TriplicacaoLiveDiagnosticEvent |
      undefined,
  ): string[] {
    if (
      event ===
      undefined
    ) {
      return [
        ' Estado ............... ainda sem giro LIVE',
      ];
    }

    if (
      event.formationState ===
      'WAITING_SECOND'
    ) {
      return [
        ' Estado ............... AGUARDANDO SEGUNDO GIRO',
        ` Primeiro giro ........ ${event.firstNumber ?? event.spin}`,
        ' Segundo giro ......... aguardando',
      ];
    }

    if (
      event.formationState ===
      'WAITING_THIRD'
    ) {
      return [
        ' Estado ............... AGUARDANDO GIRO DE CONFIRMAÇÃO',
        ` Primeiro giro ........ ${event.firstNumber ?? '-'}`,
        ` Segundo giro ......... ${event.secondNumber ?? event.spin}`,
        ' Terceiro giro ........ aguardando',
      ];
    }

    return [
      ' Estado ............... AGUARDANDO PRIMEIRO GIRO',
    ];
  }


  private eventLines(
    event:
      TriplicacaoLiveDiagnosticEvent,
  ): string[] {
    return [
      ` LIVE ${event.liveSpinIndex}`,
      ` Posição na formação .. ${this.formationPosition(event)}`,
      ` Giro recebido ........ ${event.spin}`,
      ...this.partialFormationLines(
        event,
      ),
      ` Trio .................. ${this.trioLabel(event)}`,
      ` Família real .......... ${event.actualPatternKind ?? '-'}`,
      ` Hipótese selecionada .. ${event.selectedPatternKind ?? '-'}`,
      '',
      ' Métricas da engine',
      ` Base dominante ........ ${event.baseDominantPattern}`,
      ` Base dominância ....... ${this.percent(event.baseDominantFrequencyScore)}`,
      ` Base confiança ........ ${this.percent(event.baseConfidenceScore)}`,
      ` Base risco ............ ${this.percent(event.baseRiskScore)}`,
      ` Base mode ............. ${event.baseOperationalMode}`,
      ` Evidência avançada .... ${this.percent(event.advancedEvidenceScore)}`,
      ` Confiança avançada .... ${this.percent(event.advancedConfidenceScore)}`,
      ` Risco avançado ........ ${this.percent(event.advancedRiskScore)}`,
      ` Probability mode ...... ${event.probabilityMode}`,
      '',
      ` Gates aprovados ....... ${event.gateSummary.passed}/${event.gateSummary.total}`,
      ` Gates reprovados ...... ${event.gateSummary.failed}/${event.gateSummary.total}`,
      ...this.gateLines(
        event.gateSummary.evaluations,
      ),
      '',
      ` Action status ......... ${this.actionStatusLabel(event)}`,
      ` Recomendação .......... ${event.recommendationIssued ? 'SIM' : 'NÃO'}`,
      ` Blocker legado ........ ${event.blockers.length > 0 ? event.blockers.join(', ') : 'nenhum'}`,
      '',
    ];
  }


  private gateLines(
    gates:
      readonly TriplicacaoGateEvaluation[],
  ): string[] {
    const base =
      gates.filter(
        (gate) =>
          gate.id.startsWith(
            'BASE_',
          ),
      );

    const advanced =
      gates.filter(
        (gate) =>
          gate.id.startsWith(
            'ADVANCED_',
          ),
      );

    return [
      '',
      ' GATES — BASE',
      ...base.map(
        (gate) =>
          this.gateLine(
            gate,
          ),
      ),
      '',
      ' GATES — AVANÇADO',
      ...advanced.map(
        (gate) =>
          this.gateLine(
            gate,
          ),
      ),
    ];
  }


  private gateLine(
    gate:
      TriplicacaoGateEvaluation,
  ): string {
    const status =
      gate.passed
        ? 'PASS'
        : 'FAIL';

    if (
      gate.comparator ===
      'REQUIRED'
    ) {
      return ` ${status} | ${gate.label} | observado=${this.booleanLabel(Boolean(gate.observed))} | exigido=SIM`;
    }

    const comparator =
      gate.comparator ===
        'MINIMUM'
        ? 'mínimo'
        : 'máximo';

    return ` ${status} | ${gate.label} | observado=${this.gateValue(gate)} | ${comparator}=${this.gateThreshold(gate)} | margem=${this.gateMargin(gate)}`;
  }


  private gateValue(
    gate:
      TriplicacaoGateEvaluation,
  ): string {
    return this.percent(
      Number(
        gate.observed,
      ),
    );
  }


  private gateThreshold(
    gate:
      TriplicacaoGateEvaluation,
  ): string {
    return this.percent(
      Number(
        gate.threshold,
      ),
    );
  }


  private gateMargin(
    gate:
      TriplicacaoGateEvaluation,
  ): string {
    const raw =
      gate.margin;

    const sign =
      raw >
        0
        ? '+'
        : '';

    const value =
      Math.abs(
        raw,
      ) <=
        1
        ? raw *
          100
        : raw;

    return `${sign}${value
      .toFixed(1)
      .replace('.', ',')} p.p.`;
  }


  private booleanLabel(
    value:
      boolean,
  ): string {
    return value
      ? 'SIM'
      : 'NÃO';
  }


  private formationPosition(
    event:
      TriplicacaoLiveDiagnosticEvent,
  ): string {
    if (
      event.trioDiscarded
    ) {
      return 'FORMAÇÃO ANULADA';
    }

    if (
      event.trioCompleted
    ) {
      return 'TERCEIRO GIRO / CONFIRMAÇÃO';
    }

    if (
      event.formationState ===
      'WAITING_SECOND'
    ) {
      return 'PRIMEIRO GIRO';
    }

    if (
      event.formationState ===
      'WAITING_THIRD'
    ) {
      return 'SEGUNDO GIRO';
    }

    return 'EVENTO DE FORMAÇÃO';
  }


  private partialFormationLines(
    event:
      TriplicacaoLiveDiagnosticEvent,
  ): string[] {
    if (
      event.trioDiscarded
    ) {
      return [
        ' Formação ............. ANULADA',
      ];
    }

    if (
      event.trioCompleted
    ) {
      return [
        ` Primeiro giro ........ ${event.firstNumber ?? '-'}`,
        ` Segundo giro ......... ${event.secondNumber ?? '-'}`,
        ` Terceiro giro ........ ${event.spin}`,
      ];
    }

    if (
      event.formationState ===
      'WAITING_SECOND'
    ) {
      return [
        ` Primeiro giro ........ ${event.firstNumber ?? event.spin}`,
        ' Segundo giro ......... aguardando',
        ' Terceiro giro ........ aguardando',
      ];
    }

    if (
      event.formationState ===
      'WAITING_THIRD'
    ) {
      return [
        ` Primeiro giro ........ ${event.firstNumber ?? '-'}`,
        ` Segundo giro ......... ${event.secondNumber ?? event.spin}`,
        ' Terceiro giro ........ aguardando',
      ];
    }

    return [
      ' Formação ............. aguardando início',
    ];
  }


  private trioLabel(
    event:
      TriplicacaoLiveDiagnosticEvent,
  ): string {
    if (
      event.trioNumbers !==
      null
    ) {
      return event
        .trioNumbers
        .join(
          ' ',
        );
    }

    if (
      event.trioDiscarded
    ) {
      return 'anulado pelas regras da estratégia';
    }

    return 'ainda não concluído';
  }


  private actionStatusLabel(
    event:
      TriplicacaoLiveDiagnosticEvent,
  ): string {
    if (
      event.actionStatus !==
      null
    ) {
      return event.actionStatus;
    }

    return 'NÃO APLICÁVEL';
  }


  private share(
    count:
      number,

    total:
      number,
  ): string {
    if (
      total <=
      0
    ) {
      return '0,0%';
    }

    return this.percent(
      (
        count /
        total
      ) *
        100,
    );
  }


  private percent(
    raw:
      number,
  ): string {
    const value =
      Math.abs(
        raw,
      ) <=
        1
        ? raw *
          100
        : raw;

    return `${value
      .toFixed(1)
      .replace('.', ',')}%`;
  }
}
