const {
  HeatmapDynamicIntegrationEngine,
} = require(
  '../../../dist/application/runtime/HeatmapDynamicIntegrationEngine.js',
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
  'HeatmapDynamicIntegrationEngine',
  () => {
    test(
      'reuses certified analytical engine without changing analysis',
      () => {
        const expected =
          analyticalReport();

        const underlying = {
          analyze() {
            return expected;
          },
        };

        const engine =
          new HeatmapDynamicIntegrationEngine(
            underlying,
          );

        const result =
          engine.analyze([
            7,
            32,
            15,
          ]);

        expect(
          result,
        ).toBe(
          expected,
        );

        expect(
          result.targetRegions[0]
            .regionId,
        ).toBe(
          'HOT_NUMBER_7',
        );
      },
    );


    test(
      'consensus signal uses Heatmap Dynamic identity',
      () => {
        const engine =
          new HeatmapDynamicIntegrationEngine();

        const signal =
          engine.toConsensusSignal(
            analyticalReport(),
          );

        expect(
          signal.strategyId,
        ).toBe(
          'heatmap-dynamic',
        );

        expect(
          signal.source,
        ).toBe(
          'HEATMAP_DYNAMIC',
        );

        expect(
          signal.suggestedMode,
        ).toBe(
          'PAPER_ONLY',
        );
      },
    );


    test(
      'dynamic identity does not claim to be Fusion Reduzida',
      () => {
        const engine =
          new HeatmapDynamicIntegrationEngine();

        const signal =
          engine.toConsensusSignal(
            analyticalReport(),
          );

        expect(
          signal.strategyId,
        ).not.toBe(
          'fusion-reduzida',
        );

        expect(
          signal.source,
        ).not.toBe(
          'FUSION_REDUZIDA',
        );
      },
    );


    test(
      'BLOCKED analysis maps to blocked consensus mode',
      () => {
        const engine =
          new HeatmapDynamicIntegrationEngine();

        const signal =
          engine.toConsensusSignal(
            analyticalReport({
              mode:
                'BLOCKED',

              blockers: [
                'SYNTHETIC_BLOCKER',
              ],
            }),
          );

        expect(
          signal.suggestedMode,
        ).toBe(
          'BLOCKED',
        );

        expect(
          signal.blockers,
        ).toContain(
          'SYNTHETIC_BLOCKER',
        );
      },
    );


    test(
      'identity wrapper exposes no execution API',
      () => {
        const engine =
          new HeatmapDynamicIntegrationEngine();

        expect(
          engine.placeBet,
        ).toBeUndefined();

        expect(
          engine.executeBet,
        ).toBeUndefined();

        expect(
          engine.settleBet,
        ).toBeUndefined();
      },
    );
  },
);
