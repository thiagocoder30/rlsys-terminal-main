const {
  HistoricalShadowReplayEngine,
} = require(
  '../../../dist/application/runtime/HistoricalShadowReplayEngine.js',
);

const {
  HeatmapDynamicShadowAdapter,
} = require(
  '../../../dist/application/runtime/HeatmapDynamicShadowAdapter.js',
);


/*
 * Deterministic analytical fixture.
 *
 * IMPORTANT:
 *
 * prefix even:
 *   dynamic 3-number sector [1,2,3]
 *
 * prefix odd:
 *   dynamic single-number target [7]
 *
 * This deliberately exercises changing Heatmap targets while
 * keeping Capital Preservation fully active.
 */
function reportForHistory(
  history,
) {
  const even =
    history.length %
    2 ===
    0;

  const targetRegions =
    even
      ? [
          {
            regionId:
              'SYNTHETIC_SECTOR',

            source:
              'HOT_SECTOR',

            numbers: [
              1,
              2,
              3,
            ],

            heatScore:
              88,

            confidenceContribution:
              72,
          },
        ]
      : [
          {
            regionId:
              'HOT_NUMBER_7',

            source:
              'HOT_NUMBER_CLUSTER',

            numbers: [
              7,
            ],

            heatScore:
              90,

            confidenceContribution:
              74,
          },
        ];

  return {
    heatmap: {
      sampleSize:
        history.length,
    },

    mode:
      'FUSION_READY',

    signalStrength:
      'STRONG',

    fusionConfidenceScore:
      0.82,

    fusionRiskScore:
      0.28,

    targetRegions,

    hotNumberCount:
      1,

    coldNumberCount:
      4,

    fusionPressureScore:
      72,

    recencyPressureScore:
      68,

    dispersionScore:
      22,

    blockers:
      [],

    warnings:
      [],

    reasons: [
      `TEST_PREFIX:${history.length}`,
    ],

    auditText:
      '',

    paperOnly:
      true,

    liveMoneyAuthorized:
      false,

    productionMoneyAllowed:
      false,
  };
}


function adapter() {
  return new HeatmapDynamicShadowAdapter(
    {
      analysisOptions: {
        minSampleSize:
          60,
      },
    },

    {
      analyze(
        history,
      ) {
        return reportForHistory(
          history,
        );
      },
    },
  );
}


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


describe(
  'Heatmap Dynamic historical SHADOW integration',
  () => {
    test(
      'replays only after canonical 60-spin warmup',
      () => {
        const history = [
          ...Array(
            60,
          ).fill(
            12,
          ),

          1,
          0,
          1,
        ];

        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              history,
              adapter(),
              configuration(),
            );

        expect(
          result.strategyId,
        ).toBe(
          'heatmap-dynamic',
        );

        expect(
          result.minimumHistorySize,
        ).toBe(
          60,
        );

        expect(
          result.warmupSpins,
        ).toBe(
          60,
        );

        expect(
          result.decisionPointCount,
        ).toBe(
          3,
        );

        expect(
          result.lookAheadAllowed,
        ).toBe(
          false,
        );
      },
    );


    test(
      'each dynamic target is frozen at its own historical decision point',
      () => {
        /*
         * prefix 60:
         *   target = [1,2,3]
         *   spin 61 = 1 => WIN
         *
         * prefix 61:
         *   target = [7]
         *   spin 62 = 0 => LOSS
         *
         * prefix 62:
         *   target = [1,2,3]
         *   spin 63 = 1 => WIN
         *
         * The first WIN stays below moderate stop-win:
         *
         * cap R$2
         * 3 targets -> R$0.60 each
         * total stake R$1.80
         * gross R$21.60
         * pnl +R$19.80
         */
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...Array(
                  60,
                ).fill(
                  12,
                ),

                1,
                0,
                1,
              ],

              adapter(),

              configuration(),
            );

        expect(
          result.trades,
        ).toHaveLength(
          3,
        );

        expect(
          result.trades[0]
            .decision
            .metadata
            .targetNumbers,
        ).toEqual([
          1,
          2,
          3,
        ]);

        expect(
          result.trades[1]
            .decision
            .metadata
            .targetNumbers,
        ).toEqual([
          7,
        ]);

        expect(
          result.trades[2]
            .decision
            .metadata
            .targetNumbers,
        ).toEqual([
          1,
          2,
          3,
        ]);

        expect(
          result.trades[0]
            .settlement
            .outcome,
        ).toBe(
          'WIN',
        );

        expect(
          result.trades[1]
            .settlement
            .outcome,
        ).toBe(
          'LOSS',
        );

        expect(
          result.trades[2]
            .settlement
            .outcome,
        ).toBe(
          'WIN',
        );
      },
    );


    test(
      'strict t to t-plus-one settlement uses frozen target rather than next analysis target',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...Array(
                  60,
                ).fill(
                  12,
                ),

                /*
                 * Settles prefix-60 frozen target [1,2,3].
                 */
                1,

                /*
                 * Settles prefix-61 frozen target [7].
                 */
                0,
              ],

              adapter(),

              configuration(),
            );

        expect(
          result.trades,
        ).toHaveLength(
          2,
        );

        const first =
          result.trades[0];

        expect(
          first.decisionHistorySize,
        ).toBe(
          60,
        );

        expect(
          first.decisionSpinIndex,
        ).toBe(
          59,
        );

        expect(
          first.settlementSpinIndex,
        ).toBe(
          60,
        );

        expect(
          first.decision
            .metadata
            .targetNumbers,
        ).toEqual([
          1,
          2,
          3,
        ]);

        expect(
          first.settlementSpin,
        ).toBe(
          1,
        );

        expect(
          first.settlement.outcome,
        ).toBe(
          'WIN',
        );


        const second =
          result.trades[1];

        expect(
          second.decisionHistorySize,
        ).toBe(
          61,
        );

        expect(
          second.decisionSpinIndex,
        ).toBe(
          60,
        );

        expect(
          second.settlementSpinIndex,
        ).toBe(
          61,
        );

        expect(
          second.decision
            .metadata
            .targetNumbers,
        ).toEqual([
          7,
        ]);

        /*
         * Spin 0 is not in frozen target [7].
         *
         * The next analytical target would become [1,2,3],
         * but that MUST NOT participate in this settlement.
         */
        expect(
          second.settlementSpin,
        ).toBe(
          0,
        );

        expect(
          second.settlement.outcome,
        ).toBe(
          'LOSS',
        );
      },
    );


    test(
      'variable target size produces different physical stake layouts',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...Array(
                  60,
                ).fill(
                  12,
                ),

                1,
                0,
              ],

              adapter(),

              configuration(),
            );

        expect(
          result.trades,
        ).toHaveLength(
          2,
        );

        const threeNumbers =
          result.trades[0];

        const oneNumber =
          result.trades[1];

        expect(
          threeNumbers
            .executableTrade
            .metadata
            .targetCount,
        ).toBe(
          3,
        );

        expect(
          oneNumber
            .executableTrade
            .metadata
            .targetCount,
        ).toBe(
          1,
        );

        /*
         * Both layouts are bounded against their own
         * current-bankroll risk cap.
         */
        expect(
          threeNumbers
            .executableTrade
            .stake,
        ).toBeLessThanOrEqual(
          threeNumbers
            .bankrollBefore *
          0.02 +
          0.001,
        );

        expect(
          oneNumber
            .executableTrade
            .stake,
        ).toBeLessThanOrEqual(
          oneNumber
            .bankrollBefore *
          0.02 +
          0.001,
        );

        /*
         * Physical economics really differ.
         */
        expect(
          threeNumbers
            .executableTrade
            .metadata
            .stakePerNumber,
        ).toBeLessThan(
          oneNumber
            .executableTrade
            .metadata
            .stakePerNumber,
        );
      },
    );


    test(
      'dynamic bankroll is recalculated after every Heatmap settlement',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...Array(
                  60,
                ).fill(
                  12,
                ),

                1,
                0,
              ],

              adapter(),

              configuration(),
            );

        expect(
          result.trades,
        ).toHaveLength(
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

        expect(
          result.currentBankroll,
        ).toBeCloseTo(
          result.initialBankroll +
          result.totalPnl,
          2,
        );

        expect(
          result.trades[1]
            .bankrollBefore,
        ).toBe(
          result.trades[0]
            .bankrollAfter,
        );
      },
    );


    test(
      'large first single-number WIN activates Capital Preservation stop-win',
      () => {
        /*
         * This scenario intentionally verifies the behavior
         * that exposed the previous test-fixture error.
         *
         * Override analytical parity by starting at prefix 61:
         * prefix 61 target = [7].
         *
         * R$100 moderate:
         * stake R$2 on one number.
         *
         * WIN:
         * gross R$72
         * pnl +R$70
         * bankroll R$170
         *
         * Moderate stop-win = +20%.
         */
        const singleNumberAdapter =
          new HeatmapDynamicShadowAdapter(
            {
              analysisOptions: {
                minSampleSize:
                  61,
              },
            },

            {
              analyze(
                history,
              ) {
                return reportForHistory(
                  history,
                );
              },
            },
          );

        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...Array(
                  61,
                ).fill(
                  12,
                ),

                7,

                /*
                 * Must never receive another exposure.
                 */
                7,
                7,
              ],

              singleNumberAdapter,

              configuration(),
            );

        expect(
          result.tradeCount,
        ).toBe(
          1,
        );

        expect(
          result.winCount,
        ).toBe(
          1,
        );

        expect(
          result.currentBankroll,
        ).toBe(
          170,
        );

        expect(
          result.capitalStop,
        ).toBe(
          true,
        );

        expect(
          result.capitalStopReason,
        ).toBe(
          'STOP_WIN_REACHED',
        );

        expect(
          result.capitalBlockedDecisionPointCount,
        ).toBe(
          2,
        );
      },
    );


    test(
      'Evolution may block a large Heatmap region that Pragmatic can fund',
      () => {
        const largeRegionAdapter =
          new HeatmapDynamicShadowAdapter(
            {},

            {
              analyze(
                history,
              ) {
                return {
                  ...reportForHistory(
                    history,
                  ),

                  targetRegions: [
                    {
                      regionId:
                        'TIERS',

                      source:
                        'HOT_SECTOR',

                      numbers: [
                        27,
                        13,
                        36,
                        11,
                        30,
                        8,
                        23,
                        10,
                        5,
                        24,
                        16,
                        33,
                      ],

                      heatScore:
                        88,

                      confidenceContribution:
                        72,
                    },
                  ],
                };
              },
            },
          );

        const history = [
          ...Array(
            60,
          ).fill(
            23,
          ),

          23,
        ];

        const pragmatic =
          new HistoricalShadowReplayEngine()
            .replay(
              history,

              largeRegionAdapter,

              configuration(),
            );

        const evolution =
          new HistoricalShadowReplayEngine()
            .replay(
              history,

              largeRegionAdapter,

              configuration({
                provider:
                  'EVOLUTION',

                minimumChipValue:
                  0.50,
              }),
            );

        /*
         * Pragmatic:
         * 12 × R$0.10 = R$1.20 <= R$2 cap.
         *
         * Evolution:
         * 12 × R$0.50 = R$6 > R$2 cap.
         */
        expect(
          pragmatic.tradeCount,
        ).toBeGreaterThan(
          0,
        );

        expect(
          evolution.tradeCount,
        ).toBe(
          0,
        );

        expect(
          evolution
            .financiallyBlockedDecisionCount,
        ).toBeGreaterThan(
          0,
        );

        expect(
          evolution.currentBankroll,
        ).toBe(
          100,
        );
      },
    );


    test(
      'Shadow remains simulation-only and manual',
      () => {
        const result =
          new HistoricalShadowReplayEngine()
            .replay(
              [
                ...Array(
                  60,
                ).fill(
                  12,
                ),

                1,
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
      },
    );
  },
);
