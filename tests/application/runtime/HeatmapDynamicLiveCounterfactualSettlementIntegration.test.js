const {
  HeatmapDynamicLiveTerminalController,
} = require(
  '../../../dist/application/runtime/HeatmapDynamicLiveTerminalController.js',
);


function analysis(
  index = 1,
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
      0.80,

    fusionRiskScore:
      0.30,

    targetRegions: [
      {
        regionId:
          `HOT_NUMBER_${index}`,

        source:
          'HOT_NUMBER_CLUSTER',

        numbers: [
          index,
        ],

        heatScore:
          80,

        confidenceContribution:
          70,
      },
    ],

    hotNumberCount:
      1,

    coldNumberCount:
      5,

    fusionPressureScore:
      70,

    recencyPressureScore:
      65,

    dispersionScore:
      30,

    blockers:
      [],

    warnings:
      [],

    reasons: [
      'TEST_HEATMAP_DYNAMIC_READY',
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


function paperReadyDecision(
  targets,
  index = 1,
) {
  return {
    status:
      'PAPER_READY',

    hypothesis: {
      strategyId:
        'heatmap-dynamic',

      targetRegionId:
        `REGION_${index}`,

      targetNumbers:
        targets,

      source:
        targets.length ===
          1
          ? 'HOT_NUMBER_CLUSTER'
          : 'HOT_SECTOR',

      heatScore:
        80,

      confidenceScore:
        0.80,

      riskScore:
        0.30,

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


function controllerWithDecisions(
  decisions,
) {
  let analysisIndex =
    0;

  let decisionIndex =
    0;

  const analytics = {
    analyze() {
      analysisIndex +=
        1;

      return analysis(
        analysisIndex,
      );
    },
  };

  const semantics = {
    resolve() {
      const decision =
        decisions[
          decisionIndex
        ] ??
        observeDecision();

      decisionIndex +=
        1;

      return decision;
    },
  };

  return new HeatmapDynamicLiveTerminalController(
    {
      sessionId:
        'heatmap-dynamic-counterfactual',

      synchronizedHistory: [
        1,
        2,
        3,
      ],
    },

    analytics,
    semantics,
  );
}


describe(
  'Heatmap Dynamic LIVE counterfactual settlement integration',
  () => {
    test(
      'OBSERVE creates no pending hypothesis',
      () => {
        const runtime =
          controllerWithDecisions([
            observeDecision(),
          ]);

        runtime.confirmHistoryCurrent(
          's',
        );

        const result =
          runtime.ingestLiveSpin(
            17,
          );

        expect(
          result.previousSettlement,
        ).toBeNull();

        expect(
          result.registeredCounterfactualDecision,
        ).toBeNull();

        expect(
          runtime.pendingCounterfactualDecision(),
        ).toBeNull();

        expect(
          runtime.counterfactualHistory(),
        ).toHaveLength(
          0,
        );
      },
    );


    test(
      'PAPER_READY at t creates pending decision without settling it at t',
      () => {
        const runtime =
          controllerWithDecisions([
            paperReadyDecision([
              32,
            ]),
          ]);

        runtime.confirmHistoryCurrent(
          's',
        );

        const result =
          runtime.ingestLiveSpin(
            17,
          );

        expect(
          result.previousSettlement,
        ).toBeNull();

        expect(
          result.registeredCounterfactualDecision,
        ).not.toBeNull();

        expect(
          result.registeredCounterfactualDecision
            .targetNumbers,
        ).toEqual([
          32,
        ]);

        expect(
          result.registeredCounterfactualDecision
            .targetSize,
        ).toBe(
          1,
        );

        expect(
          result.registeredCounterfactualDecision
            .coveragePercent,
        ).toBe(
          2.7,
        );

        expect(
          runtime.counterfactualHistory(),
        ).toHaveLength(
          0,
        );

        expect(
          runtime.snapshot()
            .counterfactualPending,
        ).toBe(
          true,
        );
      },
    );


    test(
      't+1 settles decision created at t with WIN',
      () => {
        const runtime =
          controllerWithDecisions([
            paperReadyDecision([
              32,
            ]),

            observeDecision(),
          ]);

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          17,
        );

        const second =
          runtime.ingestLiveSpin(
            32,
          );

        expect(
          second.previousSettlement,
        ).not.toBeNull();

        expect(
          second.previousSettlement.outcome,
        ).toBe(
          'WIN',
        );

        expect(
          second.previousSettlement.settledBySpin,
        ).toBe(
          32,
        );

        expect(
          second.previousSettlement.targetSize,
        ).toBe(
          1,
        );

        expect(
          runtime.counterfactualHistory(),
        ).toHaveLength(
          1,
        );
      },
    );


    test(
      't+1 outside dynamic target settles LOSS',
      () => {
        const runtime =
          controllerWithDecisions([
            paperReadyDecision([
              32,
            ]),

            observeDecision(),
          ]);

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          17,
        );

        const second =
          runtime.ingestLiveSpin(
            7,
          );

        expect(
          second.previousSettlement
            .outcome,
        ).toBe(
          'LOSS',
        );

        expect(
          runtime.counterfactualSnapshot()
            .lossCount,
        ).toBe(
          1,
        );
      },
    );


    test(
      'same t+1 may settle previous decision and create another for t+2',
      () => {
        const runtime =
          controllerWithDecisions([
            paperReadyDecision(
              [
                32,
              ],
              1,
            ),

            paperReadyDecision(
              [
                7,
                15,
                19,
              ],
              2,
            ),

            observeDecision(),
          ]);

        runtime.confirmHistoryCurrent(
          's',
        );

        const first =
          runtime.ingestLiveSpin(
            17,
          );

        expect(
          first.registeredCounterfactualDecision
            .decisionIndex,
        ).toBe(
          1,
        );

        const second =
          runtime.ingestLiveSpin(
            32,
          );

        expect(
          second.previousSettlement
            .decisionIndex,
        ).toBe(
          1,
        );

        expect(
          second.previousSettlement
            .outcome,
        ).toBe(
          'WIN',
        );

        expect(
          second.registeredCounterfactualDecision
            .decisionIndex,
        ).toBe(
          2,
        );

        expect(
          second.registeredCounterfactualDecision
            .targetNumbers,
        ).toEqual([
          7,
          15,
          19,
        ]);

        expect(
          second.registeredCounterfactualDecision
            .targetSize,
        ).toBe(
          3,
        );

        expect(
          second.registeredCounterfactualDecision
            .coveragePercent,
        ).toBe(
          8.1,
        );

        /*
         * Decision #2 nasceu no LIVE 2.
         * Portanto LIVE 2 não pode liquidá-la.
         */
        expect(
          runtime.counterfactualHistory(),
        ).toHaveLength(
          1,
        );

        const third =
          runtime.ingestLiveSpin(
            15,
          );

        expect(
          third.previousSettlement
            .decisionIndex,
        ).toBe(
          2,
        );

        expect(
          third.previousSettlement
            .outcome,
        ).toBe(
          'WIN',
        );

        expect(
          runtime.counterfactualHistory(),
        ).toHaveLength(
          2,
        );
      },
    );


    test(
      'zero is ordinary settlement number for Heatmap Dynamic',
      () => {
        const runtime =
          controllerWithDecisions([
            paperReadyDecision([
              0,
              32,
            ]),

            observeDecision(),
          ]);

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          17,
        );

        const second =
          runtime.ingestLiveSpin(
            0,
          );

        expect(
          second.previousSettlement
            .outcome,
        ).toBe(
          'WIN',
        );

        expect(
          second.previousSettlement
            .settledBySpin,
        ).toBe(
          0,
        );

        expect(
          runtime.historySnapshot()
            .slice(-2),
        ).toEqual([
          17,
          0,
        ]);
      },
    );


    test(
      'zero settles LOSS when absent from dynamic target',
      () => {
        const runtime =
          controllerWithDecisions([
            paperReadyDecision([
              32,
            ]),

            observeDecision(),
          ]);

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          17,
        );

        const second =
          runtime.ingestLiveSpin(
            0,
          );

        expect(
          second.previousSettlement
            .outcome,
        ).toBe(
          'LOSS',
        );
      },
    );


    test(
      'CATCH_UP updates chronology without creating or settling hypothesis',
      () => {
        const runtime =
          controllerWithDecisions([
            paperReadyDecision([
              32,
            ]),
          ]);

        runtime.confirmHistoryCurrent(
          'n',
        );

        runtime.recordCatchUpSpin(
          32,
        );

        runtime.recordCatchUpSpin(
          7,
        );

        expect(
          runtime.counterfactualSnapshot()
            .settledCount,
        ).toBe(
          0,
        );

        expect(
          runtime.pendingCounterfactualDecision(),
        ).toBeNull();

        expect(
          runtime.snapshot()
            .catchUpSpinCount,
        ).toBe(
          2,
        );

        runtime.finishCatchUp();

        const firstLive =
          runtime.ingestLiveSpin(
            17,
          );

        expect(
          firstLive.previousSettlement,
        ).toBeNull();

        expect(
          firstLive.registeredCounterfactualDecision,
        ).not.toBeNull();
      },
    );


    test(
      'analytics failure does not consume pending decision',
      () => {
        let calls =
          0;

        const analytics = {
          analyze() {
            calls +=
              1;

            if (
              calls ===
              2
            ) {
              throw new Error(
                'synthetic_heatmap_analysis_failure',
              );
            }

            return analysis(
              calls,
            );
          },
        };

        const semantics = {
          resolve() {
            return paperReadyDecision([
              32,
            ]);
          },
        };

        const runtime =
          new HeatmapDynamicLiveTerminalController(
            {
              sessionId:
                'heatmap-analysis-failure',

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
          runtime.pendingCounterfactualDecision(),
        ).not.toBeNull();

        expect(
          () =>
            runtime.ingestLiveSpin(
              32,
            ),
        ).toThrow(
          'synthetic_heatmap_analysis_failure',
        );

        expect(
          runtime.pendingCounterfactualDecision(),
        ).not.toBeNull();

        expect(
          runtime.counterfactualHistory(),
        ).toHaveLength(
          0,
        );

        expect(
          runtime.snapshot()
            .liveSpinCount,
        ).toBe(
          1,
        );
      },
    );


    test(
      'semantics failure does not consume pending decision',
      () => {
        let calls =
          0;

        const semantics = {
          resolve() {
            calls +=
              1;

            if (
              calls ===
              2
            ) {
              throw new Error(
                'synthetic_heatmap_semantics_failure',
              );
            }

            return paperReadyDecision([
              32,
            ]);
          },
        };

        const runtime =
          new HeatmapDynamicLiveTerminalController(
            {
              sessionId:
                'heatmap-semantics-failure',

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

            semantics,
          );

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          17,
        );

        expect(
          () =>
            runtime.ingestLiveSpin(
              32,
            ),
        ).toThrow(
          'synthetic_heatmap_semantics_failure',
        );

        expect(
          runtime.pendingCounterfactualDecision(),
        ).not.toBeNull();

        expect(
          runtime.counterfactualHistory(),
        ).toHaveLength(
          0,
        );
      },
    );


    test(
      'snapshot exposes settlement totals without execution authority',
      () => {
        const runtime =
          controllerWithDecisions([
            paperReadyDecision([
              32,
            ]),

            observeDecision(),
          ]);

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          17,
        );

        expect(
          runtime.snapshot()
            .counterfactualPending,
        ).toBe(
          true,
        );

        runtime.ingestLiveSpin(
          32,
        );

        const snapshot =
          runtime.snapshot();

        expect(
          snapshot.counterfactualPending,
        ).toBe(
          false,
        );

        expect(
          snapshot.counterfactualSettledCount,
        ).toBe(
          1,
        );

        expect(
          snapshot.counterfactualWinCount,
        ).toBe(
          1,
        );

        expect(
          snapshot.counterfactualLossCount,
        ).toBe(
          0,
        );

        expect(
          snapshot.bankrollChanged,
        ).toBe(
          false,
        );

        expect(
          snapshot.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );
      },
    );


    test(
      'controller remains Heatmap Dynamic and never claims Fusion Reduzida identity',
      () => {
        const runtime =
          controllerWithDecisions([
            paperReadyDecision([
              32,
            ]),
          ]);

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
          result.decision
            .hypothesis
            .strategyId,
        ).toBe(
          'heatmap-dynamic',
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
      'controller exposes no stake bankroll or betting API',
      () => {
        const runtime =
          controllerWithDecisions([]);

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
          runtime.setBankroll,
        ).toBeUndefined();

        expect(
          runtime.applyWin,
        ).toBeUndefined();

        expect(
          runtime.applyLoss,
        ).toBeUndefined();
      },
    );
  },
);
