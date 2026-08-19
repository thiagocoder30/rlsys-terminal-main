const fs =
  require('node:fs');

const {
  TriplicacaoLiveTerminalController,
} = require(
  '../../../dist/application/runtime/TriplicacaoLiveTerminalController.js'
);


const TEST_FILE =
  'data/test/triplicacao-live-real-engine.json';


function history200() {
  /*
   * Deterministic valid roulette history.
   *
   * This is not intended to model a profitable roulette table.
   * It exists only to exercise the REAL analytical engine contract
   * through the live terminal boundary.
   */
  return Array.from(
    {
      length:
        200,
    },

    (
      _,
      index,
    ) =>
      index %
      37,
  );
}


function controller(
  overrides = {},
) {
  return new TriplicacaoLiveTerminalController({
    sessionId:
      'paper-real-engine-test',

    synchronizedHistory:
      history200(),

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

    ...overrides,
  });
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


afterAll(
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
  'TriplicacaoLiveTerminalController with real probability engine',
  () => {
    test(
      'constructs successfully with real TriplicacaoAdvancedProbabilityEngine',
      () => {
        const runtime =
          controller();

        expect(
          runtime.snapshot()
            .synchronizedHistorySize,
        ).toBe(200);

        expect(
          runtime.snapshot()
            .mode,
        ).toBe(
          'AWAITING_HISTORY_CONFIRMATION',
        );
      },
    );


    test(
      'real engine analyzes first prospective LIVE spin without contract error',
      () => {
        const runtime =
          controller();

        runtime.confirmHistoryCurrent(
          's',
        );

        const result =
          runtime.ingestLiveSpin(
            17,
          );

        expect(
          result.spin,
        ).toBe(17);

        expect(
          result.liveSpinIndex,
        ).toBe(1);

        expect(
          result.totalHistorySize,
        ).toBe(201);

        expect(
          result.analysis,
        ).toBeDefined();

        expect(
          result.runtime,
        ).toBeDefined();

        expect(
          runtime.historySnapshot()
            .length,
        ).toBe(201);
      },
    );


    test(
      'real engine processes consecutive LIVE spins incrementally',
      () => {
        const runtime =
          controller();

        runtime.confirmHistoryCurrent(
          's',
        );

        const spins =
          [
            17,
            8,
            32,
            11,
            21,
            4,
          ];

        let latest =
          null;

        for (
          const spin of
          spins
        ) {
          latest =
            runtime.ingestLiveSpin(
              spin,
            );
        }

        expect(
          latest.liveSpinIndex,
        ).toBe(6);

        expect(
          latest.totalHistorySize,
        ).toBe(206);

        expect(
          runtime.snapshot()
            .liveSpinCount,
        ).toBe(6);

        expect(
          runtime.historySnapshot()
            .length,
        ).toBe(206);
      },
    );


    test(
      'catch-up reaches real engine history but remains outside prospective evidence',
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
          8,
        );

        runtime.recordCatchUpSpin(
          32,
        );

        const beforeLive =
          runtime.snapshot();

        expect(
          beforeLive.mode,
        ).toBe(
          'CATCH_UP',
        );

        expect(
          beforeLive.totalHistorySize,
        ).toBe(203);

        expect(
          beforeLive.runtime
            .totalRecordedSignals,
        ).toBe(0);

        runtime.finishCatchUp();

        const result =
          runtime.ingestLiveSpin(
            11,
          );

        expect(
          result.liveSpinIndex,
        ).toBe(1);

        expect(
          result.totalHistorySize,
        ).toBe(204);

        expect(
          result.analysis,
        ).toBeDefined();
      },
    );


    test(
      'real engine never enables automatic execution capability',
      () => {
        const runtime =
          controller();

        runtime.confirmHistoryCurrent(
          's',
        );

        const result =
          runtime.ingestLiveSpin(
            17,
          );

        expect(
          result.recommendationOnly,
        ).toBe(true);

        expect(
          result.humanExecutionRequired,
        ).toBe(true);

        expect(
          result.automaticBetExecutionAllowed,
        ).toBe(false);

        expect(
          typeof runtime.execute,
        ).toBe(
          'undefined',
        );

        expect(
          typeof runtime.placeBet,
        ).toBe(
          'undefined',
        );
      },
    );
  },
);
