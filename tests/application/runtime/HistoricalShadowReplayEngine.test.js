const {
  HistoricalShadowReplayEngine,
} = require(
  '../../../dist/application/runtime/HistoricalShadowReplayEngine.js',
);


function configuration(
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


function adapter({
  minimumHistorySize = 3,
  actionableWhen = () => true,
  stake = 1,
  pnlResolver = (nextSpin) =>
    nextSpin % 2 === 0
      ? 1
      : -1,
} = {}) {
  return {
    strategyId:
      'test-shadow',

    minimumHistorySize,

    evaluate(
      visibleHistory,
    ) {
      if (
        !actionableWhen(
          visibleHistory,
        )
      ) {
        return null;
      }

      return {
        strategyId:
          'test-shadow',

        strategyRiskScore:
          0.20,

        metadata: {
          visibleHistory: [
            ...visibleHistory,
          ],
        },
      };
    },

    prepare(
      decision,
      context,
    ) {
      return {
        strategyId:
          decision.strategyId,

        stake,

        metadata: {
          bankroll:
            context.currentBankroll,

          capitalDecision:
            context.capital.decision,
        },
      };
    },

    settle(
      trade,
      nextSpin,
    ) {
      const pnl =
        pnlResolver(
          nextSpin,
        );

      return {
        outcome:
          pnl >
            0
            ? 'WIN'
            : pnl <
                0
              ? 'LOSS'
              : 'VOID',

        stake:
          trade.stake,

        grossReturn:
          pnl >
            0
            ? trade.stake +
              pnl
            : pnl ===
                0
              ? trade.stake
              : 0,

        pnl,
      };
    },
  };
}


describe(
  'HistoricalShadowReplayEngine',
  () => {
    test(
      'creates decision points only after warmup',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                1,
                2,
                3,
                4,
                5,
                6,
              ],

              adapter(),

              configuration(),
            );

        expect(
          result.warmupSpins,
        ).toBe(
          3,
        );

        expect(
          result.decisionPointCount,
        ).toBe(
          3,
        );

        expect(
          result.evaluatedDecisionPointCount,
        ).toBe(
          3,
        );
      },
    );


    test(
      'never exposes settlement spin to evaluate',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                1,
                2,
                3,
                36,
              ],

              adapter(),

              configuration(),
            );

        const trade =
          result.trades[0];

        expect(
          trade.decision
            .metadata
            .visibleHistory,
        ).toEqual([
          1,
          2,
          3,
        ]);

        expect(
          trade.decision
            .metadata
            .visibleHistory,
        ).not.toContain(
          36,
        );

        expect(
          trade.settlementSpin,
        ).toBe(
          36,
        );
      },
    );


    test(
      'preserves strict t to t-plus-one chronology',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                10,
                11,
                12,
                13,
              ],

              adapter(),

              configuration(),
            );

        expect(
          result.trades[0]
            .decisionSpinIndex,
        ).toBe(
          2,
        );

        expect(
          result.trades[0]
            .settlementSpinIndex,
        ).toBe(
          3,
        );

        expect(
          result.trades[0]
            .decisionSpin,
        ).toBe(
          12,
        );

        expect(
          result.trades[0]
            .settlementSpin,
        ).toBe(
          13,
        );
      },
    );


    test(
      'updates simulated bankroll after every settlement',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                1,
                2,
                3,
                4,
                6,
              ],

              adapter(),

              configuration({
                initialBankroll:
                  100,
              }),
            );

        expect(
          result.trades[0]
            .bankrollBefore,
        ).toBe(
          100,
        );

        expect(
          result.trades[0]
            .bankrollAfter,
        ).toBe(
          101,
        );

        expect(
          result.trades[1]
            .bankrollBefore,
        ).toBe(
          101,
        );

        expect(
          result.trades[1]
            .bankrollAfter,
        ).toBe(
          102,
        );

        expect(
          result.currentBankroll,
        ).toBe(
          102,
        );
      },
    );


    test(
      'tracks peak bankroll independently from current bankroll',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                1,
                2,
                3,
                4,
                5,
              ],

              adapter(),

              configuration(),
            );

        /*
         * +1 then -1
         *
         * bankroll:
         * 100 -> 101 -> 100
         */
        expect(
          result.currentBankroll,
        ).toBe(
          100,
        );

        expect(
          result.peakBankroll,
        ).toBe(
          101,
        );

        expect(
          result.maxDrawdownAmount,
        ).toBe(
          1,
        );
      },
    );


    test(
      'distinguishes no signal from financially blocked decision',
      () => {
        const custom =
          adapter({
            actionableWhen(
              visibleHistory,
            ) {
              return (
                visibleHistory.length %
                2 ===
                1
              );
            },
          });

        const originalPrepare =
          custom.prepare;

        custom.prepare =
          function (
            decision,
            context,
          ) {
            if (
              context.currentBankroll ===
              100
            ) {
              return null;
            }

            return originalPrepare(
              decision,
              context,
            );
          };

        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                1,
                2,
                3,
                4,
                5,
                6,
              ],

              custom,

              configuration(),
            );

        expect(
          result.financiallyBlockedDecisionCount,
        ).toBeGreaterThanOrEqual(
          1,
        );

        expect(
          result.noSignalDecisionPointCount,
        ).toBeGreaterThanOrEqual(
          1,
        );
      },
    );


    test(
      'capital STOP prevents every subsequent historical exposure',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                1,
                2,
                3,

                /*
                 * Five consecutive losses of R$ 1 with
                 * conservative bankroll R$ 100.
                 *
                 * Stop-loss = 5%.
                 */
                1,
                1,
                1,
                1,
                1,

                /*
                 * These spins must never open new trades.
                 */
                2,
                2,
                2,
              ],

              adapter({
                pnlResolver:
                  () =>
                    -1,
              }),

              configuration({
                initialBankroll:
                  100,

                riskMode:
                  'conservative',
              }),
            );

        expect(
          result.currentBankroll,
        ).toBe(
          95,
        );

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
          result.tradeCount,
        ).toBe(
          5,
        );

        expect(
          result.capitalBlockedDecisionPointCount,
        ).toBe(
          3,
        );
      },
    );


    test(
      'capital stop-win also stops subsequent exposure',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                1,
                2,
                3,
                2,
                2,
                2,
                2,
                2,
                2,
              ],

              adapter({
                stake:
                  10,

                pnlResolver:
                  () =>
                    10,
              }),

              configuration({
                initialBankroll:
                  100,

                riskMode:
                  'conservative',
              }),
            );

        /*
         * Conservative stop-win = +10%.
         *
         * First trade takes 100 -> 110.
         * No second trade is permitted.
         */
        expect(
          result.tradeCount,
        ).toBe(
          1,
        );

        expect(
          result.currentBankroll,
        ).toBe(
          110,
        );

        expect(
          result.capitalStopReason,
        ).toBe(
          'STOP_WIN_REACHED',
        );
      },
    );


    test(
      'calculates financial totals from dynamic bankroll replay',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                1,
                2,
                3,
                4,
                5,
                6,
              ],

              adapter(),

              configuration(),
            );

        /*
         * WIN +1
         * LOSS -1
         * WIN +1
         */
        expect(
          result.winCount,
        ).toBe(
          2,
        );

        expect(
          result.lossCount,
        ).toBe(
          1,
        );

        expect(
          result.totalStake,
        ).toBe(
          3,
        );

        expect(
          result.totalPnl,
        ).toBe(
          1,
        );

        expect(
          result.currentBankroll,
        ).toBe(
          101,
        );

        expect(
          result.roiPercent,
        ).toBeCloseTo(
          33.3333,
          4,
        );

        expect(
          result.bankrollReturnPercent,
        ).toBe(
          1,
        );
      },
    );


    test(
      'rejects a trade larger than simulated bankroll',
      () => {
        expect(
          () =>
            new HistoricalShadowReplayEngine()
              .replay(
                [
                  1,
                  2,
                  3,
                  4,
                ],

                adapter({
                  stake:
                    101,
                }),

                configuration({
                  initialBankroll:
                    100,
                }),
              ),
        ).toThrow(
          'historical_shadow_trade_exceeds_bankroll',
        );
      },
    );


    test(
      'never changes real bankroll and exposes no betting API',
      () => {
        const engine =
          new HistoricalShadowReplayEngine();

        const result =
          engine.replay(
            [
              1,
              2,
              3,
              4,
            ],

            adapter(),

            configuration(),
          );

        expect(
          result.historicalShadow,
        ).toBe(
          true,
        );

        expect(
          result.lookAheadAllowed,
        ).toBe(
          false,
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

        expect(
          engine.executeBet,
        ).toBeUndefined();

        expect(
          engine.placeBet,
        ).toBeUndefined();

        expect(
          engine.setBankroll,
        ).toBeUndefined();
      },
    );
  },
);
