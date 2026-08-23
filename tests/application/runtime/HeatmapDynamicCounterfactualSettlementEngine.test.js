const {
  HeatmapDynamicCounterfactualSettlementEngine,
} = require(
  '../../../dist/application/runtime/HeatmapDynamicCounterfactualSettlementEngine.js',
);


function paperReady(
  targetNumbers,
  region =
    'HOT_NUMBER_32',
) {
  return {
    status:
      'PAPER_READY',

    hypothesis: {
      strategyId:
        'heatmap-dynamic',

      targetRegionId:
        region,

      targetNumbers,

      source:
        targetNumbers.length ===
          1
          ? 'HOT_NUMBER_CLUSTER'
          : 'HOT_SECTOR',

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


function observe() {
  return {
    status:
      'OBSERVE',

    hypothesis:
      null,

    blockers:
      [],

    warnings:
      [],

    reasons:
      [],

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
  'HeatmapDynamicCounterfactualSettlementEngine',
  () => {
    test(
      'OBSERVE creates no counterfactual decision point',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        expect(
          engine.registerDecision(
            observe(),
          ),
        ).toBeNull();

        expect(
          engine.pendingDecision(),
        ).toBeNull();
      },
    );


    test(
      'PAPER_READY freezes dynamic target',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        const targets = [
          32,
        ];

        const point =
          engine.registerDecision(
            paperReady(
              targets,
            ),
          );

        targets.push(
          7,
        );

        expect(
          point.strategyId,
        ).toBe(
          'heatmap-dynamic',
        );

        expect(
          point.targetNumbers,
        ).toEqual([
          32,
        ]);

        expect(
          point.targetSize,
        ).toBe(
          1,
        );
      },
    );


    test(
      'one-number target reports correct wheel coverage',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        const point =
          engine.registerDecision(
            paperReady([
              32,
            ]),
          );

        expect(
          point.coveragePercent,
        ).toBe(
          2.7,
        );
      },
    );


    test(
      'nineteen-number dynamic target reports correct wheel coverage',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        const point =
          engine.registerDecision(
            paperReady(
              [
                17,
                34,
                6,
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
                1,
                20,
                14,
                31,
              ],
              'SYNTHETIC_19_REGION',
            ),
          );

        expect(
          point.targetSize,
        ).toBe(
          19,
        );

        expect(
          point.coveragePercent,
        ).toBe(
          51.4,
        );
      },
    );


    test(
      'next LIVE spin inside frozen target settles WIN',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        engine.registerDecision(
          paperReady([
            32,
          ]),
        );

        const settlement =
          engine.settleNextSpin(
            32,
          );

        expect(
          settlement.outcome,
        ).toBe(
          'WIN',
        );

        expect(
          settlement.settledBySpin,
        ).toBe(
          32,
        );
      },
    );


    test(
      'next LIVE spin outside frozen target settles LOSS',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        engine.registerDecision(
          paperReady([
            32,
          ]),
        );

        expect(
          engine
            .settleNextSpin(
              7,
            )
            .outcome,
        ).toBe(
          'LOSS',
        );
      },
    );


    test(
      'zero is ordinary Heatmap Dynamic settlement number',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        engine.registerDecision(
          paperReady([
            0,
            32,
          ]),
        );

        expect(
          engine
            .settleNextSpin(
              0,
            )
            .outcome,
        ).toBe(
          'WIN',
        );
      },
    );


    test(
      'zero is LOSS when absent from dynamic target',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        engine.registerDecision(
          paperReady([
            32,
          ]),
        );

        expect(
          engine
            .settleNextSpin(
              0,
            )
            .outcome,
        ).toBe(
          'LOSS',
        );
      },
    );


    test(
      'one hypothesis settles exactly once',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        engine.registerDecision(
          paperReady([
            32,
          ]),
        );

        expect(
          engine.settleNextSpin(
            32,
          ),
        ).not.toBeNull();

        expect(
          engine.settleNextSpin(
            32,
          ),
        ).toBeNull();

        expect(
          engine.history(),
        ).toHaveLength(
          1,
        );
      },
    );


    test(
      'pending hypothesis cannot be replaced',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        const first =
          engine.registerDecision(
            paperReady([
              32,
            ]),
          );

        const second =
          engine.registerDecision(
            paperReady([
              7,
            ]),
          );

        expect(
          first,
        ).not.toBeNull();

        expect(
          second,
        ).toBeNull();

        expect(
          engine
            .pendingDecision()
            .targetNumbers,
        ).toEqual([
          32,
        ]);
      },
    );


    test(
      'decision indexes remain monotonic',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        const first =
          engine.registerDecision(
            paperReady([
              32,
            ]),
          );

        engine.settleNextSpin(
          7,
        );

        const second =
          engine.registerDecision(
            paperReady([
              15,
            ]),
          );

        expect(
          first.decisionIndex,
        ).toBe(
          1,
        );

        expect(
          second.decisionIndex,
        ).toBe(
          2,
        );
      },
    );


    test(
      'duplicate dynamic targets are canonicalized',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        const point =
          engine.registerDecision(
            paperReady([
              32,
              7,
              32,
              7,
            ]),
          );

        expect(
          point.targetNumbers,
        ).toEqual([
          7,
          32,
        ]);

        expect(
          point.targetSize,
        ).toBe(
          2,
        );
      },
    );


    test(
      'invalid target numbers are excluded',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        const point =
          engine.registerDecision(
            paperReady([
              -1,
              7,
              37,
              32,
            ]),
          );

        expect(
          point.targetNumbers,
        ).toEqual([
          7,
          32,
        ]);
      },
    );


    test(
      'invalid settlement spin does not consume pending hypothesis',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        engine.registerDecision(
          paperReady([
            32,
          ]),
        );

        expect(
          () =>
            engine.settleNextSpin(
              37,
            ),
        ).toThrow(
          'heatmap_dynamic_counterfactual_invalid_spin:37',
        );

        expect(
          engine.pendingDecision(),
        ).not.toBeNull();
      },
    );


    test(
      'snapshot calculates hit rate',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        engine.registerDecision(
          paperReady([
            32,
          ]),
        );

        engine.settleNextSpin(
          32,
        );

        engine.registerDecision(
          paperReady([
            15,
          ]),
        );

        engine.settleNextSpin(
          7,
        );

        const snapshot =
          engine.snapshot();

        expect(
          snapshot.settledCount,
        ).toBe(
          2,
        );

        expect(
          snapshot.winCount,
        ).toBe(
          1,
        );

        expect(
          snapshot.lossCount,
        ).toBe(
          1,
        );

        expect(
          snapshot.hitRate,
        ).toBe(
          50,
        );
      },
    );


    test(
      'snapshot calculates average target size and coverage',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        engine.registerDecision(
          paperReady([
            32,
          ]),
        );

        engine.settleNextSpin(
          32,
        );

        engine.registerDecision(
          paperReady([
            7,
            15,
            32,
          ]),
        );

        engine.settleNextSpin(
          1,
        );

        const snapshot =
          engine.snapshot();

        expect(
          snapshot.averageTargetSize,
        ).toBe(
          2,
        );

        expect(
          snapshot.averageCoveragePercent,
        ).toBe(
          5.4,
        );
      },
    );


    test(
      'snapshot calculates maximum LOSS streak',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        for (
          let index = 0;
          index < 3;
          index += 1
        ) {
          engine.registerDecision(
            paperReady([
              32,
            ]),
          );

          engine.settleNextSpin(
            7,
          );
        }

        engine.registerDecision(
          paperReady([
            32,
          ]),
        );

        engine.settleNextSpin(
          32,
        );

        expect(
          engine.snapshot()
            .maxLossStreak,
        ).toBe(
          3,
        );
      },
    );


    test(
      'settlement remains immutable and counterfactual',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        engine.registerDecision(
          paperReady([
            32,
          ]),
        );

        const settlement =
          engine.settleNextSpin(
            32,
          );

        expect(
          settlement.strategyId,
        ).toBe(
          'heatmap-dynamic',
        );

        expect(
          settlement.paperOnly,
        ).toBe(
          true,
        );

        expect(
          settlement.bankrollChanged,
        ).toBe(
          false,
        );

        expect(
          settlement.automaticExecution,
        ).toBe(
          false,
        );

        expect(
          Object.isFrozen(
            settlement.targetNumbers,
          ),
        ).toBe(
          true,
        );
      },
    );


    test(
      'settlement exposes no betting or bankroll API',
      () => {
        const engine =
          new HeatmapDynamicCounterfactualSettlementEngine();

        expect(
          engine.placeBet,
        ).toBeUndefined();

        expect(
          engine.executeBet,
        ).toBeUndefined();

        expect(
          engine.calculateStake,
        ).toBeUndefined();

        expect(
          engine.setBankroll,
        ).toBeUndefined();
      },
    );
  },
);
