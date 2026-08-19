const fs =
  require('node:fs');

const {
  TriplicacaoLiveTerminalController,
} = require(
  '../../../dist/application/runtime/TriplicacaoLiveTerminalController.js'
);


const TEST_FILE =
  'data/test/triplicacao-live-terminal-controller.json';


function analysis(
  pattern = 'TC',
  risk = 0.19,
) {
  return {
    baseAnalysis: {},
    metrics: [],

    selectedPatternKind:
      pattern,

    advancedEvidenceScore:
      83,

    advancedConfidenceScore:
      0.81,

    advancedRiskScore:
      risk,

    probabilityMode:
      'PAPER_ONLY',

    liveMoneyAuthorized:
      false,

    reasons: [],
    warnings: [],
    blockers: [],
  };
}


function fakeProbabilityEngine() {
  return {
    analyze() {
      return analysis();
    },
  };
}


function controller(
  overrides = {},
) {
  return new TriplicacaoLiveTerminalController(
    {
      sessionId:
        'paper-live-test',

      synchronizedHistory:
        [
          7,
          32,
          18,
          24,
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

      ...overrides,
    },

    fakeProbabilityEngine(),
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
  'TriplicacaoLiveTerminalController',
  () => {
    test(
      'starts waiting for post-Sync history confirmation',
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
          snapshot.synchronizedHistorySize,
        ).toBe(4);

        expect(
          snapshot.liveSpinCount,
        ).toBe(0);
      },
    );


    test(
      's opens LIVE boundary immediately',
      () => {
        const runtime =
          controller();

        runtime.confirmHistoryCurrent(
          's',
        );

        expect(
          runtime.snapshot().mode,
        ).toBe(
          'LIVE',
        );
      },
    );


    test(
      'n enters CATCH_UP',
      () => {
        const runtime =
          controller();

        runtime.confirmHistoryCurrent(
          'n',
        );

        expect(
          runtime.snapshot().mode,
        ).toBe(
          'CATCH_UP',
        );
      },
    );


    test(
      'catch-up spin updates history but never prospective signal count',
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
          32,
        );

        const snapshot =
          runtime.snapshot();

        expect(
          snapshot.catchUpSpinCount,
        ).toBe(2);

        expect(
          snapshot.totalHistorySize,
        ).toBe(6);

        expect(
          snapshot.runtime
            .totalRecordedSignals,
        ).toBe(0);

        expect(
          snapshot.runtime
            .currentBankroll,
        ).toBe(30);
      },
    );


    test(
      'finish catch-up establishes LIVE prospective boundary',
      () => {
        const runtime =
          controller();

        runtime.confirmHistoryCurrent(
          'n',
        );

        runtime.recordCatchUpSpin(
          17,
        );

        runtime.finishCatchUp();

        expect(
          runtime.snapshot().mode,
        ).toBe(
          'LIVE',
        );
      },
    );


    test(
      'LIVE spin is appended exactly once',
      () => {
        const runtime =
          controller();

        runtime.confirmHistoryCurrent(
          's',
        );

        const result =
          runtime.ingestLiveSpin(
            1,
          );

        expect(
          result.liveSpinIndex,
        ).toBe(1);

        expect(
          result.totalHistorySize,
        ).toBe(5);

        expect(
          runtime.historySnapshot(),
        ).toEqual([
          7,
          32,
          18,
          24,
          1,
        ]);
      },
    );


    test(
      'two LIVE spins may issue real prospective Triplicacao recommendation',
      () => {
        const runtime =
          controller();

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          1,
        );

        const second =
          runtime.ingestLiveSpin(
            3,
          );

        expect(
          second.runtime.event,
        ).toBe(
          'RECOMMENDATION_ISSUED',
        );

        expect(
          second.runtime
            .recommendation
            .targetColor,
        ).toBe(
          'RED',
        );

        expect(
          second.runtime
            .recommendation
            .suggestedStake,
        ).toBe(0.60);
      },
    );


    test(
      'operator s is only FOLLOWED audit declaration',
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

        const decision =
          runtime.recordOperatorDecision(
            's',
          );

        expect(
          decision.operatorDecision,
        ).toBe(
          'FOLLOWED',
        );

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


    test(
      'operator n preserves recommendation but declares IGNORED',
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

        const decision =
          runtime.recordOperatorDecision(
            'n',
          );

        expect(
          decision.operatorDecision,
        ).toBe(
          'IGNORED',
        );
      },
    );


    test(
      'ignored recommendation settlement does not touch bankroll',
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

        runtime.recordOperatorDecision(
          'n',
        );

        const result =
          runtime.ingestLiveSpin(
            5,
          );

        expect(
          result.runtime
            .settledSignal
            .result,
        ).toBe(
          'WIN',
        );

        expect(
          result.runtime
            .financialSettlement
            .financialSettlement,
        ).toBe(
          'NO_EXPOSURE',
        );

        expect(
          result.runtime
            .currentBankroll,
        ).toBe(30);
      },
    );


    test(
      'rejects LIVE spin before temporal boundary',
      () => {
        const runtime =
          controller();

        expect(
          () =>
            runtime.ingestLiveSpin(
              1,
            ),
        ).toThrow(
          'triplicacao_live_terminal_not_live',
        );
      },
    );


    test(
      'preserves permanent manual execution philosophy',
      () => {
        const runtime =
          controller();

        const snapshot =
          runtime.snapshot();

        expect(
          snapshot.recommendationOnly,
        ).toBe(true);

        expect(
          snapshot.humanExecutionRequired,
        ).toBe(true);

        expect(
          snapshot.automaticBetExecutionAllowed,
        ).toBe(false);
      },
    );
  },
);
