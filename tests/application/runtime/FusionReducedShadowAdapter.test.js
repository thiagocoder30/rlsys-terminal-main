const {
  FusionReducedShadowAdapter,
} = require(
  '../../../dist/application/runtime/FusionReducedShadowAdapter.js',
);


const TARGET = [
  17, 34, 6,
  27, 13, 36,
  11, 30, 8,
  23,
  10, 5, 24,
  16, 33, 1,
  20, 14, 31,
];


function eligibleHistory() {
  /*
   * 80 spins.
   *
   * Overall:
   * 48 / 80 = 60%
   *
   * Recent:
   * 15 / 24 = 62.5%
   */
  return [
    ...Array(
      33,
    ).fill(
      23,
    ),

    ...Array(
      23,
    ).fill(
      0,
    ),

    ...Array(
      15,
    ).fill(
      23,
    ),

    ...Array(
      9,
    ).fill(
      0,
    ),
  ];
}


function context(
  overrides = {},
) {
  return {
    initialBankroll:
      100,

    currentBankroll:
      100,

    peakBankroll:
      100,

    riskMode:
      'moderate',

    provider:
      'PRAGMATIC',

    minimumChipValue:
      0.10,

    capital: {
      decision:
        'ALLOW',

      stopReason:
        null,

      newRecommendationsAllowed:
        true,

      bankrollExposureAllowed:
        true,
    },

    ...overrides,
  };
}


describe(
  'FusionReducedShadowAdapter',
  () => {
    test(
      'uses canonical minimum sample size 74',
      () => {
        const adapter =
          new FusionReducedShadowAdapter();

        expect(
          adapter.minimumHistorySize,
        ).toBe(
          74,
        );
      },
    );


    test(
      'does not create a shadow decision when evidence is blocked',
      () => {
        const adapter =
          new FusionReducedShadowAdapter();

        const decision =
          adapter.evaluate(
            Array(
              74,
            ).fill(
              0,
            ),
          );

        expect(
          decision,
        ).toBeNull();
      },
    );


    test(
      'creates decision only from canonical PAPER_READY semantics',
      () => {
        const adapter =
          new FusionReducedShadowAdapter();

        const decision =
          adapter.evaluate(
            eligibleHistory(),
          );

        expect(
          decision,
        ).not.toBeNull();

        expect(
          decision.strategyId,
        ).toBe(
          'fusion-reduced',
        );

        expect(
          decision.strategyRiskScore,
        ).toBeGreaterThanOrEqual(
          0,
        );

        expect(
          decision.strategyRiskScore,
        ).toBeLessThanOrEqual(
          1,
        );

        expect(
          decision.metadata.targetNumbers,
        ).toEqual(
          TARGET,
        );

        expect(
          decision.metadata.targetCenter,
        ).toBe(
          23,
        );

        expect(
          decision.metadata.targetCoverage,
        ).toBe(
          19,
        );
      },
    );


    test(
      'Pragmatic moderate bankroll BRL 100 builds BRL 1.90 Fusion layout',
      () => {
        const adapter =
          new FusionReducedShadowAdapter();

        const decision =
          adapter.evaluate(
            eligibleHistory(),
          );

        const trade =
          adapter.prepare(
            decision,
            context(),
          );

        /*
         * Moderate cap:
         * 2% × 100 = R$ 2,00.
         *
         * Fusion physical layout:
         * 19 × R$ 0,10 = R$ 1,90.
         */
        expect(
          trade,
        ).not.toBeNull();

        expect(
          trade.stake,
        ).toBe(
          1.90,
        );

        expect(
          trade.metadata.authorizedMaximumTotalStake,
        ).toBe(
          2,
        );

        expect(
          trade.metadata.stakePerNumber,
        ).toBe(
          0.10,
        );

        expect(
          trade.metadata.chipsPerNumber,
        ).toBe(
          1,
        );
      },
    );


    test(
      'authorized stake is treated as TOTAL exposure not per-number stake',
      () => {
        const adapter =
          new FusionReducedShadowAdapter();

        const decision =
          adapter.evaluate(
            eligibleHistory(),
          );

        const trade =
          adapter.prepare(
            decision,
            context(),
          );

        expect(
          trade.metadata.authorizedMaximumTotalStake,
        ).toBe(
          2,
        );

        expect(
          trade.stake,
        ).toBeLessThanOrEqual(
          2,
        );

        expect(
          trade.stake,
        ).not.toBe(
          38,
        );
      },
    );


    test(
      'Evolution blocks Fusion when safe bankroll exposure cannot fund 19 chips',
      () => {
        const adapter =
          new FusionReducedShadowAdapter();

        const decision =
          adapter.evaluate(
            eligibleHistory(),
          );

        const trade =
          adapter.prepare(
            decision,
            context({
              provider:
                'EVOLUTION',

              minimumChipValue:
                0.50,
            }),
          );

        /*
         * Safe moderate cap = R$ 2.
         * Minimum Fusion Evolution layout = R$ 9.50.
         */
        expect(
          trade,
        ).toBeNull();
      },
    );


    test(
      'larger bankroll can fund Evolution without violating percentage cap',
      () => {
        const adapter =
          new FusionReducedShadowAdapter();

        const decision =
          adapter.evaluate(
            eligibleHistory(),
          );

        const trade =
          adapter.prepare(
            decision,
            context({
              initialBankroll:
                500,

              currentBankroll:
                500,

              peakBankroll:
                500,

              provider:
                'EVOLUTION',

              minimumChipValue:
                0.50,
            }),
          );

        /*
         * Moderate cap:
         * 2% × 500 = R$ 10.
         *
         * One Fusion layout:
         * 19 × R$ 0.50 = R$ 9.50.
         */
        expect(
          trade,
        ).not.toBeNull();

        expect(
          trade.metadata.authorizedMaximumTotalStake,
        ).toBe(
          10,
        );

        expect(
          trade.stake,
        ).toBe(
          9.50,
        );
      },
    );


    test(
      'Pragmatic minimum Fusion WIN settles BRL plus 1.70',
      () => {
        const adapter =
          new FusionReducedShadowAdapter();

        const decision =
          adapter.evaluate(
            eligibleHistory(),
          );

        const trade =
          adapter.prepare(
            decision,
            context(),
          );

        const settlement =
          adapter.settle(
            trade,
            23,
          );

        expect(
          settlement.outcome,
        ).toBe(
          'WIN',
        );

        expect(
          settlement.stake,
        ).toBe(
          1.90,
        );

        expect(
          settlement.grossReturn,
        ).toBe(
          3.60,
        );

        expect(
          settlement.pnl,
        ).toBe(
          1.70,
        );
      },
    );


    test(
      'Pragmatic minimum Fusion LOSS settles BRL minus 1.90',
      () => {
        const adapter =
          new FusionReducedShadowAdapter();

        const decision =
          adapter.evaluate(
            eligibleHistory(),
          );

        const trade =
          adapter.prepare(
            decision,
            context(),
          );

        const settlement =
          adapter.settle(
            trade,
            0,
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
          -1.90,
        );
      },
    );


    test(
      'zero is a normal LOSS because it is outside canonical Fusion target',
      () => {
        const adapter =
          new FusionReducedShadowAdapter();

        expect(
          adapter
            .doctrineSnapshot()
            .targetNumbers,
        ).not.toContain(
          0,
        );

        const decision =
          adapter.evaluate(
            eligibleHistory(),
          );

        const trade =
          adapter.prepare(
            decision,
            context(),
          );

        expect(
          adapter
            .settle(
              trade,
              0,
            )
            .outcome,
        ).toBe(
          'LOSS',
        );
      },
    );


    test(
      'exposes no automatic betting or bankroll mutation API',
      () => {
        const adapter =
          new FusionReducedShadowAdapter();

        expect(
          adapter.executeBet,
        ).toBeUndefined();

        expect(
          adapter.placeBet,
        ).toBeUndefined();

        expect(
          adapter.setBankroll,
        ).toBeUndefined();

        expect(
          adapter.changeBankroll,
        ).toBeUndefined();
      },
    );
  },
);
