const fs =
  require('node:fs');

const {
  TriplicacaoActionSemantics,
} = require(
  '../../../dist/application/runtime/TriplicacaoActionSemantics.js'
);

const {
  TriplicacaoProspectiveFormationCoordinator,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectiveFormationCoordinator.js'
);

const {
  TriplicacaoProspectiveRecorder,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectiveRecorder.js'
);

const {
  TriplicacaoProspectivePerformanceAnalyzer,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectivePerformanceAnalyzer.js'
);

const {
  TriplicacaoProspectiveSessionRuntime,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectiveSessionRuntime.js'
);

const {
  JsonTriplicacaoProspectiveSignalRepository,
} = require(
  '../../../dist/infrastructure/runtime/JsonTriplicacaoProspectiveSignalRepository.js'
);


const TEST_FILE =
  'data/test/triplicacao-prospective-session-runtime.json';


function analysis(
  pattern = 'TC',
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
      0.19,
    probabilityMode:
      'PAPER_ONLY',
    liveMoneyAuthorized:
      false,
    reasons: [],
    warnings: [],
    blockers: [],
  };
}


function clock() {
  let value =
    1000;

  return {
    now() {
      value +=
        1000;

      return value;
    },
  };
}


function idFactory() {
  let value =
    0;

  return {
    next({
      sessionId,
    }) {
      value +=
        1;

      return `signal-${sessionId}-${value}`;
    },
  };
}


function context() {
  const repository =
    new JsonTriplicacaoProspectiveSignalRepository(
      TEST_FILE,
    );

  const recorder =
    new TriplicacaoProspectiveRecorder(
      repository,
      clock(),
      idFactory(),
    );

  const formation =
    new TriplicacaoProspectiveFormationCoordinator(
      new TriplicacaoActionSemantics(),
    );

  const runtime =
    new TriplicacaoProspectiveSessionRuntime(
      'paper-test',
      formation,
      recorder,
      new TriplicacaoProspectivePerformanceAnalyzer(),
    );

  return {
    runtime,
    recorder,
  };
}


function ingest(
  runtime,
  spin,
  pattern = 'TC',
  stake = 0.60,
) {
  return runtime.ingest({
    sessionId:
      'paper-test',

    spin,

    analysis:
      analysis(pattern),

    suggestedStake:
      stake,
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
  'TriplicacaoProspectiveSessionRuntime',
  () => {
    test(
      'first spin creates no recommendation',
      () => {
        const ctx =
          context();

        const result =
          ingest(
            ctx.runtime,
            1,
          );

        expect(
          result.event,
        ).toBe(
          'FORMATION_STARTED',
        );

        expect(
          ctx.recorder.listSession(
            'paper-test',
          ),
        ).toHaveLength(0);
      },
    );


    test(
      'second actionable spin freezes suggested stake in recommendation',
      () => {
        const ctx =
          context();

        ingest(
          ctx.runtime,
          1,
        );

        const result =
          ingest(
            ctx.runtime,
            3,
            'TC',
            0.60,
          );

        expect(
          result.event,
        ).toBe(
          'RECOMMENDATION_ISSUED',
        );

        expect(
          result.recommendation.suggestedStake,
        ).toBe(0.60);

        expect(
          result.recommendation.operatorDecision,
        ).toBe(
          'UNDECIDED',
        );
      },
    );


    test(
      'operator may mark recommendation FOLLOWED',
      () => {
        const ctx =
          context();

        ingest(
          ctx.runtime,
          1,
        );

        ingest(
          ctx.runtime,
          3,
        );

        const decision =
          ctx.runtime.recordOperatorDecision({
            sessionId:
              'paper-test',

            decision:
              'FOLLOWED',
          });

        expect(
          decision.operatorDecision,
        ).toBe(
          'FOLLOWED',
        );

        expect(
          ctx.runtime.snapshot()
            .pendingOperatorDecision,
        ).toBe(
          'FOLLOWED',
        );
      },
    );


    test(
      'operator may mark recommendation IGNORED',
      () => {
        const ctx =
          context();

        ingest(
          ctx.runtime,
          1,
        );

        ingest(
          ctx.runtime,
          3,
        );

        const decision =
          ctx.runtime.recordOperatorDecision({
            sessionId:
              'paper-test',

            decision:
              'IGNORED',
          });

        expect(
          decision.operatorDecision,
        ).toBe(
          'IGNORED',
        );
      },
    );


    test(
      'cannot record operator decision without pending recommendation',
      () => {
        const ctx =
          context();

        expect(
          () =>
            ctx.runtime.recordOperatorDecision({
              sessionId:
                'paper-test',

              decision:
                'FOLLOWED',
            }),
        ).toThrow(
          'triplicacao_session_runtime_no_pending_recommendation',
        );
      },
    );


    test(
      'FOLLOWED recommendation settles statistically as WIN',
      () => {
        const ctx =
          context();

        ingest(
          ctx.runtime,
          1,
        );

        ingest(
          ctx.runtime,
          3,
        );

        ctx.runtime.recordOperatorDecision({
          sessionId:
            'paper-test',

          decision:
            'FOLLOWED',
        });

        const result =
          ingest(
            ctx.runtime,
            5,
          );

        expect(
          result.event,
        ).toBe(
          'RECOMMENDATION_SETTLED',
        );

        expect(
          result.settledSignal.result,
        ).toBe('WIN');

        expect(
          result.settledSignal.operatorDecision,
        ).toBe('FOLLOWED');

        expect(
          result.performance.operator.followedWins,
        ).toBe(1);
      },
    );


    test(
      'IGNORED recommendation still settles statistically as LOSS',
      () => {
        const ctx =
          context();

        ingest(
          ctx.runtime,
          1,
        );

        ingest(
          ctx.runtime,
          3,
        );

        ctx.runtime.recordOperatorDecision({
          sessionId:
            'paper-test',

          decision:
            'IGNORED',
        });

        const result =
          ingest(
            ctx.runtime,
            2,
          );

        expect(
          result.settledSignal.result,
        ).toBe('LOSS');

        expect(
          result.settledSignal.operatorDecision,
        ).toBe('IGNORED');

        expect(
          result.performance.losses,
        ).toBe(1);

        expect(
          result.performance.operator.followedLosses,
        ).toBe(0);
      },
    );


    test(
      'UNDECIDED recommendation may still be settled for engine validation',
      () => {
        const ctx =
          context();

        ingest(
          ctx.runtime,
          1,
        );

        ingest(
          ctx.runtime,
          3,
        );

        const result =
          ingest(
            ctx.runtime,
            5,
          );

        expect(
          result.settledSignal.result,
        ).toBe('WIN');

        expect(
          result.settledSignal.operatorDecision,
        ).toBe(
          'UNDECIDED',
        );

        expect(
          result.performance.wins,
        ).toBe(1);
      },
    );


    test(
      'zero third spin creates VOID without false win or loss',
      () => {
        const ctx =
          context();

        ingest(
          ctx.runtime,
          1,
        );

        ingest(
          ctx.runtime,
          3,
        );

        ctx.runtime.recordOperatorDecision({
          sessionId:
            'paper-test',

          decision:
            'FOLLOWED',
        });

        const result =
          ingest(
            ctx.runtime,
            0,
          );

        expect(
          result.event,
        ).toBe(
          'TRIO_VOID',
        );

        expect(
          result.settledSignal.result,
        ).toBe('VOID');

        expect(
          result.performance.voids,
        ).toBe(1);
      },
    );


    test(
      'NO_ACTION never creates recommendation',
      () => {
        const ctx =
          context();

        ingest(
          ctx.runtime,
          1,
        );

        const second =
          ingest(
            ctx.runtime,
            2,
            'TC',
          );

        expect(
          second.event,
        ).toBe(
          'NO_RECOMMENDATION',
        );

        expect(
          ctx.recorder.listSession(
            'paper-test',
          ),
        ).toHaveLength(0);
      },
    );


    test(
      'performance separates engine quality from operator-followed quality',
      () => {
        const ctx =
          context();

        /*
         * Signal 1 followed and won.
         */
        ingest(
          ctx.runtime,
          1,
        );

        ingest(
          ctx.runtime,
          3,
        );

        ctx.runtime.recordOperatorDecision({
          sessionId:
            'paper-test',

          decision:
            'FOLLOWED',
        });

        ingest(
          ctx.runtime,
          5,
        );

        /*
         * Signal 2 ignored and lost.
         */
        ingest(
          ctx.runtime,
          7,
        );

        ingest(
          ctx.runtime,
          9,
        );

        ctx.runtime.recordOperatorDecision({
          sessionId:
            'paper-test',

          decision:
            'IGNORED',
        });

        const result =
          ingest(
            ctx.runtime,
            2,
          );

        expect(
          result.performance.hitRate,
        ).toBe(0.5);

        expect(
          result.performance.operator.followedHitRate,
        ).toBe(1);

        expect(
          result.performance.operator.followedSignals,
        ).toBe(1);

        expect(
          result.performance.operator.ignoredSignals,
        ).toBe(1);
      },
    );


    test(
      'permanent RL.Sys philosophy remains recommendation-only',
      () => {
        const ctx =
          context();

        const result =
          ingest(
            ctx.runtime,
            1,
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

        const snapshot =
          ctx.runtime.snapshot();

        expect(
          snapshot.recommendationOnly,
        ).toBe(true);

        expect(
          snapshot.humanExecutionRequired,
        ).toBe(true);

        expect(
          snapshot.automaticBetExecutionAllowed,
        ).toBe(false);

        expect(
          typeof ctx.runtime.execute,
        ).toBe('undefined');

        expect(
          typeof ctx.runtime.placeBet,
        ).toBe('undefined');
      },
    );
  },
);
