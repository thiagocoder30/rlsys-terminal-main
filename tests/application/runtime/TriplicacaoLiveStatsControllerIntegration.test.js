const fs =
  require('node:fs');

const {
  TriplicacaoLiveTerminalController,
} = require(
  '../../../dist/application/runtime/TriplicacaoLiveTerminalController.js'
);


const TEST_FILE =
  'data/test/triplicacao-live-stats-controller.json';


function observeAnalysis() {
  return {
    baseAnalysis: {
      dominantPatternKind:
        'TC',

      dominantFrequencyScore:
        31,

      confidenceScore:
        0.70,

      riskScore:
        0.30,

      operationalMode:
        'OBSERVE',
    },

    metrics:
      [],

    selectedPatternKind:
      'TC',

    advancedEvidenceScore:
      61,

    advancedConfidenceScore:
      0.70,

    advancedRiskScore:
      0.30,

    probabilityMode:
      'OBSERVE',

    liveMoneyAuthorized:
      false,

    reasons:
      [],

    warnings:
      [],

    blockers:
      [],
  };
}


function controller() {
  return new TriplicacaoLiveTerminalController(
    {
      sessionId:
        'stats-controller-integration',

      synchronizedHistory: [
        7,
        32,
        18,
      ],

      bankroll:
        30,

      riskMode:
        'moderate',

      minimumStake:
        0.10,

      martingaleEnabled:
        false,

      signalRepositoryPath:
        TEST_FILE,
    },

    {
      analyze() {
        return observeAnalysis();
      },
    },
  );
}


beforeEach(
  () => {
    fs.rmSync(
      TEST_FILE,
      {
        force:
          true,
      },
    );

    fs.rmSync(
      `${TEST_FILE}.tmp`,
      {
        force:
          true,
      },
    );
  },
);


describe(
  'TriplicacaoLiveTerminalController stats integration',
  () => {
    test(
      'stats are available before the first LIVE spin',
      () => {
        const runtime =
          controller();

        const stats =
          runtime.statsSnapshot();

        expect(
          stats.synchronizedHistorySize,
        ).toBe(
          3,
        );

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
      },
    );


    test(
      'records one diagnostic event for each accepted LIVE spin',
      () => {
        const runtime =
          controller();

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          1,
        );

        runtime.ingestLiveSpin(
          3,
        );

        runtime.ingestLiveSpin(
          5,
        );

        const stats =
          runtime.statsSnapshot();

        expect(
          stats.liveSpinCount,
        ).toBe(
          3,
        );

        expect(
          stats.latestEvents,
        ).toHaveLength(
          3,
        );

        expect(
          stats.liveCompletedTrios,
        ).toBe(
          1,
        );

        expect(
          stats.live.tc,
        ).toBe(
          1,
        );
      },
    );


    test(
      'catch-up changes context without creating LIVE diagnostics',
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
          27,
        );

        runtime.finishCatchUp();

        const stats =
          runtime.statsSnapshot();

        expect(
          stats.catchUpSpinCount,
        ).toBe(
          2,
        );

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
      },
    );


    test(
      'zero-invalidated fixed trio lifecycle remains observable',
      () => {
        const runtime =
          controller();

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          0,
        );

        runtime.ingestLiveSpin(
          17,
        );

        runtime.ingestLiveSpin(
          24,
        );

        runtime.ingestLiveSpin(
          1,
        );

        runtime.ingestLiveSpin(
          3,
        );

        runtime.ingestLiveSpin(
          5,
        );

        const stats =
          runtime.statsSnapshot();

        expect(
          stats.liveSpinCount,
        ).toBe(
          6,
        );

        expect(
          stats.liveDiscardedTrios,
        ).toBe(
          1,
        );

        expect(
          stats.liveCompletedTrios,
        ).toBe(
          1,
        );

        expect(
          stats.live.zeroDiscarded,
        ).toBe(
          1,
        );

        expect(
          stats.live.tc,
        ).toBe(
          1,
        );
      },
    );


    test(
      'stats remain strictly recommendation-only',
      () => {
        const stats =
          controller()
            .statsSnapshot();

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
          stats.humanExecutionRequired,
        ).toBe(
          true,
        );

        expect(
          stats.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );
      },
    );
  },
);
