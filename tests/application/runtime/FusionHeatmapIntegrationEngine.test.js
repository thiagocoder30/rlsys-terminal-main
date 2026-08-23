const {
  FusionHeatmapIntegrationEngine,
} = require('../../../dist/application/runtime/FusionHeatmapIntegrationEngine.js');

function repeat(values, times) {
  const output = [];

  for (let index = 0; index < times; index += 1) {
    output.push(...values);
  }

  return output;
}

function fakeHeatmap(overrides = {}) {
  return {
    sampleSize: 100,
    recentWindow: 30,
    neighborRadius: 2,
    numbers: [],
    hotNumbers: [],
    coldNumbers: [],
    hotSectors: [
      {
        sectorId: 'TIERS',
        numbers: [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33],
        totalHits: 40,
        recentHits: 16,
        heatScore: 90,
        heatLevel: 'HOT',
      },
    ],
    coldSectors: [],
    sectorSummaries: [],
    fusionPressureScore: 80,
    recencyPressureScore: 80,
    dispersionScore: 10,
    auditText: 'FAKE HEATMAP',
    paperOnly: true,
    liveMoneyAuthorized: false,
    productionMoneyAllowed: false,
    ...overrides,
  };
}

function engineWithHeatmap(report) {
  return new FusionHeatmapIntegrationEngine({
    analyze() {
      return report;
    },
  });
}

describe(
  'FusionHeatmapIntegrationEngine',
  () => {
    test(
      'blocks insufficient sample using canonical default minimum',
      () => {
        const engine =
          engineWithHeatmap(
            fakeHeatmap({
              sampleSize: 59,
            }),
          );

        const report =
          engine.analyze([]);

        expect(
          report.mode,
        ).toBe(
          'BLOCKED',
        );

        expect(
          report.blockers,
        ).toContain(
          'FUSION_HEATMAP_SAMPLE_INSUFFICIENT',
        );

        expect(
          report.paperOnly,
        ).toBe(
          true,
        );

        expect(
          report.liveMoneyAuthorized,
        ).toBe(
          false,
        );

        expect(
          report.productionMoneyAllowed,
        ).toBe(
          false,
        );
      },
    );


    test(
      'accepts sample size sixty for canonical sample gate',
      () => {
        const engine =
          engineWithHeatmap(
            fakeHeatmap({
              sampleSize: 60,
            }),
          );

        const report =
          engine.analyze([]);

        expect(
          report.blockers,
        ).not.toContain(
          'FUSION_HEATMAP_SAMPLE_INSUFFICIENT',
        );
      },
    );


    test(
      'canonical pressure gate blocks score below forty five',
      () => {
        const engine =
          engineWithHeatmap(
            fakeHeatmap({
              fusionPressureScore: 44,
            }),
          );

        const report =
          engine.analyze([]);

        expect(
          report.blockers,
        ).toContain(
          'FUSION_HEATMAP_PRESSURE_BELOW_THRESHOLD',
        );

        expect(
          report.mode,
        ).toBe(
          'BLOCKED',
        );
      },
    );


    test(
      'canonical pressure score forty five passes pressure gate',
      () => {
        const engine =
          engineWithHeatmap(
            fakeHeatmap({
              fusionPressureScore: 45,
            }),
          );

        const report =
          engine.analyze([]);

        expect(
          report.blockers,
        ).not.toContain(
          'FUSION_HEATMAP_PRESSURE_BELOW_THRESHOLD',
        );
      },
    );


    test(
      'weak canonical recency creates warning instead of blocker',
      () => {
        const engine =
          engineWithHeatmap(
            fakeHeatmap({
              recencyPressureScore: 44,
            }),
          );

        const report =
          engine.analyze([]);

        expect(
          report.warnings,
        ).toContain(
          'FUSION_HEATMAP_RECENCY_PRESSURE_WEAK',
        );

        expect(
          report.blockers,
        ).not.toContain(
          'FUSION_HEATMAP_RECENCY_PRESSURE_WEAK',
        );
      },
    );


    test(
      'canonical dispersion gate blocks score above seventy five',
      () => {
        const engine =
          engineWithHeatmap(
            fakeHeatmap({
              dispersionScore: 76,
            }),
          );

        const report =
          engine.analyze([]);

        expect(
          report.blockers,
        ).toContain(
          'FUSION_HEATMAP_DISPERSION_TOO_HIGH',
        );

        expect(
          report.mode,
        ).toBe(
          'BLOCKED',
        );
      },
    );


    test(
      'canonical dispersion score seventy five passes dispersion gate',
      () => {
        const engine =
          engineWithHeatmap(
            fakeHeatmap({
              dispersionScore: 75,
            }),
          );

        const report =
          engine.analyze([]);

        expect(
          report.blockers,
        ).not.toContain(
          'FUSION_HEATMAP_DISPERSION_TOO_HIGH',
        );
      },
    );


    test(
      'blocks when no target region exists',
      () => {
        const engine =
          engineWithHeatmap(
            fakeHeatmap({
              hotSectors: [],
              hotNumbers: [],
            }),
          );

        const report =
          engine.analyze([]);

        expect(
          report.targetRegions,
        ).toHaveLength(
          0,
        );

        expect(
          report.blockers,
        ).toContain(
          'FUSION_HEATMAP_NO_TARGET_REGION',
        );

        expect(
          report.mode,
        ).toBe(
          'BLOCKED',
        );
      },
    );


    test(
      'produces deterministic FUSION_READY context with strong canonical evidence',
      () => {
        const engine =
          engineWithHeatmap(
            fakeHeatmap(),
          );

        const report =
          engine.analyze([]);

        expect(
          report.mode,
        ).toBe(
          'FUSION_READY',
        );

        expect(
          report.signalStrength,
        ).toBe(
          'STRONG',
        );

        expect(
          report.blockers,
        ).toHaveLength(
          0,
        );

        expect(
          report.targetRegions.length,
        ).toBeGreaterThan(
          0,
        );

        expect(
          report.targetRegions[0].regionId,
        ).toBe(
          'TIERS',
        );

        expect(
          report.fusionConfidenceScore,
        ).toBeGreaterThanOrEqual(
          0.78,
        );

        expect(
          report.fusionRiskScore,
        ).toBeLessThanOrEqual(
          0.35,
        );
      },
    );


    test(
      'maps FUSION_READY report to PAPER_ONLY consensus signal',
      () => {
        const engine =
          engineWithHeatmap(
            fakeHeatmap(),
          );

        const report =
          engine.analyze([]);

        const signal =
          engine.toConsensusSignal(
            report,
          );

        expect(
          signal.strategyId,
        ).toBe(
          'fusion-reduzida',
        );

        expect(
          signal.source,
        ).toBe(
          'FUSION_REDUZIDA',
        );

        expect(
          signal.enabled,
        ).toBe(
          true,
        );

        expect(
          signal.suggestedMode,
        ).toBe(
          'PAPER_ONLY',
        );

        expect(
          signal.blockers,
        ).toHaveLength(
          0,
        );
      },
    );


    test(
      'real heatmap path creates target region from hot wheel sector',
      () => {
        const engine =
          new FusionHeatmapIntegrationEngine();

        const history =
          repeat(
            [
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
            8,
          );

        const report =
          engine.analyze(
            history,
            {
              recentWindow: 36,
              minSampleSize: 60,
              minFusionPressureScore: 20,
              minRecencyPressureScore: 20,
            },
          );

        expect(
          report.targetRegions.length,
        ).toBeGreaterThan(
          0,
        );

        expect(
          report.targetRegions.some(
            (region) =>
              region.regionId ===
              'TIERS',
          ),
        ).toBe(
          true,
        );

        expect(
          report.fusionConfidenceScore,
        ).toBeGreaterThan(
          0,
        );
      },
    );


    test(
      'preserves PAPER-only governance in every analysis',
      () => {
        const engine =
          new FusionHeatmapIntegrationEngine();

        const report =
          engine.analyze(
            repeat(
              [
                7,
                28,
                12,
                35,
                3,
                26,
              ],
              20,
            ),
          );

        expect(
          report.paperOnly,
        ).toBe(
          true,
        );

        expect(
          report.liveMoneyAuthorized,
        ).toBe(
          false,
        );

        expect(
          report.productionMoneyAllowed,
        ).toBe(
          false,
        );

        expect(
          report.auditText,
        ).toContain(
          'paperOnly=true',
        );

        expect(
          report.auditText,
        ).toContain(
          'liveMoneyAuthorized=false',
        );
      },
    );
  },
);
