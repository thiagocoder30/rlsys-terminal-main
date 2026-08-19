const {
  OperatorExplainabilityPresenter,
} = require(
  '../../../dist/application/runtime/OperatorExplainabilityPresenter.js'
);


function qualification(
  overrides = {},
) {
  return {
    service:
      'WarmupQualificationRuntimePipeline',

    schemaVersion:
      '1.0.0',

    generatedAt:
      '2026-08-18T00:00:00.000Z',

    source:
      'manual',

    status:
      'BLOCKED',

    reason:
      'WARMUP_TABLE_NO_GO',

    operationalGate:
      'BLOCKED',

    extraction: {
      values:
        Array.from(
          {
            length:
              180,
          },

          (
            _,
            index,
          ) =>
            index %
            37,
        ),

      accepted:
        180,

      rejected:
        0,

      declaredTotal:
        180,

      confidence:
        0.93,

      warnings: [],

      reliability: {
        status:
          'ACCEPTED',

        score:
          0.93,

        issues: [],
      },
    },

    warmup: {
      engineVersion:
        'warmup-session-v1',

      sample: {
        received:
          180,

        used:
          180,

        warmupSize:
          200,

        completeness:
          0.90,
      },

      tableGate:
        'NO_GO',

      operationalGate:
        'BLOCKED',

      riskLabel:
        'HIGH',

      metrics: {
        normalizedEntropy:
          0.97,

        thirdLawDeviation:
          0.08,

        maxNumberConcentration:
          0.06,

        uniqueNumbers:
          37,

        longestRepeatRun:
          2,

        zeroRatio:
          0.03,

        evenOddImbalance:
          0.02,

        lowHighImbalance:
          0.01,
      },

      sectors: [],

      blockers: [
        'WARMUP_INCOMPLETE_100_ROUNDS',
      ],

      recommendations: [
        'Mesa hostil ou amostra incompleta: não iniciar sessão operacional.',
      ],
    },

    confidenceScore:
      0.326,

    decision: {
      tableQualified:
        false,

      supervisedObservationAllowed:
        false,

      supervisedOperationAllowed:
        false,

      liveMoneyAllowed:
        false,

      productionMoneyAllowed:
        false,

      requiresHumanReview:
        true,
    },

    humanExplanation: [
      'Warm-up processou 180 rodadas válidas com confiança 0.93.',
      'Gate estatístico da mesa: NO_GO.',
      'Risco contextual: HIGH.',
      'Mesa bloqueada por baixa evidência ou risco contextual elevado.',
      'O RL.SYS classifica contexto; ele não promete ganho e não libera dinheiro real.',
    ],

    ...overrides,
  };
}


function observation(
  overrides = {},
) {
  return {
    state:
      'OBSERVING',

    formationState:
      'WAITING_THIRD',

    summary:
      'WAITING_THIRD | sem entrada',

    reason:
      'TRIPLICACAO_NO_RECOMMENDATION',

    recommendationPending:
      false,

    paperOnly:
      true,

    recommendationOnly:
      true,

    humanExecutionRequired:
      true,

    automaticBetExecutionAllowed:
      false,

    ...overrides,
  };
}


describe(
  'OperatorExplainabilityPresenter',
  () => {
    const presenter =
      new OperatorExplainabilityPresenter();


    test(
      'formalizes blocked table qualification',
      () => {
        const result =
          presenter.qualification(
            qualification(),
          );

        expect(
          result.statusLabel,
        ).toBe(
          'NÃO QUALIFICADA',
        );

        expect(
          result.confidenceLabel,
        ).toBe(
          '32,6%',
        );

        expect(
          result.riskLabel,
        ).toBe(
          'ELEVADO',
        );

        expect(
          result.technicalCode,
        ).toBe(
          'WARMUP_TABLE_NO_GO',
        );
      },
    );


    test(
      'exposes real warmup indicators instead of invented causes',
      () => {
        const result =
          presenter.qualification(
            qualification(),
          );

        expect(
          result.indicators,
        ).toContain(
          'Amostra analisada: 180 de 200 rodadas (90,0%).',
        );

        expect(
          result.indicators,
        ).toContain(
          'Entropia normalizada: 97,0%.',
        );

        expect(
          result.indicators,
        ).toContain(
          'Concentração máxima de um número: 6,0%.',
        );

        expect(
          result.indicators,
        ).toContain(
          'Desvio de cobertura estatística: 8,0%.',
        );
      },
    );


    test(
      'qualification lines preserve technical code only as audit detail',
      () => {
        const text =
          presenter
            .qualificationLines(
              qualification(),
            )
            .join(
              '\n',
            );

        expect(
          text,
        ).toContain(
          'RL.SYS — AVALIAÇÃO DA MESA',
        );

        expect(
          text,
        ).toContain(
          'Status .................... NÃO QUALIFICADA',
        );

        expect(
          text,
        ).toContain(
          'Confiança da qualificação . 32,6%',
        );

        expect(
          text,
        ).toContain(
          'Orientação:',
        );

        expect(
          text,
        ).toContain(
          'Código técnico ............. WARMUP_TABLE_NO_GO',
        );

        expect(
          text,
        ).not.toContain(
          'Gate estatístico da mesa: NO_GO',
        );

        expect(
          text,
        ).not.toContain(
          'Risco contextual: HIGH',
        );
      },
    );


    test(
      'formalizes qualified table',
      () => {
        const base =
          qualification();

        const input =
          qualification({
            status:
              'QUALIFIED',

            reason:
              'WARMUP_TABLE_QUALIFIED',

            confidenceScore:
              0.88,

            warmup: {
              ...base.warmup,

              tableGate:
                'GO_RESEARCH',

              riskLabel:
                'LOW',

              sample: {
                received:
                  200,

                used:
                  200,

                warmupSize:
                  200,

                completeness:
                  1,
              },
            },
          });

        const result =
          presenter.qualification(
            input,
          );

        expect(
          result.statusLabel,
        ).toBe(
          'QUALIFICADA',
        );

        expect(
          result.riskLabel,
        ).toBe(
          'BAIXO',
        );

        expect(
          result.guidance.join(
            ' ',
          ),
        ).toContain(
          'prosseguir',
        );
      },
    );


    test(
      'formalizes Triplicacao ACTION without exposing technical language',
      () => {
        const result =
          presenter.triplicacao(
            observation({
              state:
                'ACTION',

              formationState:
                'WAITING_THIRD',

              summary:
                'ACTION TC -> RED',

              reason:
                'TRIPLICACAO_PROSPECTIVE_ACTION_CONFIRMED',

              recommendationPending:
                true,
            }),
          );

        expect(
          result.statusLabel,
        ).toBe(
          'OPORTUNIDADE CONFIRMADA',
        );

        expect(
          result.formationLabel,
        ).toBe(
          'AGUARDANDO GIRO DE CONFIRMAÇÃO',
        );

        expect(
          result.justification
            .join(
              ' ',
            ),
        ).not.toContain(
          'TRIPLICACAO_',
        );

        expect(
          result.technicalCode,
        ).toBe(
          'TRIPLICACAO_PROSPECTIVE_ACTION_CONFIRMED',
        );
      },
    );


    test(
      'formalizes forming state',
      () => {
        const result =
          presenter.triplicacao(
            observation({
              state:
                'FORMING',

              formationState:
                'WAITING_SECOND',

              reason:
                'TRIPLICACAO_WAITING_FOR_SECOND_POSITION',
            }),
          );

        expect(
          result.statusLabel,
        ).toBe(
          'FORMAÇÃO EM ANDAMENTO',
        );

        expect(
          result.formationLabel,
        ).toBe(
          'AGUARDANDO SEGUNDO GIRO',
        );
      },
    );


    test(
      'formalizes strategy risk block',
      () => {
        const result =
          presenter.triplicacao(
            observation({
              state:
                'BLOCKED',

              reason:
                'PAPER_STAKE_STRATEGY_RISK_TOO_HIGH',
            }),
          );

        expect(
          result.statusLabel,
        ).toBe(
          'ENTRADA NÃO RECOMENDADA',
        );

        expect(
          result.justification
            .join(
              ' ',
            ),
        ).toContain(
          'risco estimado',
        );

        expect(
          result.justification
            .join(
              ' ',
            ),
        ).not.toContain(
          'PAPER_STAKE_',
        );
      },
    );


    test(
      'formalizes minimum chip exposure block',
      () => {
        const result =
          presenter.triplicacao(
            observation({
              state:
                'BLOCKED',

              reason:
                'PAPER_STAKE_MINIMUM_EXCEEDS_SAFE_EXPOSURE',
            }),
          );

        expect(
          result.justification
            .join(
              ' ',
            ),
        ).toContain(
          'ficha mínima',
        );
      },
    );


    test(
      'formalizes capital stop',
      () => {
        const result =
          presenter.triplicacao(
            observation({
              state:
                'STOP',

              reason:
                'MAX_DRAWDOWN_REACHED',
            }),
          );

        expect(
          result.statusLabel,
        ).toBe(
          'OPERAÇÃO BLOQUEADA',
        );

        expect(
          result.justification
            .join(
              ' ',
            ),
        ).toContain(
          'preservação de capital',
        );
      },
    );


    test(
      'formal Triplicacao HUD does not display technical code',
      () => {
        const text =
          presenter
            .triplicacaoLines(
              observation({
                state:
                  'ACTION',

                reason:
                  'TRIPLICACAO_PROSPECTIVE_ACTION_CONFIRMED',
              }),
            )
            .join(
              '\n',
            );

        expect(
          text,
        ).toContain(
          'Estado .............. OPORTUNIDADE CONFIRMADA',
        );

        expect(
          text,
        ).not.toContain(
          'TRIPLICACAO_PROSPECTIVE_ACTION_CONFIRMED',
        );

        expect(
          text,
        ).not.toContain(
          'ACTION',
        );
      },
    );
  },
);
