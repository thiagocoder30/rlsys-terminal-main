const {
  HeatmapDynamicLiveObservability,
} = require(
  '../../../dist/application/runtime/HeatmapDynamicLiveObservability.js',
);


function result(
  overrides = {},
) {
  return {
    strategyId:
      'heatmap-dynamic',

    spin:
      17,

    liveSpinIndex:
      4,

    totalHistorySize:
      204,

    appliesFromNextSpin:
      true,

    analysis: {
      mode:
        'FUSION_READY',

      signalStrength:
        'STRONG',

      fusionPressureScore:
        70,

      recencyPressureScore:
        65,

      dispersionScore:
        30,

      fusionConfidenceScore:
        0.78,

      fusionRiskScore:
        0.29,

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
            82,
        },
      ],

      blockers:
        [],

      warnings:
        [],
    },

    decision: {
      status:
        'PAPER_READY',

      hypothesis: {
        strategyId:
          'heatmap-dynamic',

        targetRegionId:
          'HOT_NUMBER_32',

        targetNumbers: [
          32,
        ],
      },

      blockers:
        [],

      warnings:
        [],

      reasons:
        [],
    },

    previousSettlement:
      null,

    registeredCounterfactualDecision: {
      decisionIndex:
        3,

      targetNumbers: [
        32,
      ],

      targetSize:
        1,

      coveragePercent:
        2.7,
    },

    paperOnly:
      true,

    recommendationOnly:
      true,

    humanExecutionRequired:
      true,

    bankrollChanged:
      false,

    liveMoneyAuthorization:
      false,

    automaticBetExecutionAllowed:
      false,

    ...overrides,
  };
}


describe(
  'HeatmapDynamicLiveObservability',
  () => {
    const observability =
      new HeatmapDynamicLiveObservability();


    test(
      'exposes canonical Heatmap Dynamic identity',
      () => {
        const observation =
          observability.observe(
            result(),
          );

        expect(
          observation.strategyId,
        ).toBe(
          'heatmap-dynamic',
        );

        expect(
          observation.state,
        ).toBe(
          'PAPER_READY',
        );
      },
    );


    test(
      'exposes dynamic target size and wheel coverage',
      () => {
        const observation =
          observability.observe(
            result(),
          );

        expect(
          observation.targetNumbers,
        ).toEqual([
          32,
        ]);

        expect(
          observation.targetSize,
        ).toBe(
          1,
        );

        expect(
          observation.coveragePercent,
        ).toBe(
          2.7,
        );
      },
    );


    test(
      'exposes registered next-spin decision',
      () => {
        const observation =
          observability.observe(
            result(),
          );

        expect(
          observation.registeredDecisionIndex,
        ).toBe(
          3,
        );

        expect(
          observation.recommendationIssued,
        ).toBe(
          true,
        );
      },
    );


    test(
      'exposes previous counterfactual settlement separately',
      () => {
        const observation =
          observability.observe(
            result({
              previousSettlement: {
                decisionIndex:
                  2,

                outcome:
                  'WIN',

                settledBySpin:
                  17,
              },
            }),
          );

        expect(
          observation.previousSettlementDecisionIndex,
        ).toBe(
          2,
        );

        expect(
          observation.previousSettlementOutcome,
        ).toBe(
          'WIN',
        );

        expect(
          observation.registeredDecisionIndex,
        ).toBe(
          3,
        );
      },
    );


    test(
      'OBSERVE remains non-recommendation',
      () => {
        const observation =
          observability.observe(
            result({
              decision: {
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
              },

              registeredCounterfactualDecision:
                null,
            }),
          );

        expect(
          observation.recommendationIssued,
        ).toBe(
          false,
        );

        expect(
          observation.summary,
        ).toContain(
          'permanece em observação',
        );
      },
    );


    test(
      'observability adds no execution capability',
      () => {
        expect(
          observability.placeBet,
        ).toBeUndefined();

        expect(
          observability.executeBet,
        ).toBeUndefined();

        expect(
          observability.setBankroll,
        ).toBeUndefined();
      },
    );
  },
);
