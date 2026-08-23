const {
  HistoricalShadowReplayEngine,
} = require(
  '../../../dist/application/runtime/HistoricalShadowReplayEngine.js',
);

const {
  FusionReducedShadowAdapter,
} = require(
  '../../../dist/application/runtime/FusionReducedShadowAdapter.js',
);


function eligibleBaseHistory() {
  /*
   * 80 spins.
   *
   * Overall:
   * 48 / 80 = 60%
   *
   * Recent:
   * 15 / 24 = 62.5%
   *
   * Prefix 80 is analytically eligible for Fusion Reduced.
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


function pragmatic(
  overrides = {},
) {
  return {
    initialBankroll:
      100,

    riskMode:
      'moderate',

    provider:
      'PRAGMATIC',

    minimumChipValue:
      0.10,

    ...overrides,
  };
}


describe(
  'Fusion Reduced historical SHADOW integration',
  () => {
    test(
      'replays Fusion with strict historical t to t-plus-one chronology',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...eligibleBaseHistory(),
                23,
              ],

              new FusionReducedShadowAdapter(),

              pragmatic(),
            );

        expect(
          result.strategyId,
        ).toBe(
          'fusion-reduced',
        );

        expect(
          result.lookAheadAllowed,
        ).toBe(
          false,
        );

        expect(
          result.totalSpins,
        ).toBe(
          81,
        );

        expect(
          result.minimumHistorySize,
        ).toBe(
          74,
        );

        expect(
          result.decisionPointCount,
        ).toBe(
          7,
        );

        expect(
          result.tradeCount,
        ).toBeGreaterThan(
          0,
        );

        for (
          const trade of
          result.trades
        ) {
          expect(
            trade.settlementSpinIndex,
          ).toBe(
            trade.decisionSpinIndex +
            1,
          );

          expect(
            trade.settlementSpinIndex,
          ).toBe(
            trade.decisionHistorySize,
          );
        }
      },
    );


    test(
      'dynamic bankroll may financially block a later analytically valid Fusion signal',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...eligibleBaseHistory(),
                23,
              ],

              new FusionReducedShadowAdapter(),

              pragmatic({
                initialBankroll:
                  100,
              }),
            );

        /*
         * Moderate:
         *
         * Initial safe cap = 2% × R$100 = R$2.
         * Executable Fusion layout = R$1.90.
         *
         * Three early losses:
         *
         * R$100.00 - R$5.70 = R$94.30.
         *
         * New safe cap:
         *
         * 2% × 94.30 = 1.886
         *
         * Resolver -> R$1.80.
         *
         * But minimum complete Fusion layout remains:
         *
         * 19 × R$0.10 = R$1.90.
         *
         * Therefore later analytical signals are financially
         * blocked rather than forcing additional risk.
         */
        expect(
          result.tradeCount,
        ).toBe(
          3,
        );

        expect(
          result.lossCount,
        ).toBe(
          3,
        );

        expect(
          result.currentBankroll,
        ).toBe(
          94.30,
        );

        expect(
          result.totalPnl,
        ).toBe(
          -5.70,
        );

        expect(
          result.financiallyBlockedDecisionCount,
        ).toBeGreaterThanOrEqual(
          1,
        );

        const lastTrade =
          result.trades[
            result.trades.length -
            1
          ];

        expect(
          lastTrade.decisionHistorySize,
        ).toBe(
          76,
        );

        expect(
          lastTrade.settlementSpin,
        ).toBe(
          0,
        );

        expect(
          lastTrade.settlement.outcome,
        ).toBe(
          'LOSS',
        );
      },
    );


    test(
      'Capital Preservation can stop Fusion before a later analytically valid signal',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...eligibleBaseHistory(),
                23,
              ],

              new FusionReducedShadowAdapter(),

              pragmatic({
                initialBankroll:
                  500,

                riskMode:
                  'moderate',
              }),
            );

        /*
         * Moderate allows approximately 2% exposure.
         *
         * With R$500 the complete Fusion layout is initially
         * R$9.50.
         *
         * The historical sequence immediately preceding
         * prefix 80 produces consecutive losses.
         *
         * Capital Preservation reaches the moderate stop-loss
         * before a new trade can be opened at prefix 80.
         */
        expect(
          result.capitalStop,
        ).toBe(
          true,
        );

        expect(
          result.capitalStopReason,
        ).toBe(
          'STOP_LOSS_REACHED',
        );

        expect(
          result.trades.find(
            (trade) =>
              trade.decisionHistorySize ===
              80,
          ),
        ).toBeUndefined();

        expect(
          result.capitalBlockedDecisionPointCount,
        ).toBeGreaterThanOrEqual(
          1,
        );
      },
    );


    test(
      'conservative sizing keeps prefix-80 Fusion executable and settles it on spin 81',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...eligibleBaseHistory(),

                /*
                 * Invisible to evaluate(prefix 80).
                 * Used exclusively as t+1 settlement.
                 */
                23,
              ],

              new FusionReducedShadowAdapter(),

              pragmatic({
                initialBankroll:
                  500,

                riskMode:
                  'conservative',
              }),
            );

        /*
         * Conservative cap:
         *
         * 1% × R$500 = R$5.
         *
         * Physical Fusion quantization:
         *
         * 2 complete chip layers
         * = 19 × R$0.20
         * = R$3.80.
         *
         * Six preceding losses cost R$22.80,
         * leaving the drawdown below the 5% stop threshold
         * before the prefix-80 decision.
         */
        const tradeAtPrefix80 =
          result.trades.find(
            (trade) =>
              trade.decisionHistorySize ===
              80,
          );

        expect(
          tradeAtPrefix80,
        ).toBeDefined();

        expect(
          tradeAtPrefix80.decisionSpinIndex,
        ).toBe(
          79,
        );

        expect(
          tradeAtPrefix80.settlementSpinIndex,
        ).toBe(
          80,
        );

        expect(
          tradeAtPrefix80.settlementSpin,
        ).toBe(
          23,
        );

        expect(
          tradeAtPrefix80.settlement.outcome,
        ).toBe(
          'WIN',
        );

        expect(
          tradeAtPrefix80.settlement.pnl,
        ).toBeGreaterThan(
          0,
        );

        expect(
          tradeAtPrefix80.executableTrade.stake,
        ).toBeLessThanOrEqual(
          tradeAtPrefix80.bankrollBefore *
          0.01 +
          0.001,
        );
      },
    );


    test(
      'calculates BRL bankroll from real Fusion payout semantics',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...eligibleBaseHistory(),
                23,
              ],

              new FusionReducedShadowAdapter(),

              pragmatic({
                initialBankroll:
                  500,

                riskMode:
                  'conservative',
              }),
            );

        expect(
          result.totalStake,
        ).toBeGreaterThan(
          0,
        );

        expect(
          result.grossReturn,
        ).toBeGreaterThanOrEqual(
          0,
        );

        expect(
          result.currentBankroll,
        ).toBeCloseTo(
          result.initialBankroll +
          result.totalPnl,
          2,
        );

        for (
          const trade of
          result.trades
        ) {
          expect(
            trade.bankrollAfter,
          ).toBeCloseTo(
            trade.bankrollBefore +
            trade.settlement.pnl,
            2,
          );
        }
      },
    );


    test(
      'provider economics can block an otherwise valid Fusion signal',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...eligibleBaseHistory(),
                23,
              ],

              new FusionReducedShadowAdapter(),

              {
                initialBankroll:
                  100,

                riskMode:
                  'moderate',

                provider:
                  'EVOLUTION',

                minimumChipValue:
                  0.50,
              },
            );

        /*
         * Moderate cap:
         *
         * 2% × R$100 = R$2.
         *
         * Minimum Evolution Fusion layout:
         *
         * 19 × R$0.50 = R$9.50.
         */
        expect(
          result.financiallyBlockedDecisionCount,
        ).toBeGreaterThanOrEqual(
          1,
        );

        expect(
          result.tradeCount,
        ).toBe(
          0,
        );

        expect(
          result.currentBankroll,
        ).toBe(
          100,
        );

        expect(
          result.totalPnl,
        ).toBe(
          0,
        );
      },
    );


    test(
      'Shadow changes simulated bankroll only',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...eligibleBaseHistory(),
                23,
              ],

              new FusionReducedShadowAdapter(),

              pragmatic(),
            );

        expect(
          result.bankrollChangedInSimulationOnly,
        ).toBe(
          true,
        );

        expect(
          result.realBankrollChanged,
        ).toBe(
          false,
        );

        expect(
          result.automaticExecution,
        ).toBe(
          false,
        );
      },
    );
  },
);
