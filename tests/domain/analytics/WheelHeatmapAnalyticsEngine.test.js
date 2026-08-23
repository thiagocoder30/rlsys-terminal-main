const {
  WheelHeatmapAnalyticsEngine,
} = require('../../../dist/domain/analytics/WheelHeatmapAnalyticsEngine.js');

describe(
  'WheelHeatmapAnalyticsEngine',
  () => {
    test(
      'exposes canonical European wheel order',
      () => {
        const engine =
          new WheelHeatmapAnalyticsEngine();

        const order =
          engine.wheelOrder();

        expect(
          order,
        ).toHaveLength(
          37,
        );

        expect(
          order[0],
        ).toBe(
          0,
        );

        expect(
          order[1],
        ).toBe(
          32,
        );

        expect(
          order[36],
        ).toBe(
          26,
        );
      },
    );


    test(
      'identifies hot numbers by frequency and recency',
      () => {
        const engine =
          new WheelHeatmapAnalyticsEngine();

        const history = [
          7, 7, 7, 7, 7,
          28, 12, 35, 3, 26,
          7, 7, 7, 7, 7,
        ];

        const report =
          engine.analyze(
            history,
            {
              recentWindow: 10,
              neighborRadius: 2,
              hotThreshold: 60,
            },
          );

        const seven =
          report.numbers.find(
            (item) =>
              item.number ===
              7,
          );

        expect(
          seven,
        ).toBeDefined();

        expect(
          seven.count,
        ).toBeGreaterThanOrEqual(
          10,
        );

        expect(
          seven.heatScore,
        ).toBeGreaterThanOrEqual(
          60,
        );

        expect(
          report.hotNumbers.some(
            (item) =>
              item.number ===
              7,
          ),
        ).toBe(
          true,
        );
      },
    );


    test(
      'identifies absent numbers as cold',
      () => {
        const engine =
          new WheelHeatmapAnalyticsEngine();

        const history =
          Array.from(
            {
              length: 30,
            },
            () => 7,
          );

        const report =
          engine.analyze(
            history,
            {
              recentWindow: 10,
              coldThreshold: 35,
            },
          );

        const zero =
          report.numbers.find(
            (item) =>
              item.number ===
              0,
          );

        expect(
          zero,
        ).toBeDefined();

        expect(
          zero.count,
        ).toBe(
          0,
        );

        expect(
          zero.lastSeenDistance,
        ).toBeNull();

        expect(
          zero.absenceScore,
        ).toBe(
          100,
        );

        expect(
          report.coldNumbers.some(
            (item) =>
              item.number ===
              0,
          ),
        ).toBe(
          true,
        );
      },
    );


    test(
      'calculates wheel-neighbor pressure',
      () => {
        const engine =
          new WheelHeatmapAnalyticsEngine();

        const history = [
          7, 28, 12, 35, 3, 26,
          7, 28, 12, 35, 3, 26,
          7, 28, 12, 35, 3, 26,
        ];

        const report =
          engine.analyze(
            history,
            {
              recentWindow: 12,
              neighborRadius: 2,
            },
          );

        const seven =
          report.numbers.find(
            (item) =>
              item.number ===
              7,
          );

        expect(
          seven,
        ).toBeDefined();

        expect(
          seven.neighborPressureScore,
        ).toBeGreaterThan(
          50,
        );

        expect(
          report.fusionPressureScore,
        ).toBeGreaterThanOrEqual(
          0,
        );
      },
    );


    test(
      'calculates canonical hot and cold sectors',
      () => {
        const engine =
          new WheelHeatmapAnalyticsEngine();

        const history = [
          27, 13, 36, 11, 30, 8,
          23, 10, 5, 24, 16, 33,
          27, 13, 36, 11, 30, 8,
          23, 10, 5, 24, 16, 33,
        ];

        const report =
          engine.analyze(
            history,
            {
              recentWindow: 12,
              hotThreshold: 55,
            },
          );

        const tiers =
          report.sectorSummaries.find(
            (sector) =>
              sector.sectorId ===
              'TIERS',
          );

        expect(
          tiers,
        ).toBeDefined();

        expect(
          tiers.totalHits,
        ).toBeGreaterThanOrEqual(
          24,
        );

        expect(
          report.hotSectors.some(
            (sector) =>
              sector.sectorId ===
              'TIERS',
          ),
        ).toBe(
          true,
        );
      },
    );


    test(
      'filters invalid roulette values from analytical history',
      () => {
        const engine =
          new WheelHeatmapAnalyticsEngine();

        const report =
          engine.analyze(
            [
              1,
              2,
              37,
              -1,
              3,
              99,
              0,
            ],
          );

        expect(
          report.sampleSize,
        ).toBe(
          4,
        );
      },
    );


    test(
      'generates audit text suitable for future operator diagnostics',
      () => {
        const engine =
          new WheelHeatmapAnalyticsEngine();

        const report =
          engine.analyze(
            [
              7,
              7,
              28,
              12,
              35,
              3,
              26,
            ],
          );

        expect(
          report.auditText,
        ).toContain(
          'WHEEL HEATMAP ANALYTICS',
        );

        expect(
          report.auditText,
        ).toContain(
          'HOT_NUMBERS=',
        );

        expect(
          report.auditText,
        ).toContain(
          'COLD_NUMBERS=',
        );
      },
    );


    test(
      'preserves PAPER-only governance',
      () => {
        const engine =
          new WheelHeatmapAnalyticsEngine();

        const report =
          engine.analyze(
            Array.from(
              {
                length: 100,
              },
              () => 7,
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
