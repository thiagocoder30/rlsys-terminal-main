const {
  HistoricalShadowReplayEngine,
} = require(
  '../../../dist/application/runtime/HistoricalShadowReplayEngine.js',
);

const {
  TriplicacaoShadowAdapter,
} = require(
  '../../../dist/application/runtime/TriplicacaoShadowAdapter.js',
);


function paperAnalysis(
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
        return paperAnalysis();
      },
    },
  );
}


function pragmatic(
  overrides = {},
) {
  return {
    initialBankroll:
      30,

    riskMode:
      'moderate',

    provider:
      'PRAGMATIC',

    minimumChipValue:
      0.10,

    ...overrides,
  };
}


/*
 * Historical warm-up:
 *
 * 36 spins = twelve complete red TC trios.
 *
 * We inject the analytical report in these integration tests so the
 * purpose here is not to retest AdvancedProbability mathematics.
 *
 * The purpose is to certify:
 *
 * chronology
 * trio alignment
 * financial settlement
 * bankroll
 * recovery debt
 * Capital Preservation
 */
function warmup() {
  return Array(
    36,
  ).fill(
    1,
  );
}


describe(
  'Triplicacao historical SHADOW integration',
  () => {
    test(
      'starts only at the first valid prospective second-position boundary',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...warmup(),

                /*
                 * New prospective trio:
                 *
                 * first  = RED
                 * second = RED
                 *
                 * prefix size = 38
                 *
                 * TC => target RED
                 */
                1,
                3,

                /*
                 * Third position / settlement only.
                 */
                5,
              ],

              adapter(),

              pragmatic(),
            );

        expect(
          result.strategyId,
        ).toBe(
          'triplicacao',
        );

        expect(
          result.minimumHistorySize,
        ).toBe(
          38,
        );

        expect(
          result.warmupSpins,
        ).toBe(
          38,
        );

        expect(
          result.decisionPointCount,
        ).toBe(
          1,
        );

        expect(
          result.tradeCount,
        ).toBe(
          1,
        );

        expect(
          result.lookAheadAllowed,
        ).toBe(
          false,
        );

        const trade =
          result.trades[0];

        expect(
          trade.decisionHistorySize,
        ).toBe(
          38,
        );

        expect(
          trade.decisionSpinIndex,
        ).toBe(
          37,
        );

        expect(
          trade.settlementSpinIndex,
        ).toBe(
          38,
        );

        expect(
          trade.settlementSpin,
        ).toBe(
          5,
        );
      },
    );


    test(
      'fixed trio alignment prevents decisions on first and third positions',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...warmup(),

                /*
                 * Trio 13:
                 */
                1,
                3,
                5,

                /*
                 * Trio 14:
                 */
                1,
                3,
                5,
              ],

              adapter(),

              pragmatic(),
            );

        /*
         * Eligible prefixes:
         *
         * size 38 -> after indexes 36/37
         * size 41 -> after indexes 39/40
         *
         * There must NOT be decisions at sizes:
         *
         * 39, 40, 42...
         */
        /*
         * HistoricalShadowReplayEngine counts every chronological
         * point after minimumHistorySize.
         *
         * With 42 total spins and minimumHistorySize=38:
         *
         * prefixes 38, 39, 40, 41 = 4 chronological points.
         *
         * Triplicacao itself is actionable only when
         * visibleHistory.length % 3 === 2:
         *
         * prefix 38 -> ACTIONABLE
         * prefix 39 -> no signal (third-position boundary)
         * prefix 40 -> no signal (first-position boundary)
         * prefix 41 -> ACTIONABLE
         *
         * Therefore:
         *
         * chronological decision points = 4
         * strategy trades              = 2
         * non-actionable aligned points = 2
         */
        expect(
          result.decisionPointCount,
        ).toBe(
          4,
        );

        expect(
          result.evaluatedDecisionPointCount,
        ).toBe(
          4,
        );

        expect(
          result.noSignalDecisionPointCount,
        ).toBe(
          2,
        );

        expect(
          result.trades,
        ).toHaveLength(
          2,
        );

        expect(
          result.trades.map(
            (trade) =>
              trade.decisionHistorySize,
          ),
        ).toEqual([
          38,
          41,
        ]);

        expect(
          result.trades.map(
            (trade) =>
              trade.settlementSpinIndex,
          ),
        ).toEqual([
          38,
          41,
        ]);
      },
    );


    test(
      'decision at second position settles exclusively on third position',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...warmup(),

                /*
                 * TC opening:
                 * RED / RED
                 *
                 * target = RED
                 */
                1,
                3,

                /*
                 * Third position BLACK.
                 *
                 * Must settle the already-frozen RED hypothesis.
                 */
                2,
              ],

              adapter(),

              pragmatic(),
            );

        expect(
          result.tradeCount,
        ).toBe(
          1,
        );

        const trade =
          result.trades[0];

        expect(
          trade.decision
            .metadata
            .firstNumber,
        ).toBe(
          1,
        );

        expect(
          trade.decision
            .metadata
            .secondNumber,
        ).toBe(
          3,
        );

        expect(
          trade.decision
            .metadata
            .targetColor,
        ).toBe(
          'RED',
        );

        expect(
          trade.settlementSpin,
        ).toBe(
          2,
        );

        expect(
          trade.settlement.outcome,
        ).toBe(
          'LOSS',
        );

        expect(
          trade.settlement.pnl,
        ).toBe(
          -0.60,
        );
      },
    );


    test(
      'two historical trios produce independent prospective settlements',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...warmup(),

                /*
                 * Trio 13:
                 *
                 * decision RED
                 * settlement BLACK => LOSS
                 */
                1,
                3,
                2,

                /*
                 * Trio 14:
                 *
                 * decision RED
                 * settlement RED => WIN
                 */
                1,
                3,
                5,
              ],

              adapter({
                martingaleEnabled:
                  false,
              }),

              pragmatic(),
            );

        expect(
          result.trades,
        ).toHaveLength(
          2,
        );

        expect(
          result.trades[0]
            .settlement
            .outcome,
        ).toBe(
          'LOSS',
        );

        expect(
          result.trades[1]
            .settlement
            .outcome,
        ).toBe(
          'WIN',
        );

        expect(
          result.trades[0]
            .decisionHistorySize,
        ).toBe(
          38,
        );

        expect(
          result.trades[1]
            .decisionHistorySize,
        ).toBe(
          41,
        );

        /*
         * Banca after first loss becomes the financial basis
         * for the second recommendation.
         */
        expect(
          result.trades[1]
            .bankrollBefore,
        ).toBe(
          result.trades[0]
            .bankrollAfter,
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
      'third-position zero is statistically VOID but financially loses RED BLACK stake',
      () => {
        const runtime =
          adapter();

        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...warmup(),

                1,
                3,

                /*
                 * Zero is the third position of the same fixed trio.
                 */
                0,
              ],

              runtime,

              pragmatic(),
            );

        expect(
          result.tradeCount,
        ).toBe(
          1,
        );

        const trade =
          result.trades[0];

        expect(
          trade.settlement.outcome,
        ).toBe(
          'VOID',
        );

        expect(
          trade.settlement.grossReturn,
        ).toBe(
          0,
        );

        expect(
          trade.settlement.pnl,
        ).toBe(
          -0.60,
        );

        expect(
          trade.bankrollAfter,
        ).toBe(
          29.40,
        );

        /*
         * Financial debt exists because an actual RED/BLACK
         * exposure loses to roulette zero.
         */
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
      'zero on third position does not shift the fixed trio grid',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...warmup(),

                /*
                 * Trio 13:
                 *
                 * opening valid, third zero.
                 */
                1,
                3,
                0,

                /*
                 * Trio 14 begins exactly here.
                 *
                 * The zero did NOT cause re-alignment.
                 */
                1,
                3,
                5,
              ],

              adapter({
                martingaleEnabled:
                  false,
              }),

              pragmatic(),
            );

        expect(
          result.trades,
        ).toHaveLength(
          2,
        );

        expect(
          result.trades.map(
            (trade) =>
              trade.decisionHistorySize,
          ),
        ).toEqual([
          38,
          41,
        ]);

        expect(
          result.trades[0]
            .settlement
            .outcome,
        ).toBe(
          'VOID',
        );

        expect(
          result.trades[1]
            .settlement
            .outcome,
        ).toBe(
          'WIN',
        );

        expect(
          result.trades[1]
            .decision
            .metadata
            .firstNumber,
        ).toBe(
          1,
        );

        expect(
          result.trades[1]
            .decision
            .metadata
            .secondNumber,
        ).toBe(
          3,
        );
      },
    );


    test(
      'zero in opening pair suppresses recommendation but remaining third position is still consumed',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...warmup(),

                /*
                 * Invalid fixed trio 13.
                 */
                0,
                3,
                5,

                /*
                 * Valid fixed trio 14.
                 */
                1,
                3,
                5,
              ],

              adapter(),

              pragmatic(),
            );

        /*
         * Prefix 38 is an aligned decision boundary but opening
         * contains zero, so evaluate() returns null.
         *
         * The third position at index 38 remains part of that
         * invalid trio and cannot start a new formation.
         *
         * Next valid decision is prefix 41.
         */
        expect(
          result.tradeCount,
        ).toBe(
          1,
        );

        expect(
          result.trades[0]
            .decisionHistorySize,
        ).toBe(
          41,
        );

        expect(
          result.trades[0]
            .decision
            .metadata
            .firstNumber,
        ).toBe(
          1,
        );

        expect(
          result.trades[0]
            .decision
            .metadata
            .secondNumber,
        ).toBe(
          3,
        );

        expect(
          result.trades[0]
            .settlementSpin,
        ).toBe(
          5,
        );
      },
    );


    test(
      'loss debt survives into a later trade when martingale is disabled',
      () => {
        const runtime =
          adapter({
            martingaleEnabled:
              false,
          });

        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...warmup(),

                /*
                 * LOSS
                 */
                1,
                3,
                2,

                /*
                 * WIN
                 */
                1,
                3,
                5,
              ],

              runtime,

              pragmatic(),
            );

        expect(
          result.tradeCount,
        ).toBe(
          2,
        );

        expect(
          result.trades[0]
            .executableTrade
            .metadata
            .recoveryComponent,
        ).toBe(
          0,
        );

        expect(
          result.trades[1]
            .executableTrade
            .metadata
            .recoveryComponent,
        ).toBe(
          0,
        );

        /*
         * A normal later WIN cannot erase historical debt when no
         * recovery component was actually authorized.
         */
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
      'controlled recovery never replaces base risk authority',
      () => {
        const runtime =
          adapter({
            martingaleEnabled:
              true,
          });

        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...warmup(),

                /*
                 * First trade loses and creates debt.
                 */
                1,
                3,
                2,

                /*
                 * Second opportunity can request controlled recovery.
                 */
                1,
                3,
                5,
              ],

              runtime,

              pragmatic(),
            );

        expect(
          result.tradeCount,
        ).toBe(
          2,
        );

        const first =
          result.trades[0];

        const second =
          result.trades[1];

        expect(
          first.settlement.outcome,
        ).toBe(
          'LOSS',
        );

        expect(
          second.executableTrade
            .metadata
            .pendingLossDebtBefore,
        ).toBeGreaterThan(
          0,
        );

        expect(
          second.executableTrade
            .metadata
            .baseStakeAmount,
        ).toBeGreaterThan(
          0,
        );

        expect(
          second.executableTrade
            .stake,
        ).toBeGreaterThanOrEqual(
          second.executableTrade
            .metadata
            .baseStakeAmount,
        );

        expect(
          second.executableTrade
            .stake,
        ).toBeLessThanOrEqual(
          second.bankrollBefore +
          0.001,
        );

        /*
         * This is controlled recovery, not uncontrolled doubling.
         */
        expect(
          second.executableTrade
            .metadata
            .recovery,
        ).not.toBeUndefined();
      },
    );


    test(
      'financial PnL always reconciles with simulated bankroll',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...warmup(),

                1,
                3,
                2,

                1,
                3,
                5,

                1,
                3,
                0,
              ],

              adapter({
                martingaleEnabled:
                  false,
              }),

              pragmatic(),
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

        expect(
          result.currentBankroll,
        ).toBeCloseTo(
          result.initialBankroll +
          result.totalPnl,
          2,
        );

        expect(
          result.realBankrollChanged,
        ).toBe(
          false,
        );

        expect(
          result.bankrollChangedInSimulationOnly,
        ).toBe(
          true,
        );

        expect(
          result.automaticExecution,
        ).toBe(
          false,
        );
      },
    );


    test(
      'repeated losses eventually activate Capital Preservation and stop new Triplicacao exposure',
      () => {
        const repeatedLossTrios =
          [];

        /*
         * TC RED opening followed by BLACK settlement.
         *
         * Generate enough losing fixed trios for the canonical
         * Capital Preservation policy to become sovereign.
         */
        for (
          let index =
            0;
          index <
            30;
          index +=
            1
        ) {
          repeatedLossTrios.push(
            1,
            3,
            2,
          );
        }

        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...warmup(),
                ...repeatedLossTrios,
              ],

              adapter({
                martingaleEnabled:
                  false,
              }),

              pragmatic(),
            );

        expect(
          result.lossCount,
        ).toBeGreaterThan(
          0,
        );

        expect(
          result.capitalStop,
        ).toBe(
          true,
        );

        expect(
          result.capitalStopReason,
        ).not.toBeNull();

        expect(
          result.capitalBlockedDecisionPointCount,
        ).toBeGreaterThan(
          0,
        );

        expect(
          result.currentBankroll,
        ).toBeLessThan(
          result.initialBankroll,
        );
      },
    );


    test(
      'Shadow never exposes automatic execution authority',
      () => {
        const runtime =
          adapter();

        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...warmup(),
                1,
                3,
                5,
              ],

              runtime,

              pragmatic(),
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
          runtime.executeBet,
        ).toBeUndefined();

        expect(
          runtime.placeBet,
        ).toBeUndefined();
      },
    );
  },
);
