const {
  HeatmapDynamicProspectiveDecisionSemantics,
} = require(
  '../../../dist/application/runtime/HeatmapDynamicProspectiveDecisionSemantics.js',
);


function report(
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
          85,

        confidenceContribution:
          68,
      },
    ],

    hotNumberCount:
      2,

    coldNumberCount:
      5,

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
      'FUSION_HEATMAP_SAMPLE:100',
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


describe(
  'HeatmapDynamicProspectiveDecisionSemantics',
  () => {
    const semantics =
      new HeatmapDynamicProspectiveDecisionSemantics();


    test(
      'FUSION_READY becomes PAPER_READY under Heatmap Dynamic identity',
      () => {
        const result =
          semantics.resolve(
            report(),
          );

        expect(
          result.status,
        ).toBe(
          'PAPER_READY',
        );

        expect(
          result.hypothesis,
        ).not.toBeNull();

        expect(
          result.hypothesis.strategyId,
        ).toBe(
          'heatmap-dynamic',
        );
      },
    );


    test(
      'top dynamic target remains the prospective target',
      () => {
        const result =
          semantics.resolve(
            report(),
          );

        expect(
          result.hypothesis
            .targetRegionId,
        ).toBe(
          'HOT_NUMBER_7',
        );

        expect(
          result.hypothesis
            .targetNumbers,
        ).toEqual([
          7,
        ]);

        expect(
          result.hypothesis.source,
        ).toBe(
          'HOT_NUMBER_CLUSTER',
        );
      },
    );


    test(
      'dynamic sector target is preserved when ranked first',
      () => {
        const result =
          semantics.resolve(
            report({
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
                  ],

                  heatScore:
                    90,

                  confidenceContribution:
                    72,
                },
              ],
            }),
          );

        expect(
          result.hypothesis
            .targetRegionId,
        ).toBe(
          'TIERS',
        );

        expect(
          result.hypothesis
            .targetNumbers,
        ).toEqual([
          27,
          13,
          36,
        ]);
      },
    );


    test(
      'OBSERVE produces no prospective hypothesis',
      () => {
        const result =
          semantics.resolve(
            report({
              mode:
                'OBSERVE',

              signalStrength:
                'WEAK',
            }),
          );

        expect(
          result.status,
        ).toBe(
          'OBSERVE',
        );

        expect(
          result.hypothesis,
        ).toBeNull();
      },
    );


    test(
      'BLOCKED produces no prospective hypothesis',
      () => {
        const result =
          semantics.resolve(
            report({
              mode:
                'BLOCKED',

              blockers: [
                'SYNTHETIC_BLOCKER',
              ],
            }),
          );

        expect(
          result.status,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.hypothesis,
        ).toBeNull();
      },
    );


    test(
      'Heatmap Dynamic never claims Fusion Reduzida identity',
      () => {
        const result =
          semantics.resolve(
            report(),
          );

        expect(
          result.hypothesis
            .strategyId,
        ).not.toBe(
          'fusion-reduzida',
        );

        expect(
          result.reasons,
        ).toContain(
          'HEATMAP_DYNAMIC_PROSPECTIVE_PAPER_READY',
        );
      },
    );


    test(
      'governance remains PAPER-only and manual',
      () => {
        const result =
          semantics.resolve(
            report(),
          );

        expect(
          result.paperOnly,
        ).toBe(
          true,
        );

        expect(
          result.recommendationOnly,
        ).toBe(
          true,
        );

        expect(
          result.liveMoneyAuthorization,
        ).toBe(
          false,
        );

        expect(
          result.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );

        expect(
          result.operatorDecisionRequired,
        ).toBe(
          true,
        );

        expect(
          semantics.executeBet,
        ).toBeUndefined();
      },
    );
  },
);
