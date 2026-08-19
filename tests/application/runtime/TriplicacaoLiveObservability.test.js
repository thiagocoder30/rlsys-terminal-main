const {
  TriplicacaoLiveObservability,
} = require(
  '../../../dist/application/runtime/TriplicacaoLiveObservability.js'
);


function baseFormation(
  overrides = {},
) {
  return {
    stateBefore:
      'WAITING_SECOND',

    stateAfter:
      'WAITING_THIRD',

    spin:
      17,

    firstNumber:
      11,

    secondNumber:
      17,

    action:
      null,

    settlement:
      null,

    settledTargetColor:
      null,

    settledSpinColor:
      null,

    trioCompleted:
      false,

    trioDiscarded:
      false,

    reasons:
      [],

    paperOnly:
      true,

    liveMoneyAuthorization:
      false,

    automaticBetExecutionAllowed:
      false,

    operatorDecisionRequired:
      true,

    ...overrides,
  };
}


function baseResult(
  overrides = {},
) {
  return {
    event:
      'NO_RECOMMENDATION',

    formationState:
      'WAITING_THIRD',

    formation:
      baseFormation(),

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
      'Sem recomendação.',

    ...overrides,
  };
}


describe(
  'TriplicacaoLiveObservability',
  () => {
    const observability =
      new TriplicacaoLiveObservability();


    test(
      'describes formation start',
      () => {
        const result =
          observability.observe(
            baseResult({
              event:
                'FORMATION_STARTED',

              formationState:
                'WAITING_SECOND',

              formation:
                baseFormation({
                  stateBefore:
                    'WAITING_FIRST',

                  stateAfter:
                    'WAITING_SECOND',

                  spin:
                    11,

                  firstNumber:
                    11,

                  secondNumber:
                    null,

                  reasons: [
                    'TRIPLICACAO_FIRST_POSITION_RECEIVED',
                  ],
                }),
            }),
          );

        expect(
          result.state,
        ).toBe(
          'FORMING',
        );

        expect(
          result.summary,
        ).toContain(
          'WAITING_SECOND',
        );

        expect(
          result.positionsConsumed,
        ).toBe(
          1,
        );

        expect(
          result.zeroPosition,
        ).toBeNull();
      },
    );


    test(
      'zero at first position is exposed as invalidated formation',
      () => {
        const result =
          observability.observe(
            baseResult({
              event:
                'FORMATION_STARTED',

              formationState:
                'WAITING_SECOND',

              formation:
                baseFormation({
                  stateBefore:
                    'WAITING_FIRST',

                  stateAfter:
                    'WAITING_SECOND',

                  spin:
                    0,

                  firstNumber:
                    0,

                  secondNumber:
                    null,

                  reasons: [
                    'TRIPLICACAO_ZERO_AT_FIRST_POSITION',
                    'TRIPLICACAO_TRIO_INVALIDATED_AWAITING_REMAINING_POSITIONS',
                  ],
                }),
            }),
          );

        expect(
          result.state,
        ).toBe(
          'INVALIDATED',
        );

        expect(
          result.zeroPosition,
        ).toBe(
          1,
        );

        expect(
          result.positionsConsumed,
        ).toBe(
          1,
        );

        expect(
          result.recommendationPending,
        ).toBe(
          false,
        );
      },
    );


    test(
      'zero-first trio remains invalidated after second position',
      () => {
        const result =
          observability.observe(
            baseResult({
              formationState:
                'WAITING_THIRD',

              formation:
                baseFormation({
                  firstNumber:
                    0,

                  secondNumber:
                    17,

                  spin:
                    17,

                  reasons: [
                    'TRIPLICACAO_TRIO_INVALIDATED_AWAITING_THIRD_POSITION',
                  ],
                }),
            }),
          );

        expect(
          result.state,
        ).toBe(
          'INVALIDATED',
        );

        expect(
          result.zeroPosition,
        ).toBe(
          1,
        );

        expect(
          result.positionsConsumed,
        ).toBe(
          2,
        );
      },
    );


    test(
      'zero at second position is exposed as invalidated formation',
      () => {
        const result =
          observability.observe(
            baseResult({
              formation:
                baseFormation({
                  firstNumber:
                    11,

                  secondNumber:
                    0,

                  spin:
                    0,

                  reasons: [
                    'TRIPLICACAO_ZERO_AT_SECOND_POSITION',
                    'TRIPLICACAO_TRIO_INVALIDATED_AWAITING_THIRD_POSITION',
                  ],
                }),
            }),
          );

        expect(
          result.state,
        ).toBe(
          'INVALIDATED',
        );

        expect(
          result.zeroPosition,
        ).toBe(
          2,
        );

        expect(
          result.positionsConsumed,
        ).toBe(
          2,
        );

        expect(
          result.recommendationPending,
        ).toBe(
          false,
        );
      },
    );


    test(
      'completed zero-invalidated trio becomes VOID',
      () => {
        const result =
          observability.observe(
            baseResult({
              event:
                'TRIO_VOID',

              formationState:
                'WAITING_FIRST',

              formation:
                baseFormation({
                  stateBefore:
                    'WAITING_THIRD',

                  stateAfter:
                    'WAITING_FIRST',

                  firstNumber:
                    0,

                  secondNumber:
                    17,

                  spin:
                    24,

                  settlement:
                    'VOID',

                  trioDiscarded:
                    true,

                  reasons: [
                    'TRIPLICACAO_ZERO_POSITION:1',
                    'TRIPLICACAO_FIXED_TRIO_CONSUMED',
                    'TRIPLICACAO_TRIO_DISCARDED_BY_ZERO',
                  ],
                }),
            }),
          );

        expect(
          result.state,
        ).toBe(
          'VOID',
        );

        expect(
          result.zeroPosition,
        ).toBe(
          1,
        );

        expect(
          result.positionsConsumed,
        ).toBe(
          3,
        );
      },
    );


    test(
      'zero in third position becomes VOID at natural boundary',
      () => {
        const result =
          observability.observe(
            baseResult({
              event:
                'TRIO_VOID',

              formationState:
                'WAITING_FIRST',

              formation:
                baseFormation({
                  stateBefore:
                    'WAITING_THIRD',

                  stateAfter:
                    'WAITING_FIRST',

                  firstNumber:
                    11,

                  secondNumber:
                    20,

                  spin:
                    0,

                  settlement:
                    'VOID',

                  trioDiscarded:
                    true,

                  reasons: [
                    'TRIPLICACAO_ZERO_POSITION:3',
                    'TRIPLICACAO_FIXED_TRIO_CONSUMED',
                    'TRIPLICACAO_TRIO_DISCARDED_BY_ZERO',
                  ],
                }),
            }),
          );

        expect(
          result.state,
        ).toBe(
          'VOID',
        );

        expect(
          result.zeroPosition,
        ).toBe(
          3,
        );

        expect(
          result.positionsConsumed,
        ).toBe(
          3,
        );
      },
    );


    test(
      'describes ordinary no recommendation',
      () => {
        const result =
          observability.observe(
            baseResult(),
          );

        expect(
          result.state,
        ).toBe(
          'OBSERVING',
        );

        expect(
          result.summary,
        ).toContain(
          'sem entrada',
        );
      },
    );


    test(
      'preserves ActionSemantics rationale when observing',
      () => {
        const result =
          observability.observe(
            baseResult({
              formation: {
                ...baseFormation(),

                action: {
                  status:
                    'OBSERVE',

                  rationale:
                    'Padrão selecionado não atua nesta abertura.',
                },
              },
            }),
          );

        expect(
          result.reason,
        ).toBe(
          'Padrão selecionado não atua nesta abertura.',
        );
      },
    );


    test(
      'describes prospective action',
      () => {
        const result =
          observability.observe(
            baseResult({
              event:
                'RECOMMENDATION_ISSUED',

              recommendation: {
                pattern:
                  'TC',

                targetColor:
                  'RED',
              },

              pendingSignalId:
                'signal-1',
            }),
          );

        expect(
          result.state,
        ).toBe(
          'ACTION',
        );

        expect(
          result.summary,
        ).toContain(
          'TC -> RED',
        );

        expect(
          result.recommendationPending,
        ).toBe(
          true,
        );
      },
    );


    test(
      'describes settled signal',
      () => {
        const result =
          observability.observe(
            baseResult({
              event:
                'RECOMMENDATION_SETTLED',

              formationState:
                'WAITING_FIRST',

              formation:
                baseFormation({
                  stateBefore:
                    'WAITING_THIRD',

                  stateAfter:
                    'WAITING_FIRST',

                  trioCompleted:
                    true,
                }),

              settledSignal: {
                result:
                  'WIN',
              },
            }),
          );

        expect(
          result.state,
        ).toBe(
          'SETTLED',
        );

        expect(
          result.summary,
        ).toContain(
          'WIN',
        );
      },
    );


    test(
      'distinguishes zero void without pending signal',
      () => {
        const result =
          observability.observe(
            baseResult({
              event:
                'TRIO_VOID',

              formationState:
                'WAITING_FIRST',

              formation:
                baseFormation({
                  stateBefore:
                    'WAITING_THIRD',

                  stateAfter:
                    'WAITING_FIRST',

                  firstNumber:
                    11,

                  secondNumber:
                    20,

                  spin:
                    0,

                  settlement:
                    'VOID',

                  trioDiscarded:
                    true,

                  reasons: [
                    'TRIPLICACAO_ZERO_POSITION:3',
                  ],
                }),
            }),
          );

        expect(
          result.state,
        ).toBe(
          'VOID',
        );

        expect(
          result.reason,
        ).toBe(
          'TRIPLICACAO_ZERO_DISCARDED_FORMATION',
        );
      },
    );


    test(
      'describes stake block with blocker reason',
      () => {
        const result =
          observability.observe(
            baseResult({
              event:
                'STAKE_BLOCKED',

              financialRecommendation: {
                blockers: [
                  'PAPER_STAKE_STRATEGY_RISK_TOO_HIGH',
                ],
              },
            }),
          );

        expect(
          result.state,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.reason,
        ).toContain(
          'PAPER_STAKE_STRATEGY_RISK_TOO_HIGH',
        );
      },
    );


    test(
      'describes capital stop',
      () => {
        const result =
          observability.observe(
            baseResult({
              event:
                'CAPITAL_STOP',

              financialRecommendation: {
                capital: {
                  stopReason:
                    'MAX_DRAWDOWN_REACHED',
                },
              },
            }),
          );

        expect(
          result.state,
        ).toBe(
          'STOP',
        );

        expect(
          result.reason,
        ).toBe(
          'MAX_DRAWDOWN_REACHED',
        );
      },
    );


    test(
      'status exposes institutional live state',
      () => {
        const lines =
          observability.status({
            sessionId:
              'paper-test',

            formationState:
              'WAITING_SECOND',

            pendingSignalId:
              null,

            pendingOperatorDecision:
              null,

            totalRecordedSignals:
              3,

            institutionalMode:
              true,

            currentBankroll:
              29.40,

            peakBankroll:
              30,

            pendingLossDebt:
              0.60,

            capitalDecision:
              'ALLOW',

            martingaleEnabled:
              true,

            postSync: {
              mode:
                'LIVE',
            },

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
          });

        const text =
          lines.join(
            '\n',
          );

        expect(
          text,
        ).toContain(
          'R$ 29,40',
        );

        expect(
          text,
        ).toContain(
          'R$ 0,60',
        );

        expect(
          text,
        ).toContain(
          'Martingale .......... ON',
        );

        expect(
          text,
        ).toContain(
          'Fronteira ........... LIVE',
        );
      },
    );


    test(
      'observability never changes manual-only invariant',
      () => {
        const result =
          observability.observe(
            baseResult(),
          );

        expect(
          result.recommendationOnly,
        ).toBe(
          true,
        );

        expect(
          result.humanExecutionRequired,
        ).toBe(
          true,
        );

        expect(
          result.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );
      },
    );
  },
);
