const {
  FusionReducedLiveObservability,
} = require(
  '../../../dist/application/runtime/FusionReducedLiveObservability.js',
);


const TARGET = [
  17, 34, 6,
  27, 13, 36,
  11, 30, 8,
  23,
  10, 5, 24,
  16, 33, 1,
  20, 14, 31,
];


function result(
  overrides = {},
) {
  return {
    strategyId:
      'fusion-reduced',

    spin:
      23,

    liveSpinIndex:
      4,

    totalHistorySize:
      104,

    appliesFromNextSpin:
      true,

    doctrine: {
      strategyId:
        'fusion-reduced',

      centerNumber:
        23,

      leftNeighbors:
        9,

      rightNeighbors:
        9,

      totalCoverage:
        19,

      targetNumbers:
        TARGET,

      wheel:
        'EUROPEAN',

      paperOnly:
        true,

      recommendationOnly:
        true,

      automaticExecutionAllowed:
        false,
    },

    evidence: {
      strategyId:
        'fusion-reduced',

      eligible:
        true,

      confidenceScore:
        0.82,

      riskScore:
        0.18,

      observedHitRate:
        0.60,

      recentHitRate:
        0.625,

      rateDrift:
        0.025,

      sampleSize:
        100,

      recentSampleSize:
        24,
    },

    decision: {
      status:
        'PAPER_READY',

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
      targetNumbers:
        TARGET,
    },

    paperOnly:
      true,

    recommendationOnly:
      true,

    bankrollChanged:
      false,

    automaticBetExecutionAllowed:
      false,

    ...overrides,
  };
}


describe(
  'FusionReducedLiveObservability',
  () => {
    const observability =
      new FusionReducedLiveObservability();


    test(
      'exposes canonical Fusion Reduced identity',
      () => {
        const observation =
          observability.observe(
            result(),
          );

        expect(
          observation.strategyId,
        ).toBe(
          'fusion-reduced',
        );

        expect(
          observation.state,
        ).toBe(
          'PAPER_READY',
        );
      },
    );


    test(
      'exposes fixed 23 plus-minus 9 target',
      () => {
        const observation =
          observability.observe(
            result(),
          );

        expect(
          observation.targetCenter,
        ).toBe(
          23,
        );

        expect(
          observation.targetSize,
        ).toBe(
          19,
        );

        expect(
          observation.targetNumbers,
        ).toEqual(
          TARGET,
        );

        expect(
          observation.coveragePercent,
        ).toBeCloseTo(
          51.35,
          2,
        );
      },
    );


    test(
      'exposes empirical evidence without redefining target',
      () => {
        const observation =
          observability.observe(
            result(),
          );

        expect(
          observation.confidenceScore,
        ).toBe(
          0.82,
        );

        expect(
          observation.observedHitRate,
        ).toBe(
          0.60,
        );

        expect(
          observation.recentHitRate,
        ).toBe(
          0.625,
        );

        expect(
          observation.rateDrift,
        ).toBe(
          0.025,
        );
      },
    );


    test(
      'exposes previous settlement independently from current decision',
      () => {
        const observation =
          observability.observe(
            result({
              previousSettlement: {
                outcome:
                  'WIN',

                spin:
                  17,
              },
            }),
          );

        expect(
          observation.previousSettlementOutcome,
        ).toBe(
          'WIN',
        );

        expect(
          observation.recommendationIssued,
        ).toBe(
          true,
        );
      },
    );


    test(
      'OBSERVE does not issue recommendation',
      () => {
        const base =
          result();

        const observation =
          observability.observe({
            ...base,

            decision: {
              status:
                'OBSERVE',

              blockers:
                [],

              warnings:
                [],

              reasons:
                [],
            },

            registeredCounterfactualDecision:
              null,
          });

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
      'adds no execution capability',
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
