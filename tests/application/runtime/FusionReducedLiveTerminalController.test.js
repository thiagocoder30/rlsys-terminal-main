const {
  FusionReducedLiveTerminalController,
} = require(
  '../../../dist/application/runtime/FusionReducedLiveTerminalController.js',
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


function evidence(
  eligible,
) {
  return {
    strategyId:
      'fusion-reduced',

    eligible,

    confidenceScore:
      eligible
        ? 0.80
        : 0.40,

    riskScore:
      eligible
        ? 0.20
        : 0.60,

    blockers:
      [],

    warnings:
      [],

    reasons:
      [],

    sampleSize:
      100,

    recentSampleSize:
      24,

    targetSize:
      19,

    expectedCoverageRate:
      19 / 37,

    observedHitCount:
      60,

    observedMissCount:
      40,

    observedHitRate:
      0.60,

    recentHitCount:
      15,

    recentMissCount:
      9,

    recentHitRate:
      0.625,

    rateDrift:
      0.025,

    sampleAdequacy:
      1,

    targetNumbers:
      TARGET,

    paperOnly:
      true,

    recommendationOnly:
      true,

    automaticExecutionAllowed:
      false,
  };
}


function paperReadyDecision() {
  return {
    status:
      'PAPER_READY',

    hypothesis: {
      strategyId:
        'fusion-reduced',

      targetNumbers:
        TARGET,

      targetCenter:
        23,

      targetCoverage:
        19,

      createdFor:
        'NEXT_SPIN',

      paperOnly:
        true,

      recommendationOnly:
        true,

      automaticExecutionAllowed:
        false,
    },

    blockers:
      [],

    warnings:
      [],

    reasons:
      [],

    paperOnly:
      true,

    recommendationOnly:
      true,

    automaticExecutionAllowed:
      false,
  };
}


function observeDecision() {
  return {
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

    paperOnly:
      true,

    recommendationOnly:
      true,

    automaticExecutionAllowed:
      false,
  };
}


function controller({
  decisions = [
    observeDecision(),
  ],
} = {}) {
  let decisionIndex =
    0;

  return new FusionReducedLiveTerminalController(
    {
      sessionId:
        'fusion-reduced-test',

      synchronizedHistory: [
        1,
        2,
        3,
      ],
    },

    {
      analyze() {
        return evidence(
          true,
        );
      },
    },

    {
      resolve() {
        const decision =
          decisions[
            decisionIndex
          ] ??
          observeDecision();

        decisionIndex +=
          1;

        return decision;
      },
    },
  );
}


describe(
  'FusionReducedLiveTerminalController',
  () => {
    test(
      'starts behind temporal history confirmation',
      () => {
        const runtime =
          controller();

        const snapshot =
          runtime.snapshot();

        expect(
          snapshot.mode,
        ).toBe(
          'AWAITING_HISTORY_CONFIRMATION',
        );

        expect(
          snapshot.liveSpinCount,
        ).toBe(
          0,
        );
      },
    );


    test(
      'accepts current history and enters LIVE',
      () => {
        const runtime =
          controller();

        const snapshot =
          runtime.confirmHistoryCurrent(
            's',
          );

        expect(
          snapshot.mode,
        ).toBe(
          'LIVE',
        );
      },
    );


    test(
      'supports catch-up without creating LIVE decisions',
      () => {
        const runtime =
          controller();

        runtime.confirmHistoryCurrent(
          'n',
        );

        runtime.recordCatchUpSpin(
          17,
        );

        runtime.recordCatchUpSpin(
          0,
        );

        const before =
          runtime.snapshot();

        expect(
          before.catchUpSpinCount,
        ).toBe(
          2,
        );

        expect(
          before.liveSpinCount,
        ).toBe(
          0,
        );

        expect(
          runtime.pendingCounterfactualDecision(),
        ).toBeNull();

        runtime.finishCatchUp();

        expect(
          runtime.snapshot()
            .mode,
        ).toBe(
          'LIVE',
        );
      },
    );


    test(
      'exposes canonical fixed 23 plus-minus 9 doctrine',
      () => {
        const runtime =
          controller();

        const doctrine =
          runtime.snapshot()
            .doctrine;

        expect(
          doctrine.centerNumber,
        ).toBe(
          23,
        );

        expect(
          doctrine.totalCoverage,
        ).toBe(
          19,
        );

        expect(
          doctrine.targetNumbers,
        ).toEqual(
          TARGET,
        );
      },
    );


    test(
      'OBSERVE creates no counterfactual hypothesis',
      () => {
        const runtime =
          controller({
            decisions: [
              observeDecision(),
            ],
          });

        runtime.confirmHistoryCurrent(
          's',
        );

        const result =
          runtime.ingestLiveSpin(
            17,
          );

        expect(
          result.decision.status,
        ).toBe(
          'OBSERVE',
        );

        expect(
          result.registeredCounterfactualDecision,
        ).toBeNull();

        expect(
          runtime.pendingCounterfactualDecision(),
        ).toBeNull();
      },
    );


    test(
      'PAPER_READY registers fixed target exclusively for next spin',
      () => {
        const runtime =
          controller({
            decisions: [
              paperReadyDecision(),
            ],
          });

        runtime.confirmHistoryCurrent(
          's',
        );

        const result =
          runtime.ingestLiveSpin(
            7,
          );

        expect(
          result.previousSettlement,
        ).toBeNull();

        expect(
          result.appliesFromNextSpin,
        ).toBe(
          true,
        );

        expect(
          result.registeredCounterfactualDecision,
        ).not.toBeNull();

        expect(
          result.registeredCounterfactualDecision
            .targetNumbers,
        ).toEqual(
          TARGET,
        );

        expect(
          runtime.counterfactualHistory(),
        ).toHaveLength(
          0,
        );
      },
    );


    test(
      'rejects invalid LIVE roulette spin',
      () => {
        const runtime =
          controller();

        runtime.confirmHistoryCurrent(
          's',
        );

        expect(
          () =>
            runtime.ingestLiveSpin(
              37,
            ),
        ).toThrow(
          'fusion_reduced_live_invalid_spin',
        );
      },
    );


    test(
      'controller remains manual-only',
      () => {
        const runtime =
          controller();

        const snapshot =
          runtime.snapshot();

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
          snapshot.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );

        expect(
          runtime.placeBet,
        ).toBeUndefined();

        expect(
          runtime.executeBet,
        ).toBeUndefined();

        expect(
          runtime.setBankroll,
        ).toBeUndefined();
      },
    );
  },
);
