const {
  HeatmapDynamicLiveTerminalController,
} = require(
  '../../../dist/application/runtime/HeatmapDynamicLiveTerminalController.js',
);


function analysis(
  overrides = {},
) {
  return {
    heatmap: {
      sampleSize:
        100,
    },

    mode:
      'OBSERVE',

    signalStrength:
      'WEAK',

    fusionConfidenceScore:
      0.55,

    fusionRiskScore:
      0.45,

    targetRegions: [
      {
        regionId:
          'HOT_NUMBER_32',

        source:
          'HOT_NUMBER_CLUSTER',

        numbers: [
          32,
        ],

        heatScore:
          72,

        confidenceContribution:
          61,
      },
    ],

    hotNumberCount:
      1,

    coldNumberCount:
      5,

    fusionPressureScore:
      52,

    recencyPressureScore:
      48,

    dispersionScore:
      42,

    blockers:
      [],

    warnings:
      [],

    reasons: [
      'TEST_ANALYSIS',
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


function observeDecision() {
  return {
    status:
      'OBSERVE',

    hypothesis:
      null,

    blockers:
      [],

    warnings:
      [],

    reasons: [
      'HEATMAP_DYNAMIC_PROSPECTIVE_OBSERVE',
    ],

    paperOnly:
      true,

    recommendationOnly:
      true,

    liveMoneyAuthorization:
      false,

    automaticBetExecutionAllowed:
      false,

    operatorDecisionRequired:
      true,
  };
}


function paperReadyDecision(
  targetNumbers = [
    32,
  ],
) {
  return {
    status:
      'PAPER_READY',

    hypothesis: {
      strategyId:
        'heatmap-dynamic',

      targetRegionId:
        'HOT_NUMBER_32',

      targetNumbers,

      source:
        'HOT_NUMBER_CLUSTER',

      heatScore:
        82,

      confidenceScore:
        0.78,

      riskScore:
        0.29,

      signalStrength:
        'STRONG',

      paperOnly:
        true,

      liveMoneyAuthorization:
        false,

      automaticBetExecutionAllowed:
        false,

      operatorDecisionRequired:
        true,
    },

    blockers:
      [],

    warnings:
      [],

    reasons: [
      'HEATMAP_DYNAMIC_PROSPECTIVE_PAPER_READY',
    ],

    paperOnly:
      true,

    recommendationOnly:
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
  'HeatmapDynamicLiveTerminalController',
  () => {
    test(
      'starts behind explicit temporal history boundary',
      () => {
        const runtime =
          new HeatmapDynamicLiveTerminalController({
            sessionId:
              'heatmap-live',

            synchronizedHistory: [
              1,
              2,
              3,
            ],
          });

        const snapshot =
          runtime.snapshot();

        expect(
          snapshot.strategyId,
        ).toBe(
          'heatmap-dynamic',
        );

        expect(
          snapshot.mode,
        ).toBe(
          'AWAITING_HISTORY_CONFIRMATION',
        );

        expect(
          snapshot.synchronizedHistorySize,
        ).toBe(
          3,
        );

        expect(
          snapshot.liveSpinCount,
        ).toBe(
          0,
        );
      },
    );


    test(
      'history confirmation s opens LIVE directly',
      () => {
        const runtime =
          new HeatmapDynamicLiveTerminalController({
            sessionId:
              'heatmap-live',

            synchronizedHistory: [
              1,
              2,
              3,
            ],
          });

        expect(
          runtime
            .confirmHistoryCurrent(
              's',
            )
            .mode,
        ).toBe(
          'LIVE',
        );
      },
    );


    test(
      'history confirmation n opens CATCH_UP',
      () => {
        const runtime =
          new HeatmapDynamicLiveTerminalController({
            sessionId:
              'heatmap-live',

            synchronizedHistory: [
              1,
              2,
              3,
            ],
          });

        expect(
          runtime
            .confirmHistoryCurrent(
              'n',
            )
            .mode,
        ).toBe(
          'CATCH_UP',
        );
      },
    );


    test(
      'CATCH_UP updates chronology without invoking prospective analytics',
      () => {
        let analyticsCalls =
          0;

        const analytics = {
          analyze() {
            analyticsCalls +=
              1;

            return analysis();
          },
        };

        const runtime =
          new HeatmapDynamicLiveTerminalController(
            {
              sessionId:
                'heatmap-live',

              synchronizedHistory: [
                1,
                2,
                3,
              ],
            },

            analytics,
          );

        runtime.confirmHistoryCurrent(
          'n',
        );

        runtime.recordCatchUpSpin(
          17,
        );

        runtime.recordCatchUpSpin(
          27,
        );

        expect(
          analyticsCalls,
        ).toBe(
          0,
        );

        expect(
          runtime.snapshot()
            .catchUpSpinCount,
        ).toBe(
          2,
        );

        expect(
          runtime.snapshot()
            .liveSpinCount,
        ).toBe(
          0,
        );

        expect(
          runtime.historySnapshot(),
        ).toEqual([
          1,
          2,
          3,
          17,
          27,
        ]);
      },
    );


    test(
      'finishCatchUp transitions to LIVE',
      () => {
        const runtime =
          new HeatmapDynamicLiveTerminalController({
            sessionId:
              'heatmap-live',

            synchronizedHistory: [
              1,
              2,
              3,
            ],
          });

        runtime.confirmHistoryCurrent(
          'n',
        );

        runtime.recordCatchUpSpin(
          17,
        );

        expect(
          runtime
            .finishCatchUp()
            .mode,
        ).toBe(
          'LIVE',
        );
      },
    );


    test(
      'LIVE spin is analyzed with chronology including current spin',
      () => {
        let receivedHistory =
          null;

        const analytics = {
          analyze(
            history,
          ) {
            receivedHistory =
              [
                ...history,
              ];

            return analysis();
          },
        };

        const semantics = {
          resolve() {
            return observeDecision();
          },
        };

        const runtime =
          new HeatmapDynamicLiveTerminalController(
            {
              sessionId:
                'heatmap-live',

              synchronizedHistory: [
                1,
                2,
                3,
              ],
            },

            analytics,
            semantics,
          );

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          17,
        );

        expect(
          receivedHistory,
        ).toEqual([
          1,
          2,
          3,
          17,
        ]);
      },
    );


    test(
      'accepted LIVE spin increments LIVE chronology exactly once',
      () => {
        const runtime =
          new HeatmapDynamicLiveTerminalController(
            {
              sessionId:
                'heatmap-live',

              synchronizedHistory: [
                1,
                2,
                3,
              ],
            },

            {
              analyze() {
                return analysis();
              },
            },

            {
              resolve() {
                return observeDecision();
              },
            },
          );

        runtime.confirmHistoryCurrent(
          's',
        );

        const first =
          runtime.ingestLiveSpin(
            17,
          );

        const second =
          runtime.ingestLiveSpin(
            27,
          );

        expect(
          first.liveSpinIndex,
        ).toBe(
          1,
        );

        expect(
          second.liveSpinIndex,
        ).toBe(
          2,
        );

        expect(
          runtime.historySnapshot(),
        ).toEqual([
          1,
          2,
          3,
          17,
          27,
        ]);
      },
    );


    test(
      'PAPER_READY preserves Heatmap Dynamic identity and next-spin boundary',
      () => {
        const runtime =
          new HeatmapDynamicLiveTerminalController(
            {
              sessionId:
                'heatmap-live',

              synchronizedHistory: [
                1,
                2,
                3,
              ],
            },

            {
              analyze() {
                return analysis({
                  mode:
                    'FUSION_READY',

                  signalStrength:
                    'STRONG',
                });
              },
            },

            {
              resolve() {
                return paperReadyDecision([
                  32,
                ]);
              },
            },
          );

        runtime.confirmHistoryCurrent(
          's',
        );

        const result =
          runtime.ingestLiveSpin(
            17,
          );

        expect(
          result.strategyId,
        ).toBe(
          'heatmap-dynamic',
        );

        expect(
          result.appliesFromNextSpin,
        ).toBe(
          true,
        );

        expect(
          result.decision.status,
        ).toBe(
          'PAPER_READY',
        );

        expect(
          result.decision
            .hypothesis
            .strategyId,
        ).toBe(
          'heatmap-dynamic',
        );

        expect(
          result.decision
            .hypothesis
            .targetNumbers,
        ).toEqual([
          32,
        ]);
      },
    );


    test(
      'dynamic target is not forced to fixed Fusion Reduzida sector',
      () => {
        const runtime =
          new HeatmapDynamicLiveTerminalController(
            {
              sessionId:
                'heatmap-live',

              synchronizedHistory: [
                1,
                2,
                3,
              ],
            },

            {
              analyze() {
                return analysis();
              },
            },

            {
              resolve() {
                return paperReadyDecision([
                  32,
                ]);
              },
            },
          );

        runtime.confirmHistoryCurrent(
          's',
        );

        const result =
          runtime.ingestLiveSpin(
            17,
          );

        expect(
          result.decision
            .hypothesis
            .targetNumbers,
        ).toHaveLength(
          1,
        );

        expect(
          result.decision
            .hypothesis
            .strategyId,
        ).not.toBe(
          'fusion-reduzida',
        );
      },
    );


    test(
      'roulette zero is accepted as ordinary Heatmap Dynamic LIVE spin',
      () => {
        const runtime =
          new HeatmapDynamicLiveTerminalController(
            {
              sessionId:
                'heatmap-live',

              synchronizedHistory: [
                1,
                2,
                3,
              ],
            },

            {
              analyze() {
                return analysis();
              },
            },

            {
              resolve() {
                return observeDecision();
              },
            },
          );

        runtime.confirmHistoryCurrent(
          's',
        );

        const result =
          runtime.ingestLiveSpin(
            0,
          );

        expect(
          result.spin,
        ).toBe(
          0,
        );

        expect(
          runtime.historySnapshot()
            .slice(-1),
        ).toEqual([
          0,
        ]);

        expect(
          runtime.snapshot()
            .liveSpinCount,
        ).toBe(
          1,
        );
      },
    );


    test(
      'analytics failure does not mutate LIVE chronology',
      () => {
        const runtime =
          new HeatmapDynamicLiveTerminalController(
            {
              sessionId:
                'heatmap-live',

              synchronizedHistory: [
                1,
                2,
                3,
              ],
            },

            {
              analyze() {
                throw new Error(
                  'synthetic_heatmap_failure',
                );
              },
            },
          );

        runtime.confirmHistoryCurrent(
          's',
        );

        expect(
          () =>
            runtime.ingestLiveSpin(
              17,
            ),
        ).toThrow(
          'synthetic_heatmap_failure',
        );

        expect(
          runtime.snapshot()
            .liveSpinCount,
        ).toBe(
          0,
        );

        expect(
          runtime.historySnapshot(),
        ).toEqual([
          1,
          2,
          3,
        ]);
      },
    );


    test(
      'decision semantics failure does not mutate LIVE chronology',
      () => {
        const runtime =
          new HeatmapDynamicLiveTerminalController(
            {
              sessionId:
                'heatmap-live',

              synchronizedHistory: [
                1,
                2,
                3,
              ],
            },

            {
              analyze() {
                return analysis();
              },
            },

            {
              resolve() {
                throw new Error(
                  'synthetic_semantics_failure',
                );
              },
            },
          );

        runtime.confirmHistoryCurrent(
          's',
        );

        expect(
          () =>
            runtime.ingestLiveSpin(
              17,
            ),
        ).toThrow(
          'synthetic_semantics_failure',
        );

        expect(
          runtime.snapshot()
            .liveSpinCount,
        ).toBe(
          0,
        );
      },
    );


    test(
      'invalid roulette numbers are rejected',
      () => {
        const runtime =
          new HeatmapDynamicLiveTerminalController({
            sessionId:
              'heatmap-live',

            synchronizedHistory: [
              1,
              2,
              3,
            ],
          });

        runtime.confirmHistoryCurrent(
          's',
        );

        expect(
          () =>
            runtime.ingestLiveSpin(
              37,
            ),
        ).toThrow(
          'heatmap_dynamic_live_invalid_spin',
        );

        expect(
          () =>
            runtime.ingestLiveSpin(
              -1,
            ),
        ).toThrow(
          'heatmap_dynamic_live_invalid_spin',
        );
      },
    );


    test(
      'controller remains strictly recommendation-only',
      () => {
        const runtime =
          new HeatmapDynamicLiveTerminalController({
            sessionId:
              'heatmap-live',

            synchronizedHistory: [
              1,
              2,
              3,
            ],
          });

        const snapshot =
          runtime.snapshot();

        expect(
          snapshot.paperOnly,
        ).toBe(
          true,
        );

        expect(
          snapshot.recommendationOnly,
        ).toBe(
          true,
        );

        expect(
          snapshot.humanExecutionRequired,
        ).toBe(
          true,
        );

        expect(
          snapshot.liveMoneyAuthorization,
        ).toBe(
          false,
        );

        expect(
          snapshot.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );

        expect(
          runtime.placeBet,
        ).toBeUndefined();

        expect(
          runtime.executeBet,
        ).toBeUndefined();

        expect(
          runtime.calculateStake,
        ).toBeUndefined();

        expect(
          runtime.settleBet,
        ).toBeUndefined();
      },
    );
  },
);
