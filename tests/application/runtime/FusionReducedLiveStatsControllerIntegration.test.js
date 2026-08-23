const {
  FusionReducedLiveTerminalController,
} = require(
  '../../../dist/application/runtime/FusionReducedLiveTerminalController.js',
);


function eligibleHistory() {
  return [
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
}


function controller(
  sessionId =
    'fusion-reduced-stats',
) {
  return new FusionReducedLiveTerminalController({
    sessionId,

    synchronizedHistory:
      eligibleHistory(),
  });
}


describe(
  'FusionReducedLiveTerminalController stats integration',
  () => {
    test(
      'stats exist before first LIVE spin',
      () => {
        const runtime =
          controller();

        const stats =
          runtime.statsSnapshot();

        expect(
          stats.strategyId,
        ).toBe(
          'fusion-reduced',
        );

        expect(
          stats.liveSpinCount,
        ).toBe(
          0,
        );

        expect(
          stats.targetCenter,
        ).toBe(
          23,
        );

        expect(
          stats.targetSize,
        ).toBe(
          19,
        );

        expect(
          stats.coveragePercent,
        ).toBeCloseTo(
          51.35,
          2,
        );
      },
    );


    test(
      'each accepted LIVE spin creates exactly one diagnostic event',
      () => {
        const runtime =
          controller(
            'fusion-reduced-stats-live',
          );

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          23,
        );

        runtime.ingestLiveSpin(
          17,
        );

        const stats =
          runtime.statsSnapshot();

        expect(
          stats.liveSpinCount,
        ).toBe(
          2,
        );

        expect(
          stats.latestEvents,
        ).toHaveLength(
          2,
        );

        expect(
          stats.latestEvents.map(
            (event) =>
              event.liveSpinIndex,
          ),
        ).toEqual([
          1,
          2,
        ]);
      },
    );


    test(
      'catch-up changes chronology without creating LIVE diagnostics',
      () => {
        const runtime =
          controller(
            'fusion-reduced-stats-catch-up',
          );

        runtime.confirmHistoryCurrent(
          'n',
        );

        runtime.recordCatchUpSpin(
          17,
        );

        runtime.recordCatchUpSpin(
          0,
        );

        runtime.finishCatchUp();

        const stats =
          runtime.statsSnapshot();

        expect(
          stats.liveSpinCount,
        ).toBe(
          0,
        );

        expect(
          stats.latestEvents,
        ).toHaveLength(
          0,
        );

        expect(
          runtime.snapshot()
            .catchUpSpinCount,
        ).toBe(
          2,
        );
      },
    );


    test(
      'PAPER_READY and next-spin settlement remain observable',
      () => {
        const runtime =
          controller(
            'fusion-reduced-stats-settlement',
          );

        runtime.confirmHistoryCurrent(
          's',
        );

        const first =
          runtime.ingestLiveSpin(
            23,
          );

        expect(
          first.decision.status,
        ).toBe(
          'PAPER_READY',
        );

        runtime.ingestLiveSpin(
          17,
        );

        const stats =
          runtime.statsSnapshot();

        expect(
          stats.paperReadyCount,
        ).toBeGreaterThanOrEqual(
          1,
        );

        expect(
          stats.counterfactualDecisionCount,
        ).toBeGreaterThanOrEqual(
          1,
        );

        expect(
          stats.counterfactualSettledCount,
        ).toBeGreaterThanOrEqual(
          1,
        );

        expect(
          stats.counterfactualWinCount,
        ).toBeGreaterThanOrEqual(
          1,
        );
      },
    );


    test(
      'stats remain strictly recommendation-only',
      () => {
        const runtime =
          controller(
            'fusion-reduced-stats-governance',
          );

        const stats =
          runtime.statsSnapshot();

        expect(
          stats.paperOnly,
        ).toBe(
          true,
        );

        expect(
          stats.recommendationOnly,
        ).toBe(
          true,
        );

        expect(
          stats.bankrollChanged,
        ).toBe(
          false,
        );

        expect(
          stats.automaticExecution,
        ).toBe(
          false,
        );

        expect(
          runtime.executeBet,
        ).toBeUndefined();

        expect(
          runtime.placeBet,
        ).toBeUndefined();
      },
    );
  },
);
