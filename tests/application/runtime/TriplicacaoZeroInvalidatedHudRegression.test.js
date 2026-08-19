const {
  TriplicacaoLiveObservability,
} = require(
  '../../../dist/application/runtime/TriplicacaoLiveObservability.js'
);

const {
  OperatorExplainabilityPresenter,
} = require(
  '../../../dist/application/runtime/OperatorExplainabilityPresenter.js'
);


function sessionResult({
  firstNumber,
  secondNumber,
  spin,
  stateBefore,
  stateAfter,
  event,
  trioDiscarded = false,
  reasons = [],
}) {
  return {
    event,

    formationState:
      stateAfter,

    formation: {
      stateBefore,
      stateAfter,
      spin,
      firstNumber,
      secondNumber,

      action:
        null,

      settlement:
        trioDiscarded
          ? 'VOID'
          : null,

      settledTargetColor:
        null,

      settledSpinColor:
        null,

      trioCompleted:
        false,

      trioDiscarded,

      reasons,

      paperOnly:
        true,

      liveMoneyAuthorization:
        false,

      automaticBetExecutionAllowed:
        false,

      operatorDecisionRequired:
        true,
    },

    recommendation:
      null,

    settledSignal:
      null,

    financialRecommendation:
      null,

    financialSettlement:
      null,

    pendingSignalId:
      null,

    operatorMessage:
      '',

    paperOnly:
      true,

    recommendationOnly:
      true,

    humanExecutionRequired:
      true,

    liveMoneyAuthorization:
      false,

    automaticBetExecutionAllowed:
      false,

    operatorDecisionRequired:
      true,
  };
}


describe(
  'Triplicacao zero invalidated HUD regression',
  () => {
    const observability =
      new TriplicacaoLiveObservability();

    const presenter =
      new OperatorExplainabilityPresenter();


    test(
      'zero at first position renders invalidated state and 1/3 consumption',
      () => {
        const observation =
          observability.observe(
            sessionResult({
              firstNumber:
                0,

              secondNumber:
                null,

              spin:
                0,

              stateBefore:
                'WAITING_FIRST',

              stateAfter:
                'WAITING_SECOND',

              event:
                'FORMATION_STARTED',

              reasons: [
                'TRIPLICACAO_ZERO_AT_FIRST_POSITION',
                'TRIPLICACAO_TRIO_INVALIDATED_AWAITING_REMAINING_POSITIONS',
              ],
            }),
          );

        const text =
          presenter
            .triplicacaoLines(
              observation,
            )
            .join('\n');

        expect(
          text,
        ).toContain(
          'Estado .............. FORMAÇÃO INVALIDADA',
        );

        expect(
          text,
        ).toContain(
          'Formação ............ AGUARDANDO SEGUNDO GIRO',
        );

        expect(
          text,
        ).toContain(
          'Zero na posição ..... 1/3',
        );

        expect(
          text,
        ).toContain(
          'Posições consumidas . 1/3',
        );

        expect(
          text,
        ).toContain(
          'Os giros restantes ainda pertencem a esta mesma formação.',
        );
      },
    );


    test(
      'zero-first trio after second spin remains invalidated and reports 2/3',
      () => {
        const observation =
          observability.observe(
            sessionResult({
              firstNumber:
                0,

              secondNumber:
                17,

              spin:
                17,

              stateBefore:
                'WAITING_SECOND',

              stateAfter:
                'WAITING_THIRD',

              event:
                'NO_RECOMMENDATION',

              reasons: [
                'TRIPLICACAO_TRIO_INVALIDATED_AWAITING_THIRD_POSITION',
              ],
            }),
          );

        const text =
          presenter
            .triplicacaoLines(
              observation,
            )
            .join('\n');

        expect(
          text,
        ).toContain(
          'Estado .............. FORMAÇÃO INVALIDADA',
        );

        expect(
          text,
        ).toContain(
          'Formação ............ AGUARDANDO FECHAMENTO DO TRIO',
        );

        expect(
          text,
        ).toContain(
          'Zero na posição ..... 1/3',
        );

        expect(
          text,
        ).toContain(
          'Posições consumidas . 2/3',
        );
      },
    );


    test(
      'zero at second position reports its canonical position',
      () => {
        const observation =
          observability.observe(
            sessionResult({
              firstNumber:
                11,

              secondNumber:
                0,

              spin:
                0,

              stateBefore:
                'WAITING_SECOND',

              stateAfter:
                'WAITING_THIRD',

              event:
                'NO_RECOMMENDATION',

              reasons: [
                'TRIPLICACAO_ZERO_AT_SECOND_POSITION',
                'TRIPLICACAO_TRIO_INVALIDATED_AWAITING_THIRD_POSITION',
              ],
            }),
          );

        const text =
          presenter
            .triplicacaoLines(
              observation,
            )
            .join('\n');

        expect(
          text,
        ).toContain(
          'Zero na posição ..... 2/3',
        );

        expect(
          text,
        ).toContain(
          'Posições consumidas . 2/3',
        );

        expect(
          observation.recommendationPending,
        ).toBe(
          false,
        );
      },
    );


    test(
      'closing invalidated trio renders final VOID and new formation guidance',
      () => {
        const observation =
          observability.observe(
            sessionResult({
              firstNumber:
                0,

              secondNumber:
                17,

              spin:
                24,

              stateBefore:
                'WAITING_THIRD',

              stateAfter:
                'WAITING_FIRST',

              event:
                'TRIO_VOID',

              trioDiscarded:
                true,

              reasons: [
                'TRIPLICACAO_ZERO_POSITION:1',
                'TRIPLICACAO_FIXED_TRIO_CONSUMED',
                'TRIPLICACAO_TRIO_DISCARDED_BY_ZERO',
              ],
            }),
          );

        const text =
          presenter
            .triplicacaoLines(
              observation,
            )
            .join('\n');

        expect(
          text,
        ).toContain(
          'Estado .............. FORMAÇÃO ANULADA',
        );

        expect(
          text,
        ).toContain(
          'Zero na posição ..... 1/3',
        );

        expect(
          text,
        ).toContain(
          'Posições consumidas . 3/3',
        );

        expect(
          text,
        ).toContain(
          'O trio contendo zero foi encerrado e descartado integralmente.',
        );

        expect(
          text,
        ).toContain(
          'O próximo giro inicia uma nova formação.',
        );
      },
    );


    test(
      'HUD extension remains recommendation-only',
      () => {
        const observation =
          observability.observe(
            sessionResult({
              firstNumber:
                0,

              secondNumber:
                null,

              spin:
                0,

              stateBefore:
                'WAITING_FIRST',

              stateAfter:
                'WAITING_SECOND',

              event:
                'FORMATION_STARTED',

              reasons: [
                'TRIPLICACAO_ZERO_AT_FIRST_POSITION',
              ],
            }),
          );

        expect(
          observation.recommendationOnly,
        ).toBe(
          true,
        );

        expect(
          observation.humanExecutionRequired,
        ).toBe(
          true,
        );

        expect(
          observation.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );
      },
    );
  },
);
