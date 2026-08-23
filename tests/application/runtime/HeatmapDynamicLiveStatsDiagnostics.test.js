const {
  HeatmapDynamicLiveStatsDiagnostics,
} = require(
  '../../../dist/application/runtime/HeatmapDynamicLiveStatsDiagnostics.js',
);


function result({
  liveSpinIndex,
  spin,
  status = 'OBSERVE',
  targetNumbers = [32],
  region = 'HOT_NUMBER_32',
  registeredDecisionIndex = null,
  settledDecisionIndex = null,
  settlementOutcome = null,
  pressure = 50,
  confidence = 0.60,
  risk = 0.40,
}) {
  const registered =
    registeredDecisionIndex ===
      null
      ? null
      : {
          decisionIndex:
            registeredDecisionIndex,

          targetNumbers,

          targetSize:
            targetNumbers.length,

          coveragePercent:
            Math.round(
              (
                targetNumbers.length /
                37
              ) *
              1000,
            ) /
            10,
        };

  return {
    strategyId:
      'heatmap-dynamic',

    spin,

    liveSpinIndex,

    totalHistorySize:
      200 +
      liveSpinIndex,

    appliesFromNextSpin:
      true,

    analysis: {
      mode:
        status ===
          'PAPER_READY'
          ? 'FUSION_READY'
          : status,

      signalStrength:
        status ===
          'PAPER_READY'
          ? 'STRONG'
          : 'WEAK',

      fusionPressureScore:
        pressure,

      recencyPressureScore:
        48,

      dispersionScore:
        40,

      fusionConfidenceScore:
        confidence,

      fusionRiskScore:
        risk,

      targetRegions: [
        {
          regionId:
            region,

          numbers:
            targetNumbers,
        },
      ],

      blockers:
        [],

      warnings:
        [],
    },

    decision: {
      status,

      hypothesis:
        status ===
          'PAPER_READY'
          ? {
              strategyId:
                'heatmap-dynamic',

              targetRegionId:
                region,

              targetNumbers,
            }
          : null,

      blockers:
        [],

      warnings:
        [],

      reasons:
        [],
    },

    previousSettlement:
      settledDecisionIndex ===
        null
        ? null
        : {
            decisionIndex:
              settledDecisionIndex,

            targetNumbers,

            targetSize:
              targetNumbers.length,

            coveragePercent:
              Math.round(
                (
                  targetNumbers.length /
                  37
                ) *
                1000,
              ) /
              10,

            outcome:
              settlementOutcome,

            settledBySpin:
              spin,
          },

    registeredCounterfactualDecision:
      registered,

    counterfactual: {
      pending:
        registered,
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
  };
}


describe(
  'HeatmapDynamicLiveStatsDiagnostics',
  () => {
    test(
      'starts empty',
      () => {
        const stats =
          new HeatmapDynamicLiveStatsDiagnostics();

        const snapshot =
          stats.snapshot();

        expect(
          snapshot.strategyId,
        ).toBe(
          'heatmap-dynamic',
        );

        expect(
          snapshot.liveSpinCount,
        ).toBe(
          0,
        );

        expect(
          snapshot.counterfactualHitRate,
        ).toBeNull();
      },
    );


    test(
      'counts decision states',
      () => {
        const stats =
          new HeatmapDynamicLiveStatsDiagnostics();

        stats.record(
          result({
            liveSpinIndex:
              1,

            spin:
              17,

            status:
              'BLOCKED',
          }),
        );

        stats.record(
          result({
            liveSpinIndex:
              2,

            spin:
              20,

            status:
              'OBSERVE',
          }),
        );

        stats.record(
          result({
            liveSpinIndex:
              3,

            spin:
              32,

            status:
              'PAPER_READY',

            registeredDecisionIndex:
              1,
          }),
        );

        const snapshot =
          stats.snapshot();

        expect(
          snapshot.blockedCount,
        ).toBe(
          1,
        );

        expect(
          snapshot.observeCount,
        ).toBe(
          1,
        );

        expect(
          snapshot.paperReadyCount,
        ).toBe(
          1,
        );
      },
    );


    test(
      'tracks target size and wheel coverage',
      () => {
        const stats =
          new HeatmapDynamicLiveStatsDiagnostics();

        stats.record(
          result({
            liveSpinIndex:
              1,

            spin:
              17,

            targetNumbers: [
              32,
            ],
          }),
        );

        stats.record(
          result({
            liveSpinIndex:
              2,

            spin:
              20,

            targetNumbers: [
              7,
              15,
              32,
            ],
          }),
        );

        const snapshot =
          stats.snapshot();

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
      'tracks prospective WIN and LOSS settlements',
      () => {
        const stats =
          new HeatmapDynamicLiveStatsDiagnostics();

        stats.record(
          result({
            liveSpinIndex:
              1,

            spin:
              17,

            status:
              'PAPER_READY',

            registeredDecisionIndex:
              1,
          }),
        );

        stats.record(
          result({
            liveSpinIndex:
              2,

            spin:
              32,

            status:
              'PAPER_READY',

            settledDecisionIndex:
              1,

            settlementOutcome:
              'WIN',

            registeredDecisionIndex:
              2,
          }),
        );

        stats.record(
          result({
            liveSpinIndex:
              3,

            spin:
              7,

            status:
              'OBSERVE',

            settledDecisionIndex:
              2,

            settlementOutcome:
              'LOSS',
          }),
        );

        const snapshot =
          stats.snapshot();

        expect(
          snapshot.counterfactualDecisionCount,
        ).toBe(
          2,
        );

        expect(
          snapshot.counterfactualSettledCount,
        ).toBe(
          2,
        );

        expect(
          snapshot.counterfactualWinCount,
        ).toBe(
          1,
        );

        expect(
          snapshot.counterfactualLossCount,
        ).toBe(
          1,
        );

        expect(
          snapshot.counterfactualHitRate,
        ).toBe(
          50,
        );
      },
    );


    test(
      'calculates maximum LOSS streak',
      () => {
        const stats =
          new HeatmapDynamicLiveStatsDiagnostics();

        const outcomes = [
          'LOSS',
          'LOSS',
          'WIN',
          'LOSS',
          'LOSS',
          'LOSS',
        ];

        outcomes.forEach(
          (
            outcome,
            index,
          ) => {
            stats.record(
              result({
                liveSpinIndex:
                  index +
                  1,

                spin:
                  17,

                settledDecisionIndex:
                  index +
                  1,

                settlementOutcome:
                  outcome,
              }),
            );
          },
        );

        expect(
          stats.snapshot()
            .counterfactualMaxLossStreak,
        ).toBe(
          3,
        );
      },
    );


    test(
      'keeps latest event window continuous',
      () => {
        const stats =
          new HeatmapDynamicLiveStatsDiagnostics();

        for (
          let index = 1;
          index <= 10;
          index += 1
        ) {
          stats.record(
            result({
              liveSpinIndex:
                index,

              spin:
                index,
            }),
          );
        }

        expect(
          stats
            .snapshot(
              4,
            )
            .latestEvents
            .map(
              (event) =>
                event.liveSpinIndex,
            ),
        ).toEqual([
          7,
          8,
          9,
          10,
        ]);
      },
    );


    test(
      'diagnostics remain bankroll-neutral and non-executing',
      () => {
        const stats =
          new HeatmapDynamicLiveStatsDiagnostics();

        const snapshot =
          stats.snapshot();

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
          snapshot.bankrollChanged,
        ).toBe(
          false,
        );

        expect(
          snapshot.automaticExecution,
        ).toBe(
          false,
        );

        expect(
          stats.placeBet,
        ).toBeUndefined();

        expect(
          stats.executeBet,
        ).toBeUndefined();
      },
    );
  },
);
