import type {
  WarmupQualificationReport,
} from '../warmup/WarmupQualificationRuntimePipeline.js';

import type {
  TriplicacaoLiveObservation,
} from './TriplicacaoLiveObservability.js';


export interface OperatorQualificationPresentation {
  readonly statusLabel:
    'QUALIFICADA'
    | 'EM OBSERVAÇÃO'
    | 'NÃO QUALIFICADA';

  readonly confidenceLabel:
    string;

  readonly riskLabel:
    string;

  readonly assessment:
    readonly string[];

  readonly indicators:
    readonly string[];

  readonly guidance:
    readonly string[];

  readonly technicalCode:
    string;
}


export interface OperatorTriplicacaoPresentation {
  readonly statusLabel:
    string;

  readonly formationLabel:
    string;

  readonly justification:
    readonly string[];

  readonly technicalCode:
    string;
}


/**
 * Central user-facing language boundary.
 *
 * This presenter:
 *
 * - never changes statistical decisions;
 * - never changes thresholds;
 * - never changes bankroll;
 * - never changes stake;
 * - never changes recovery;
 * - never creates strategy signals;
 * - never executes entries.
 *
 * Technical codes remain available for audit, while the operator-facing
 * presentation uses formal Portuguese and explicit operational guidance.
 */
export class OperatorExplainabilityPresenter {
  public qualification(
    report:
      WarmupQualificationReport,
  ): OperatorQualificationPresentation {
    const warmup =
      report.warmup;

    const statusLabel =
      this.qualificationStatus(
        report.status,
      );

    const riskLabel =
      warmup
        ? this.riskLabel(
            warmup.riskLabel,
          )
        : 'NÃO DISPONÍVEL';

    const assessment =
      this.qualificationAssessment(
        report,
      );

    const indicators:
      string[] =
        [];

    if (
      warmup
    ) {
      indicators.push(
        `Amostra analisada: ${warmup.sample.used} de ${warmup.sample.warmupSize} rodadas (${this.percent(warmup.sample.completeness)}).`,
      );

      indicators.push(
        `Entropia normalizada: ${this.percent(warmup.metrics.normalizedEntropy)}.`,
      );

      indicators.push(
        `Concentração máxima de um número: ${this.percent(warmup.metrics.maxNumberConcentration)}.`,
      );

      indicators.push(
        `Desvio de cobertura estatística: ${this.percent(warmup.metrics.thirdLawDeviation)}.`,
      );

      indicators.push(
        `Risco contextual: ${riskLabel}.`,
      );
    }

    const guidance =
      this.qualificationGuidance(
        report,
      );

    return Object.freeze({
      statusLabel,

      confidenceLabel:
        this.percent(
          report.confidenceScore,
        ),

      riskLabel,

      assessment:
        Object.freeze(
          assessment,
        ),

      indicators:
        Object.freeze(
          indicators,
        ),

      guidance:
        Object.freeze(
          guidance,
        ),

      technicalCode:
        report.reason,
    });
  }


  public qualificationLines(
    report:
      WarmupQualificationReport,
  ): readonly string[] {
    const presentation =
      this.qualification(
        report,
      );

    const lines:
      string[] =
        [
          '========================================',
          ' RL.SYS — AVALIAÇÃO DA MESA',
          '========================================',
          '',
          ` Status .................... ${presentation.statusLabel}`,
          ` Histórico sincronizado .... ${report.extraction.accepted} giros`,
          ` Janela de qualificação .... ${
            report.warmup
              ? `${report.warmup.sample.used} giros mais recentes`
              : 'NÃO DISPONÍVEL'
          }`,
          ` Completude da janela ...... ${
            report.warmup
              ? this.percent(
                  report.warmup.sample.completeness,
                )
              : 'N/A'
          }`,
          ` Confiança da qualificação . ${presentation.confidenceLabel}`,
          ` Risco contextual .......... ${presentation.riskLabel}`,
          '',
          ' Avaliação:',
        ];

    for (
      const item of
      presentation.assessment
    ) {
      lines.push(
        ` ${item}`,
      );
    }

    if (
      presentation.indicators.length >
      0
    ) {
      lines.push(
        '',
        ' Indicadores:',
      );

      for (
        const indicator of
        presentation.indicators
      ) {
        lines.push(
          ` • ${indicator}`,
        );
      }
    }

    lines.push(
      '',
      ' Orientação:',
    );

    for (
      const guidance of
      presentation.guidance
    ) {
      lines.push(
        ` ${guidance}`,
      );
    }

    lines.push(
      '',
      ` Código técnico ............. ${presentation.technicalCode}`,
      '========================================',
    );

    return Object.freeze(
      lines,
    );
  }


  public triplicacao(
    observation:
      TriplicacaoLiveObservation,
  ): OperatorTriplicacaoPresentation {
    if (
      observation.state ===
      'ACTION'
    ) {
      return this.triplicacaoResult({
        statusLabel:
          'OPORTUNIDADE CONFIRMADA',

        formationLabel:
          this.formationLabel(
            observation.formationState,
          ),

        justification: [
          'A formação prospectiva da estratégia foi confirmada pelos critérios analíticos vigentes.',
          'A decisão final de seguir ou ignorar a orientação permanece exclusivamente com o operador.',
        ],

        technicalCode:
          observation.reason,
      });
    }

    if (
      observation.state ===
      'INVALIDATED'
    ) {
      return this.triplicacaoResult({
        statusLabel:
          'FORMAÇÃO INVALIDADA',

        formationLabel:
          observation.positionsConsumed ===
            1
            ? 'AGUARDANDO SEGUNDO GIRO'
            : 'AGUARDANDO FECHAMENTO DO TRIO',

        justification: [
          'O trio atual contém zero e será descartado integralmente.',
          'Os giros restantes ainda pertencem a esta mesma formação.',
          'Nenhuma hipótese ou entrada será avaliada até o próximo trio.',
        ],

        technicalCode:
          observation.reason,
      });
    }

    if (
      observation.state ===
      'FORMING'
    ) {
      return this.triplicacaoResult({
        statusLabel:
          'FORMAÇÃO EM ANDAMENTO',

        formationLabel:
          this.formationLabel(
            observation.formationState,
          ),

        justification: [
          'A estrutura necessária para avaliar uma oportunidade ainda não foi concluída.',
          'Nenhuma entrada é recomendada neste momento.',
        ],

        technicalCode:
          observation.reason,
      });
    }

    if (
      observation.state ===
      'OBSERVING'
    ) {
      return this.triplicacaoResult({
        statusLabel:
          'EM OBSERVAÇÃO',

        formationLabel:
          this.formationLabel(
            observation.formationState,
          ),

        justification: [
          this.observationReason(
            observation.reason,
          ),
          'Nenhuma entrada é recomendada neste momento.',
        ],

        technicalCode:
          observation.reason,
      });
    }

    if (
      observation.state ===
      'BLOCKED'
    ) {
      return this.triplicacaoResult({
        statusLabel:
          'ENTRADA NÃO RECOMENDADA',

        formationLabel:
          this.formationLabel(
            observation.formationState,
          ),

        justification: [
          this.blockReason(
            observation.reason,
          ),
          'A preservação da banca tem prioridade sobre a oportunidade estatística.',
        ],

        technicalCode:
          observation.reason,
      });
    }

    if (
      observation.state ===
      'STOP'
    ) {
      return this.triplicacaoResult({
        statusLabel:
          'OPERAÇÃO BLOQUEADA',

        formationLabel:
          this.formationLabel(
            observation.formationState,
          ),

        justification: [
          'O limite institucional de preservação de capital impede nova exposição.',
          'Não devem ser consideradas novas entradas enquanto o bloqueio permanecer ativo.',
        ],

        technicalCode:
          observation.reason,
      });
    }

    if (
      observation.state ===
      'SETTLED'
    ) {
      return this.triplicacaoResult({
        statusLabel:
          'RECOMENDAÇÃO ENCERRADA',

        formationLabel:
          this.formationLabel(
            observation.formationState,
          ),

        justification: [
          'A recomendação prospectiva anterior recebeu seu resultado estatístico e financeiro.',
        ],

        technicalCode:
          observation.reason,
      });
    }

    return this.triplicacaoResult({
      statusLabel:
        'FORMAÇÃO ANULADA',

      formationLabel:
        this.formationLabel(
          observation.formationState,
        ),

      justification: [
        observation.zeroPosition !==
          null
          ? 'O trio contendo zero foi encerrado e descartado integralmente.'
          : 'A formação prospectiva foi anulada pelas regras da estratégia.',
        observation.zeroPosition !==
          null
          ? 'O próximo giro inicia uma nova formação.'
          : 'Nenhuma nova exposição foi autorizada por este evento.',
      ],

      technicalCode:
        observation.reason,
    });
  }


  public triplicacaoLines(
    observation:
      TriplicacaoLiveObservation,
  ): readonly string[] {
    const presentation =
      this.triplicacao(
        observation,
      );

    const lines:
      string[] =
        [
          '',
          'Triplicação',
          `Estado .............. ${presentation.statusLabel}`,
          `Formação ............ ${presentation.formationLabel}`,
        ];

    if (
      observation.state ===
        'INVALIDATED' ||
      observation.state ===
        'VOID'
    ) {
      if (
        observation.zeroPosition !==
        null
      ) {
        lines.push(
          `Zero na posição ..... ${observation.zeroPosition}/3`,
        );
      }

      lines.push(
        `Posições consumidas . ${observation.positionsConsumed}/3`,
      );
    }

    lines.push(
      'Justificativa .......',
    );

    for (
      const item of
      presentation.justification
    ) {
      lines.push(
        `  ${item}`,
      );
    }

    return Object.freeze(
      lines,
    );
  }


  private qualificationAssessment(
    report:
      WarmupQualificationReport,
  ): string[] {
    const warmup =
      report.warmup;

    if (
      report.status ===
      'QUALIFIED'
    ) {
      return [
        'A mesa atende aos critérios estatísticos atualmente exigidos para prosseguir em modo PAPER supervisionado.',
        'A qualificação da mesa não representa garantia de resultado e não autoriza execução automática.',
      ];
    }

    if (
      report.status ===
      'OBSERVE'
    ) {
      return [
        'A mesa apresenta condições intermediárias e ainda requer observação adicional.',
        'Os critérios atuais não permitem iniciar uma sessão operacional supervisionada neste momento.',
      ];
    }

    const assessment:
      string[] =
        [
          'A mesa não atende, neste momento, aos critérios estatísticos necessários para iniciar uma sessão PAPER supervisionada.',
        ];

    if (
      warmup
    ) {
      if (
        warmup.sample.completeness <
        1
      ) {
        assessment.push(
          `A amostra disponível corresponde a ${this.percent(warmup.sample.completeness)} da quantidade de rodadas atualmente exigida para a qualificação completa.`,
        );
      }

      assessment.push(
        `O risco contextual observado foi classificado como ${this.riskLabel(warmup.riskLabel).toLowerCase()}.`,
      );

      if (
        warmup.tableGate ===
        'NO_GO'
      ) {
        assessment.push(
          'O conjunto de evidências disponível não foi suficiente para liberar a mesa para operação supervisionada.',
        );
      }
    }

    return assessment;
  }


  private qualificationGuidance(
    report:
      WarmupQualificationReport,
  ): string[] {
    if (
      report.status ===
      'QUALIFIED'
    ) {
      return [
        'A sessão pode prosseguir para a etapa de preparação supervisionada.',
        'Toda eventual entrada continuará dependendo de recomendação explícita e decisão manual do operador.',
      ];
    }

    if (
      report.status ===
      'OBSERVE'
    ) {
      return [
        'Não iniciar entradas nesta mesa neste momento.',
        'Aguarde novas rodadas e execute um novo Sync para reavaliar o contexto.',
      ];
    }

    return [
      'Não iniciar entradas nesta mesa.',
      'Aguarde novas rodadas e execute um novo Sync, ou selecione outra mesa para avaliação.',
    ];
  }


  private qualificationStatus(
    status:
      WarmupQualificationReport['status'],
  ):
    'QUALIFICADA'
    | 'EM OBSERVAÇÃO'
    | 'NÃO QUALIFICADA' {
    if (
      status ===
      'QUALIFIED'
    ) {
      return 'QUALIFICADA';
    }

    if (
      status ===
      'OBSERVE'
    ) {
      return 'EM OBSERVAÇÃO';
    }

    return 'NÃO QUALIFICADA';
  }


  private riskLabel(
    risk:
      'LOW'
      | 'MODERATE'
      | 'HIGH'
      | 'CRITICAL',
  ): string {
    if (
      risk ===
      'LOW'
    ) {
      return 'BAIXO';
    }

    if (
      risk ===
      'MODERATE'
    ) {
      return 'MODERADO';
    }

    if (
      risk ===
      'HIGH'
    ) {
      return 'ELEVADO';
    }

    return 'CRÍTICO';
  }


  private formationLabel(
    state:
      string,
  ): string {
    if (
      state ===
      'WAITING_FIRST'
    ) {
      return 'AGUARDANDO PRIMEIRO GIRO';
    }

    if (
      state ===
      'WAITING_SECOND'
    ) {
      return 'AGUARDANDO SEGUNDO GIRO';
    }

    if (
      state ===
      'WAITING_THIRD'
    ) {
      return 'AGUARDANDO GIRO DE CONFIRMAÇÃO';
    }

    return state;
  }


  private observationReason(
    reason:
      string,
  ): string {
    if (
      reason ===
      'TRIPLICACAO_WAITING_FOR_SECOND_POSITION'
    ) {
      return 'A formação ainda aguarda o segundo giro necessário para avaliação.';
    }

    if (
      reason ===
      'TRIPLICACAO_ACTION_SEMANTICS_OBSERVE'
    ) {
      return 'A formação observada não atende aos critérios de ação da estratégia.';
    }

    if (
      reason ===
      'TRIPLICACAO_NO_RECOMMENDATION'
    ) {
      return 'A análise atual não produziu evidência suficiente para recomendar uma entrada.';
    }

    if (
      reason ===
      'TRIPLICACAO_UNCLASSIFIED_OBSERVATION'
    ) {
      return 'O contexto permanece em acompanhamento sem oportunidade confirmada.';
    }

    if (
      this.looksTechnical(
        reason,
      )
    ) {
      return 'Os critérios atuais da estratégia não confirmaram uma oportunidade de entrada.';
    }

    return reason;
  }


  private blockReason(
    reason:
      string,
  ): string {
    if (
      reason.includes(
        'PAPER_STAKE_STRATEGY_RISK_TOO_HIGH',
      )
    ) {
      return 'O risco estimado para a estratégia está acima do limite permitido para a exposição atual.';
    }

    if (
      reason.includes(
        'PAPER_STAKE_MINIMUM_EXCEEDS_SAFE_EXPOSURE',
      )
    ) {
      return 'A ficha mínima disponível excede a exposição considerada segura para a banca atual.';
    }

    if (
      this.looksTechnical(
        reason,
      )
    ) {
      return 'Os controles institucionais de risco impediram a recomendação de nova exposição.';
    }

    return reason;
  }


  private triplicacaoResult(
    input:
      OperatorTriplicacaoPresentation,
  ): OperatorTriplicacaoPresentation {
    return Object.freeze({
      ...input,

      justification:
        Object.freeze([
          ...input.justification,
        ]),
    });
  }


  private looksTechnical(
    value:
      string,
  ): boolean {
    return (
      /^[A-Z0-9_:,.-]+$/.test(
        value,
      ) ||
      value.includes(
        'TRIPLICACAO_',
      ) ||
      value.includes(
        'PAPER_STAKE_',
      )
    );
  }


  private percent(
    value:
      number,
  ): string {
    if (
      !Number.isFinite(
        value,
      )
    ) {
      return 'N/A';
    }

    return `${(
      value *
      100
    )
      .toFixed(1)
      .replace(
        '.',
        ',',
      )}%`;
  }
}
