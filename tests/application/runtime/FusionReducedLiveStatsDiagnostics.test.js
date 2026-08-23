const {
  FusionReducedLiveStatsDiagnostics,
} = require(
  '../../../dist/application/runtime/FusionReducedLiveStatsDiagnostics.js',
);


function result({
  liveSpinIndex,
  spin,
  status = 'OBSERVE',
  eligible = false,
  hypothesisCreated = false,
  settlementOutcome = null,
  confidence = 0.50,
  risk = 0.50,
  observedHitRate = 0.52,
  recentHitRate = 0.50,
  drift = 0.02,
  blockers = [],
}) {
  return {
    strategyId:
      'fusion-reduced',

    liveSpinIndex,

    spin,

    evidence: {
      eligible,

      confidenceScore:
        confidence,

      riskScore:
        risk,

      observedHitRate,

      recentHitRate,

      rateDrift:
        drift,

      sampleSize:
        100,

      recentSampleSize:
        24,
    },

    decision: {
      status,

      blockers,

      warnings:
        [],

      reasons:
        [],
    },

    registeredCounterfactualDecision:
      hypothesisCreated
        ? {
            targetNumbers:
              Array(
                19,
              ).fill(
                23,
              ),
          }
        : null,

    previousSettlement:
      settlementOutcome ===
        null
        ? null
        : {
            outcome:
              settlementOutcome,

            spin,
          },
  };
}


describe(
  'FusionReducedLiveStatsDiagnostics',
  () => {
    test(
      'starts empty with fixed nominal coverage',
      () => {
        const stats =
          new FusionReducedLiveStatsDiagnostics();

        const snapshot =
          stats.snapshot();

        expect(
          snapshot.liveSpinCount,
        ).toBe(
          0,
        );

        expect(
          snapshot.targetCenter,
        ).toBe(
          23,
        );

        expect(
          snapshot.targetSize,
        ).toBe(
          19,
        );

        expect(
          snapshot.coveragePercent,
        ).toBeCloseTo(
          51.35,
          2,
        );

        expect(
          snapshot.counterfactualHitRate,
        ).toBeNull();
      },
    );


    test(
      'counts BLOCKED OBSERVE and PAPER_READY states',
      () => {
        const stats =
          new FusionReducedLiveStatsDiagnostics();

        stats.record(
          result({
            liveSpinIndex:
              1,

            spin:
              0,

            status:
              'BLOCKED',
          }),
        );

        stats.record(
          result({
            liveSpinIndex:
              2,

            spin:
              7,

            status:
              'OBSERVE',
          }),
        );

        stats.record(
          result({
            liveSpinIndex:
              3,

            spin:
              23,

            status:
              'PAPER_READY',

            eligible:
              true,

            hypothesisCreated:
              true,
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
      'accumulates empirical evidence metrics',
      () => {
        const stats =
          new FusionReducedLiveStatsDiagnostics();

        stats.record(
          result({
            liveSpinIndex:
              1,

            spin:
              23,

            confidence:
              0.60,

            risk:
              0.40,

            observedHitRate:
              0.55,

            recentHitRate:
              0.58,

            drift:
              0.03,
          }),
        );

        stats.record(
          result({
            liveSpinIndex:
              2,

            spin:
              17,

            confidence:
              0.80,

            risk:
              0.20,

            observedHitRate:
              0.65,

            recentHitRate:
              0.62,

            drift:
              0.03,
          }),
        );

        const snapshot =
          stats.snapshot();

        expect(
          snapshot.averageConfidenceScore,
        ).toBe(
          0.7,
        );

        expect(
          snapshot.averageRiskScore,
        ).toBe(
          0.3,
        );

        expect(
          snapshot.averageObservedHitRate,
        ).toBe(
          0.6,
        );

        expect(
          snapshot.averageRecentHitRate,
        ).toBe(
          0.6,
        );

        expect(
          snapshot.averageRateDrift,
        ).toBe(
          0.03,
        );
      },
    );


    test(
      'tracks counterfactual WIN and LOSS',
      () => {
        const stats =
          new FusionReducedLiveStatsDiagnostics();

        stats.record(
          result({
            liveSpinIndex:
              1,

            spin:
              23,

            status:
              'PAPER_READY',

            eligible:
              true,

            hypothesisCreated:
              true,
          }),
        );

        stats.record(
          result({
            liveSpinIndex:
              2,

            spin:
              17,

            status:
              'PAPER_READY',

            eligible:
              true,

            hypothesisCreated:
              true,

            settlementOutcome:
              'WIN',
          }),
        );

        stats.record(
          result({
            liveSpinIndex:
              3,

            spin:
              0,

            status:
              'OBSERVE',

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
      'calculates maximum consecutive LOSS streak',
      () => {
        const stats =
          new FusionReducedLiveStatsDiagnostics();

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
                  0,

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
      'counts blockers by frequency',
      () => {
        const stats =
          new FusionReducedLiveStatsDiagnostics();

        stats.record(
          result({
            liveSpinIndex:
              1,

            spin:
              0,

            status:
              'BLOCKED',

            blockers: [
              'SAMPLE_LOW',
            ],
          }),
        );

        stats.record(
          result({
            liveSpinIndex:
              2,

            spin:
              1,

            status:
              'BLOCKED',

            blockers: [
              'SAMPLE_LOW',
              'RECENT_LOW',
            ],
          }),
        );

        expect(
          stats.snapshot()
            .blockerFrequency,
        ).toEqual([
          {
            blocker:
              'SAMPLE_LOW',

            count:
              2,
          },

          {
            blocker:
              'RECENT_LOW',

            count:
              1,
          },
        ]);
      },
    );


    test(
      'keeps latest event window chronological',
      () => {
        const stats =
          new FusionReducedLiveStatsDiagnostics();

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
      'remains bankroll-neutral and non-executing',
      () => {
        const stats =
          new FusionReducedLiveStatsDiagnostics();

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
