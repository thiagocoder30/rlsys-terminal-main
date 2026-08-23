const {
  HeatmapDynamicShadowAdapter,
} = require(
  '../../../dist/application/runtime/HeatmapDynamicShadowAdapter.js',
);


function analyticalReport(
  overrides = {},
) {
  return {
    heatmap: {
      sampleSize:
        100,
    },

    mode:
      'FUSION_READY',

    signalStrength:
      'STRONG',

    fusionConfidenceScore:
      0.82,

    fusionRiskScore:
      0.28,

    targetRegions: [
      {
        regionId:
          'HOT_NUMBER_7',

        source:
          'HOT_NUMBER_CLUSTER',

        numbers: [
          7,
        ],

        heatScore:
          92,

        confidenceContribution:
          74,
      },
    ],

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
      'TEST_HEATMAP_SHADOW',
    ],

    auditText:
      '',

    paperOnly:
      true,

    liveMoneyAuthorized:
      false,

    productionMoneyAllowed:
      false,

    ...overrides,
  };
}


function adapterWithReport(
  report,
  configuration = {},
) {
  return new HeatmapDynamicShadowAdapter(
    configuration,

    {
      analyze() {
        return report;
      },
    },
  );
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
  'HeatmapDynamicShadowAdapter',
  () => {
    test(
      'uses canonical default minimum history size 60',
      () => {
        const adapter =
          new HeatmapDynamicShadowAdapter();

        expect(
          adapter.minimumHistorySize,
        ).toBe(
          60,
        );
      },
    );


    test(
      'honors explicit analytical minimum sample override',
      () => {
        const adapter =
          new HeatmapDynamicShadowAdapter({
            analysisOptions: {
              minSampleSize:
                90,
            },
          });

        expect(
          adapter.minimumHistorySize,
        ).toBe(
          90,
        );
      },
    );


    test(
      'creates decision only from PAPER_READY semantics',
      () => {
        const adapter =
          adapterWithReport(
            analyticalReport(),
          );

        const decision =
          adapter.evaluate(
            Array(
              60,
            ).fill(
              7,
            ),
          );

        expect(
          decision,
        ).not.toBeNull();

        expect(
          decision.strategyId,
        ).toBe(
          'heatmap-dynamic',
        );

        expect(
          decision.strategyRiskScore,
        ).toBe(
          0.28,
        );

        expect(
          decision.metadata
            .targetRegionId,
        ).toBe(
          'HOT_NUMBER_7',
        );

        expect(
          decision.metadata
            .targetNumbers,
        ).toEqual([
          7,
        ]);

        expect(
          decision.metadata
            .targetCount,
        ).toBe(
          1,
        );

        expect(
          decision.metadata
            .coveragePercent,
        ).toBe(
          2.7,
        );
      },
    );


    test(
      'OBSERVE creates no Shadow decision',
      () => {
        const adapter =
          adapterWithReport(
            analyticalReport({
              mode:
                'OBSERVE',

              signalStrength:
                'WEAK',
            }),
          );

        expect(
          adapter.evaluate(
            Array(
              60,
            ).fill(
              7,
            ),
          ),
        ).toBeNull();
      },
    );


    test(
      'dynamic HOT_SECTOR preserves variable target size',
      () => {
        const targets = [
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
        ];

        const adapter =
          adapterWithReport(
            analyticalReport({
              targetRegions: [
                {
                  regionId:
                    'TIERS',

                  source:
                    'HOT_SECTOR',

                  numbers:
                    targets,

                  heatScore:
                    88,

                  confidenceContribution:
                    72,
                },
              ],
            }),
          );

        const decision =
          adapter.evaluate(
            Array(
              60,
            ).fill(
              23,
            ),
          );

        expect(
          decision.metadata
            .targetRegionId,
        ).toBe(
          'TIERS',
        );

        expect(
          decision.metadata
            .targetNumbers,
        ).toEqual(
          targets,
        );

        expect(
          decision.metadata
            .targetCount,
        ).toBe(
          12,
        );

        expect(
          decision.metadata
            .coveragePercent,
        ).toBe(
          32.4,
        );
      },
    );


    test(
      'zero may legitimately belong to frozen Heatmap target',
      () => {
        const adapter =
          adapterWithReport(
            analyticalReport({
              targetRegions: [
                {
                  regionId:
                    'ZERO_NEIGHBORS',

                  source:
                    'HOT_SECTOR',

                  numbers: [
                    12,
                    35,
                    3,
                    26,
                    0,
                    32,
                    15,
                  ],

                  heatScore:
                    89,

                  confidenceContribution:
                    72,
                },
              ],
            }),
          );

        const decision =
          adapter.evaluate(
            Array(
              60,
            ).fill(
              0,
            ),
          );

        expect(
          decision.metadata
            .targetNumbers,
        ).toContain(
          0,
        );
      },
    );


    test(
      'Pragmatic one-number target uses sovereign total budget',
      () => {
        const adapter =
          adapterWithReport(
            analyticalReport(),
          );

        const decision =
          adapter.evaluate(
            Array(
              60,
            ).fill(
              7,
            ),
          );

        const trade =
          adapter.prepare(
            decision,
            context(),
          );

        /*
         * Moderate cap:
         * 2% × R$100 = R$2.
         *
         * One target allows all twenty R$0.10 chips
         * to remain inside the sovereign total budget.
         */
        expect(
          trade,
        ).not.toBeNull();

        expect(
          trade.stake,
        ).toBe(
          2,
        );

        expect(
          trade.metadata
            .stakePerNumber,
        ).toBe(
          2,
        );

        expect(
          trade.metadata
            .targetCount,
        ).toBe(
          1,
        );

        expect(
          trade.metadata
            .authorizedMaximumTotalStake,
        ).toBe(
          2,
        );
      },
    );


    test(
      'twelve-number target is quantized without exceeding same total budget',
      () => {
        const adapter =
          adapterWithReport(
            analyticalReport({
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
            }),
          );

        const decision =
          adapter.evaluate(
            Array(
              60,
            ).fill(
              23,
            ),
          );

        const trade =
          adapter.prepare(
            decision,
            context(),
          );

        /*
         * Moderate total cap = R$2.
         *
         * One R$0.10 layer over twelve targets = R$1.20.
         * Two layers = R$2.40 and would exceed the cap.
         */
        expect(
          trade,
        ).not.toBeNull();

        expect(
          trade.stake,
        ).toBe(
          1.20,
        );

        expect(
          trade.metadata
            .stakePerNumber,
        ).toBe(
          0.10,
        );

        expect(
          trade.metadata
            .chipsPerNumber,
        ).toBe(
          1,
        );

        expect(
          trade.stake,
        ).toBeLessThanOrEqual(
          2,
        );
      },
    );


    test(
      'provider economics may block large dynamic target',
      () => {
        const adapter =
          adapterWithReport(
            analyticalReport({
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
            }),
          );

        const decision =
          adapter.evaluate(
            Array(
              60,
            ).fill(
              23,
            ),
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
         * Moderate cap R$2.
         *
         * Minimum twelve-number Evolution layout:
         * 12 × R$0.50 = R$6.
         */
        expect(
          trade,
        ).toBeNull();
      },
    );


    test(
      'strategy financial risk policy can block PAPER_READY Heatmap decision',
      () => {
        const adapter =
          adapterWithReport(
            analyticalReport({
              fusionRiskScore:
                0.40,
            }),
          );

        const decision =
          adapter.evaluate(
            Array(
              60,
            ).fill(
              7,
            ),
          );

        const trade =
          adapter.prepare(
            decision,
            context({
              riskMode:
                'conservative',
            }),
          );

        /*
         * Analytical Heatmap may still be PAPER_READY,
         * but conservative sovereign risk limit is 0.34.
         */
        expect(
          decision,
        ).not.toBeNull();

        expect(
          trade,
        ).toBeNull();
      },
    );


    test(
      'one-number WIN uses straight-up BRL payout',
      () => {
        const adapter =
          adapterWithReport(
            analyticalReport(),
          );

        const decision =
          adapter.evaluate(
            Array(
              60,
            ).fill(
              7,
            ),
          );

        const trade =
          adapter.prepare(
            decision,
            context(),
          );

        const settlement =
          adapter.settle(
            trade,
            7,
          );

        expect(
          settlement.outcome,
        ).toBe(
          'WIN',
        );

        expect(
          settlement.stake,
        ).toBe(
          2,
        );

        expect(
          settlement.grossReturn,
        ).toBe(
          72,
        );

        expect(
          settlement.pnl,
        ).toBe(
          70,
        );
      },
    );


    test(
      'sector LOSS loses exactly frozen total stake',
      () => {
        const adapter =
          adapterWithReport(
            analyticalReport({
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
            }),
          );

        const decision =
          adapter.evaluate(
            Array(
              60,
            ).fill(
              23,
            ),
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
          settlement.pnl,
        ).toBe(
          -1.20,
        );
      },
    );


    test(
      'zero settles WIN when it belongs to frozen target',
      () => {
        const adapter =
          adapterWithReport(
            analyticalReport({
              targetRegions: [
                {
                  regionId:
                    'ZERO_NEIGHBORS',

                  source:
                    'HOT_SECTOR',

                  numbers: [
                    12,
                    35,
                    3,
                    26,
                    0,
                    32,
                    15,
                  ],

                  heatScore:
                    89,

                  confidenceContribution:
                    72,
                },
              ],
            }),
          );

        const decision =
          adapter.evaluate(
            Array(
              60,
            ).fill(
              0,
            ),
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
          'WIN',
        );
      },
    );


    test(
      'settlement does not recalculate dynamic target',
      () => {
        let analyticalCalls =
          0;

        const adapter =
          new HeatmapDynamicShadowAdapter(
            {},

            {
              analyze() {
                analyticalCalls +=
                  1;

                return analyticalReport();
              },
            },
          );

        const decision =
          adapter.evaluate(
            Array(
              60,
            ).fill(
              7,
            ),
          );

        const trade =
          adapter.prepare(
            decision,
            context(),
          );

        expect(
          analyticalCalls,
        ).toBe(
          1,
        );

        adapter.settle(
          trade,
          7,
        );

        expect(
          analyticalCalls,
        ).toBe(
          1,
        );
      },
    );


    test(
      'adapter exposes no execution or real bankroll API',
      () => {
        const adapter =
          new HeatmapDynamicShadowAdapter();

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
