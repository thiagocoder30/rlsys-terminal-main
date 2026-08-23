const {
  TriplicacaoShadowAdapter,
} = require(
  '../../../dist/application/runtime/TriplicacaoShadowAdapter.js',
);


function analysis(
  pattern = 'TC',
  overrides = {},
) {
  return {
    baseAnalysis: {
      validTrioCount:
        12,

      minValidTrios:
        12,
    },

    metrics:
      [],

    selectedPatternKind:
      pattern,

    advancedEvidenceScore:
      83,

    advancedConfidenceScore:
      0.81,

    advancedRiskScore:
      0.19,

    probabilityMode:
      'PAPER_ONLY',

    liveMoneyAuthorized:
      false,

    reasons:
      [],

    warnings:
      [],

    blockers:
      [],

    ...overrides,
  };
}


function adapter(
  overrides = {},
) {
  return new TriplicacaoShadowAdapter(
    overrides,

    {
      analyze() {
        return analysis();
      },
    },
  );
}


function context(
  overrides = {},
) {
  return {
    initialBankroll:
      30,

    currentBankroll:
      30,

    peakBankroll:
      30,

    riskMode:
      'moderate',

    provider:
      'PRAGMATIC',

    minimumChipValue:
      0.10,

    capital: {
      decision:
        'ALLOW',

      recoveryAllowed:
        true,

      newRecommendationsAllowed:
        true,

      bankrollExposureAllowed:
        true,

      stopReason:
        null,

      warnings:
        [],

      blockers:
        [],
    },

    ...overrides,
  };
}


function alignedHistory() {
  /*
   * 36 historical spins + opening pair.
   *
   * first=1 RED
   * second=3 RED
   *
   * TC => target RED.
   */
  return [
    ...Array(
      36,
    ).fill(
      1,
    ),

    1,
    3,
  ];
}


describe(
  'TriplicacaoShadowAdapter',
  () => {
    test(
      'uses earliest nominal prospective history size 38',
      () => {
        expect(
          adapter()
            .minimumHistorySize,
        ).toBe(
          38,
        );
      },
    );


    test(
      'only evaluates second-position trio boundaries',
      () => {
        const runtime =
          adapter();

        expect(
          runtime.evaluate(
            Array(
              39,
            ).fill(
              1,
            ),
          ),
        ).toBeNull();

        expect(
          runtime.evaluate(
            Array(
              40,
            ).fill(
              1,
            ),
          ),
        ).toBeNull();
      },
    );


    test(
      'creates TC RED prospective decision from aligned opening pair',
      () => {
        const decision =
          adapter()
            .evaluate(
              alignedHistory(),
            );

        expect(
          decision,
        ).not.toBeNull();

        expect(
          decision.strategyId,
        ).toBe(
          'triplicacao',
        );

        expect(
          decision.metadata
            .selectedPatternKind,
        ).toBe(
          'TC',
        );

        expect(
          decision.metadata
            .firstNumber,
        ).toBe(
          1,
        );

        expect(
          decision.metadata
            .secondNumber,
        ).toBe(
          3,
        );

        expect(
          decision.metadata
            .targetColor,
        ).toBe(
          'RED',
        );
      },
    );


    test(
      'zero in opening pair produces no decision',
      () => {
        const runtime =
          adapter();

        expect(
          runtime.evaluate([
            ...Array(
              36,
            ).fill(
              1,
            ),

            0,
            3,
          ]),
        ).toBeNull();

        expect(
          runtime.evaluate([
            ...Array(
              36,
            ).fill(
              1,
            ),

            1,
            0,
          ]),
        ).toBeNull();
      },
    );


    test(
      'moderate bankroll 30 recommends base stake 0.60',
      () => {
        const runtime =
          adapter();

        const decision =
          runtime.evaluate(
            alignedHistory(),
          );

        const trade =
          runtime.prepare(
            decision,
            context(),
          );

        expect(
          trade,
        ).not.toBeNull();

        expect(
          trade.stake,
        ).toBe(
          0.60,
        );

        expect(
          trade.metadata
            .baseStakeAmount,
        ).toBe(
          0.60,
        );

        expect(
          trade.metadata
            .recoveryComponent,
        ).toBe(
          0,
        );
      },
    );


    test(
      'RED hit settles even-money WIN',
      () => {
        const runtime =
          adapter();

        const decision =
          runtime.evaluate(
            alignedHistory(),
          );

        const trade =
          runtime.prepare(
            decision,
            context(),
          );

        const settlement =
          runtime.settle(
            trade,
            5,
          );

        expect(
          settlement.outcome,
        ).toBe(
          'WIN',
        );

        expect(
          settlement.stake,
        ).toBe(
          0.60,
        );

        expect(
          settlement.grossReturn,
        ).toBe(
          1.20,
        );

        expect(
          settlement.pnl,
        ).toBe(
          0.60,
        );
      },
    );


    test(
      'BLACK miss settles LOSS',
      () => {
        const runtime =
          adapter();

        const decision =
          runtime.evaluate(
            alignedHistory(),
          );

        const trade =
          runtime.prepare(
            decision,
            context(),
          );

        const settlement =
          runtime.settle(
            trade,
            2,
          );

        expect(
          settlement.outcome,
        ).toBe(
          'LOSS',
        );

        expect(
          settlement.grossReturn,
        ).toBe(
          0,
        );

        expect(
          settlement.pnl,
        ).toBe(
          -0.60,
        );

        expect(
          runtime
            .recoverySnapshot()
            .pendingLossDebt,
        ).toBe(
          0.60,
        );
      },
    );


    test(
      'third-position zero is statistical VOID but financial loss',
      () => {
        const runtime =
          adapter();

        const decision =
          runtime.evaluate(
            alignedHistory(),
          );

        const trade =
          runtime.prepare(
            decision,
            context(),
          );

        const settlement =
          runtime.settle(
            trade,
            0,
          );

        expect(
          settlement.outcome,
        ).toBe(
          'VOID',
        );

        expect(
          settlement.grossReturn,
        ).toBe(
          0,
        );

        expect(
          settlement.pnl,
        ).toBe(
          -0.60,
        );

        expect(
          runtime
            .recoverySnapshot()
            .pendingLossDebt,
        ).toBe(
          0.60,
        );
      },
    );


    test(
      'martingale off never adds recovery component',
      () => {
        const runtime =
          adapter({
            martingaleEnabled:
              false,
          });

        const firstDecision =
          runtime.evaluate(
            alignedHistory(),
          );

        const firstTrade =
          runtime.prepare(
            firstDecision,
            context(),
          );

        runtime.settle(
          firstTrade,
          2,
        );

        expect(
          runtime
            .recoverySnapshot()
            .pendingLossDebt,
        ).toBe(
          0.60,
        );

        const secondTrade =
          runtime.prepare(
            firstDecision,
            context({
              currentBankroll:
                29.40,

              peakBankroll:
                30,
            }),
          );

        expect(
          secondTrade
            .metadata
            .recoveryComponent,
        ).toBe(
          0,
        );
      },
    );


    test(
      'martingale on means controlled recovery only',
      () => {
        const runtime =
          adapter({
            martingaleEnabled:
              true,
          });

        const decision =
          runtime.evaluate(
            alignedHistory(),
          );

        const lossTrade =
          runtime.prepare(
            decision,
            context(),
          );

        runtime.settle(
          lossTrade,
          2,
        );

        const recoveryTrade =
          runtime.prepare(
            decision,
            context({
              currentBankroll:
                29.40,

              peakBankroll:
                30,
            }),
          );

        expect(
          recoveryTrade,
        ).not.toBeNull();

        expect(
          recoveryTrade.stake,
        ).toBeGreaterThanOrEqual(
          recoveryTrade
            .metadata
            .baseStakeAmount,
        );

        expect(
          recoveryTrade
            .metadata
            .recoveryComponent,
        ).toBeGreaterThanOrEqual(
          0,
        );

        expect(
          recoveryTrade.stake,
        ).toBeLessThanOrEqual(
          29.40,
        );
      },
    );


    test(
      'adapter has no execution or real-bankroll API',
      () => {
        const runtime =
          adapter();

        expect(
          runtime.executeBet,
        ).toBeUndefined();

        expect(
          runtime.placeBet,
        ).toBeUndefined();

        expect(
          runtime.setBankroll,
        ).toBeUndefined();
      },
    );
  },
);
