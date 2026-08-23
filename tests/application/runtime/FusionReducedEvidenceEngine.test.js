const {
  FusionReducedEvidenceEngine,
} = require(
  '../../../dist/application/runtime/FusionReducedEvidenceEngine.js',
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


function repeated(
  values,
  total,
) {
  const result =
    [];

  while (
    result.length <
    total
  ) {
    result.push(
      ...values,
    );
  }

  return result.slice(
    0,
    total,
  );
}


describe(
  'FusionReducedEvidenceEngine',
  () => {
    test(
      'uses exclusively the fixed Fusion Reduced doctrine target',
      () => {
        const report =
          new FusionReducedEvidenceEngine()
            .analyze(
              [],
            );

        expect(
          report.strategyId,
        ).toBe(
          'fusion-reduced',
        );

        expect(
          report.targetSize,
        ).toBe(
          19,
        );

        expect(
          report.targetNumbers,
        ).toEqual(
          TARGET,
        );

        expect(
          report.targetNumbers,
        ).toHaveLength(
          19,
        );

        expect(
          report.expectedCoverageRate,
        ).toBeCloseTo(
          19 / 37,
          4,
        );
      },
    );


    test(
      'blocks an insufficient historical sample',
      () => {
        const report =
          new FusionReducedEvidenceEngine()
            .analyze(
              repeated(
                [
                  23,
                  0,
                ],
                30,
              ),
            );

        expect(
          report.eligible,
        ).toBe(
          false,
        );

        expect(
          report.blockers,
        ).toContain(
          'FUSION_REDUCED_SAMPLE_INSUFFICIENT',
        );
      },
    );


    test(
      'blocks when overall fixed-target rate is below gate',
      () => {
        const history = [
          ...Array(
            40,
          ).fill(
            23,
          ),

          ...Array(
            40,
          ).fill(
            0,
          ),
        ];

        const report =
          new FusionReducedEvidenceEngine()
            .analyze(
              history,
            );

        expect(
          report.sampleSize,
        ).toBe(
          80,
        );

        expect(
          report.observedHitRate,
        ).toBe(
          0.5,
        );

        expect(
          report.eligible,
        ).toBe(
          false,
        );

        expect(
          report.blockers,
        ).toContain(
          'FUSION_REDUCED_OVERALL_RATE_BELOW_GATE',
        );
      },
    );


    test(
      'blocks when recent fixed-target evidence is below gate',
      () => {
        const history = [
          ...Array(
            60,
          ).fill(
            23,
          ),

          ...Array(
            14,
          ).fill(
            0,
          ),

          ...Array(
            10,
          ).fill(
            23,
          ),
        ];

        const report =
          new FusionReducedEvidenceEngine()
            .analyze(
              history,
            );

        expect(
          report.sampleSize,
        ).toBeGreaterThanOrEqual(
          74,
        );

        expect(
          report.recentSampleSize,
        ).toBe(
          24,
        );

        expect(
          report.recentHitRate,
        ).toBeCloseTo(
          10 / 24,
          4,
        );

        expect(
          report.blockers,
        ).toContain(
          'FUSION_REDUCED_RECENT_RATE_BELOW_GATE',
        );
      },
    );


    test(
      'releases empirical PAPER eligibility when transparent gates pass',
      () => {
        /*
         * 80 samples.
         *
         * Overall:
         * 48 hits / 80 = 60%.
         *
         * Last 24:
         * 15 hits / 24 = 62.5%.
         *
         * This is deliberately synthetic.
         * The test proves the gate contract, not roulette prediction.
         */
        const history = [
          ...Array(
            33,
          ).fill(
            23,
          ),

          ...Array(
            23,
          ).fill(
            0,
          ),

          ...Array(
            15,
          ).fill(
            23,
          ),

          ...Array(
            9,
          ).fill(
            0,
          ),
        ];

        const report =
          new FusionReducedEvidenceEngine()
            .analyze(
              history,
            );

        expect(
          report.sampleSize,
        ).toBe(
          80,
        );

        expect(
          report.observedHitRate,
        ).toBe(
          0.6,
        );

        expect(
          report.recentHitRate,
        ).toBe(
          0.625,
        );

        expect(
          report.eligible,
        ).toBe(
          true,
        );

        expect(
          report.blockers,
        ).toEqual(
          [],
        );

        expect(
          report.reasons,
        ).toContain(
          'FUSION_REDUCED_EMPIRICAL_GATE_PASSED',
        );
      },
    );


    test(
      'allows thresholds to be configured for counterfactual calibration',
      () => {
        const history = [
          ...Array(
            20,
          ).fill(
            23,
          ),

          ...Array(
            20,
          ).fill(
            0,
          ),
        ];

        const report =
          new FusionReducedEvidenceEngine()
            .analyze(
              history,
              {
                minimumSampleSize:
                  20,

                recentWindowSize:
                  10,

                minimumOverallHitRate:
                  0.4,

                minimumRecentHitRate:
                  0.4,

                maximumRateDrift:
                  0.6,
              },
            );

        expect(
          report.sampleSize,
        ).toBe(
          40,
        );

        /*
         * Last 10 are all zero, so the recent gate must still
         * block even though the global gate was relaxed.
         */
        expect(
          report.eligible,
        ).toBe(
          false,
        );

        expect(
          report.blockers,
        ).toContain(
          'FUSION_REDUCED_RECENT_RATE_BELOW_GATE',
        );
      },
    );


    test(
      'rejects invalid roulette spins',
      () => {
        const engine =
          new FusionReducedEvidenceEngine();

        expect(
          () =>
            engine.analyze(
              [
                23,
                37,
              ],
            ),
        ).toThrow(
          'fusion_reduced_invalid_spin',
        );
      },
    );


    test(
      'remains PAPER-only and exposes no betting authority',
      () => {
        const engine =
          new FusionReducedEvidenceEngine();

        const report =
          engine.analyze(
            [],
          );

        expect(
          report.paperOnly,
        ).toBe(
          true,
        );

        expect(
          report.recommendationOnly,
        ).toBe(
          true,
        );

        expect(
          report.automaticExecutionAllowed,
        ).toBe(
          false,
        );

        expect(
          engine.placeBet,
        ).toBeUndefined();

        expect(
          engine.executeBet,
        ).toBeUndefined();

        expect(
          engine.setBankroll,
        ).toBeUndefined();
      },
    );
  },
);
