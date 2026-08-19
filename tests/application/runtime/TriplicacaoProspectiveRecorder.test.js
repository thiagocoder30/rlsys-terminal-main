const fs =
  require('node:fs');

const {
  TriplicacaoProspectiveRecorder,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectiveRecorder.js'
);

const {
  JsonTriplicacaoProspectiveSignalRepository,
} = require(
  '../../../dist/infrastructure/runtime/JsonTriplicacaoProspectiveSignalRepository.js'
);


const TEST_FILE =
  'data/test/triplicacao-prospective-recorder.json';


function action(
  overrides = {},
) {
  return {
    status:
      'ACTION',

    selectedPatternKind:
      'TC',

    firstNumber:
      1,

    secondNumber:
      3,

    firstColor:
      'RED',

    secondColor:
      'RED',

    openingRelation:
      'SAME',

    targetColor:
      'RED',

    confidenceScore:
      0.81,

    riskScore:
      0.19,

    evidenceScore:
      83,

    rationale:
      'TC prospective action.',

    reasons: [
      'TEST_ACTION',
    ],

    warnings: [
      'PAPER_ONLY',
    ],

    blockers: [],

    paperOnly:
      true,

    liveMoneyAuthorization:
      false,

    automaticBetExecutionAllowed:
      false,

    operatorDecisionRequired:
      true,

    ...overrides,
  };
}


function formation(
  settlement,
  spin,
  color,
) {
  return {
    stateBefore:
      'WAITING_THIRD',

    stateAfter:
      'WAITING_FIRST',

    spin,

    firstNumber:
      1,

    secondNumber:
      3,

    action:
      action(),

    settlement,

    settledTargetColor:
      'RED',

    settledSpinColor:
      color,

    trioCompleted:
      settlement !==
      'VOID',

    trioDiscarded:
      settlement ===
      'VOID',

    reasons: [],

    paperOnly:
      true,

    liveMoneyAuthorization:
      false,

    automaticBetExecutionAllowed:
      false,

    operatorDecisionRequired:
      true,
  };
}


function clock(
  values,
) {
  let index =
    0;

  return {
    now() {
      const value =
        values[index];

      index +=
        1;

      return value;
    },
  };
}


function idFactory() {
  let sequence =
    0;

  return {
    next({
      sessionId,
    }) {
      sequence +=
        1;

      return `signal-${sessionId}-${sequence}`;
    },
  };
}


function repository() {
  return new JsonTriplicacaoProspectiveSignalRepository(
    TEST_FILE,
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
  'TriplicacaoProspectiveRecorder',
  () => {
    test(
      'persists stake and UNDECIDED decision before third spin',
      () => {
        const recorder =
          new TriplicacaoProspectiveRecorder(
            repository(),
            clock([
              1000,
            ]),
            idFactory(),
          );

        const result =
          recorder.recordAction({
            sessionId:
              'paper-1',

            action:
              action(),

            suggestedStake:
              0.60,
          });

        expect(
          result.status,
        ).toBe('PENDING');

        expect(
          result.suggestedStake,
        ).toBe(0.60);

        expect(
          result.operatorDecision,
        ).toBe('UNDECIDED');

        expect(
          result.operatorDecisionAtEpochMs,
        ).toBeNull();

        expect(
          result.thirdNumber,
        ).toBeNull();
      },
    );


    test(
      'records FOLLOWED operator decision without executing anything',
      () => {
        const recorder =
          new TriplicacaoProspectiveRecorder(
            repository(),
            clock([
              1000,
              1500,
            ]),
            idFactory(),
          );

        const signal =
          recorder.recordAction({
            sessionId:
              'paper-1',

            action:
              action(),

            suggestedStake:
              0.60,
          });

        const updated =
          recorder.recordOperatorDecision({
            signalId:
              signal.signalId,

            decision:
              'FOLLOWED',
          });

        expect(
          updated.operatorDecision,
        ).toBe('FOLLOWED');

        expect(
          updated.operatorDecisionAtEpochMs,
        ).toBe(1500);

        expect(
          updated.status,
        ).toBe('PENDING');

        expect(
          updated.result,
        ).toBeNull();
      },
    );


    test(
      'records IGNORED operator decision',
      () => {
        const recorder =
          new TriplicacaoProspectiveRecorder(
            repository(),
            clock([
              1000,
              1500,
            ]),
            idFactory(),
          );

        const signal =
          recorder.recordAction({
            sessionId:
              'paper-1',

            action:
              action(),

            suggestedStake:
              0.60,
          });

        const updated =
          recorder.recordOperatorDecision({
            signalId:
              signal.signalId,

            decision:
              'IGNORED',
          });

        expect(
          updated.operatorDecision,
        ).toBe('IGNORED');
      },
    );


    test(
      'settles ignored recommendation statistically as LOSS',
      () => {
        const recorder =
          new TriplicacaoProspectiveRecorder(
            repository(),
            clock([
              1000,
              1500,
              2000,
            ]),
            idFactory(),
          );

        const signal =
          recorder.recordAction({
            sessionId:
              'paper-1',

            action:
              action(),

            suggestedStake:
              0.60,
          });

        recorder.recordOperatorDecision({
          signalId:
            signal.signalId,

          decision:
            'IGNORED',
        });

        const settled =
          recorder.settle({
            signalId:
              signal.signalId,

            formation:
              formation(
                'LOSS',
                2,
                'BLACK',
              ),
          });

        expect(
          settled.operatorDecision,
        ).toBe('IGNORED');

        expect(
          settled.result,
        ).toBe('LOSS');
      },
    );


    test(
      'rejects zero or negative suggested stake',
      () => {
        const recorder =
          new TriplicacaoProspectiveRecorder(
            repository(),
            clock([
              1000,
            ]),
            idFactory(),
          );

        expect(
          () =>
            recorder.recordAction({
              sessionId:
                'paper-1',

              action:
                action(),

              suggestedStake:
                0,
            }),
        ).toThrow(
          'triplicacao_recorder_invalid_suggested_stake',
        );
      },
    );


    test(
      'rejects duplicate operator decision',
      () => {
        const recorder =
          new TriplicacaoProspectiveRecorder(
            repository(),
            clock([
              1000,
              1500,
              1700,
            ]),
            idFactory(),
          );

        const signal =
          recorder.recordAction({
            sessionId:
              'paper-1',

            action:
              action(),

            suggestedStake:
              0.60,
          });

        recorder.recordOperatorDecision({
          signalId:
            signal.signalId,

          decision:
            'FOLLOWED',
        });

        expect(
          () =>
            recorder.recordOperatorDecision({
              signalId:
                signal.signalId,

              decision:
                'IGNORED',
            }),
        ).toThrow(
          'triplicacao_recorder_operator_decision_already_recorded',
        );
      },
    );


    test(
      'rejects operator decision after settlement',
      () => {
        const recorder =
          new TriplicacaoProspectiveRecorder(
            repository(),
            clock([
              1000,
              2000,
              3000,
            ]),
            idFactory(),
          );

        const signal =
          recorder.recordAction({
            sessionId:
              'paper-1',

            action:
              action(),

            suggestedStake:
              0.60,
          });

        recorder.settle({
          signalId:
            signal.signalId,

          formation:
            formation(
              'WIN',
              5,
              'RED',
            ),
        });

        expect(
          () =>
            recorder.recordOperatorDecision({
              signalId:
                signal.signalId,

              decision:
                'FOLLOWED',
            }),
        ).toThrow(
          'triplicacao_recorder_operator_decision_after_settlement',
        );
      },
    );


    test(
      'settles FOLLOWED signal as WIN',
      () => {
        const recorder =
          new TriplicacaoProspectiveRecorder(
            repository(),
            clock([
              1000,
              1500,
              2000,
            ]),
            idFactory(),
          );

        const pending =
          recorder.recordAction({
            sessionId:
              'paper-1',

            action:
              action(),

            suggestedStake:
              0.60,
          });

        recorder.recordOperatorDecision({
          signalId:
            pending.signalId,

          decision:
            'FOLLOWED',
        });

        const settled =
          recorder.settle({
            signalId:
              pending.signalId,

            formation:
              formation(
                'WIN',
                5,
                'RED',
              ),
          });

        expect(
          settled.result,
        ).toBe('WIN');

        expect(
          settled.operatorDecision,
        ).toBe('FOLLOWED');

        expect(
          settled.suggestedStake,
        ).toBe(0.60);
      },
    );


    test(
      'settles zero as VOID',
      () => {
        const recorder =
          new TriplicacaoProspectiveRecorder(
            repository(),
            clock([
              1000,
              2000,
            ]),
            idFactory(),
          );

        const pending =
          recorder.recordAction({
            sessionId:
              'paper-1',

            action:
              action(),

            suggestedStake:
              0.60,
          });

        const settled =
          recorder.settle({
            signalId:
              pending.signalId,

            formation:
              formation(
                'VOID',
                0,
                'ZERO',
              ),
          });

        expect(
          settled.result,
        ).toBe('VOID');
      },
    );


    test(
      'rejects inconsistent settlement',
      () => {
        const recorder =
          new TriplicacaoProspectiveRecorder(
            repository(),
            clock([
              1000,
              2000,
            ]),
            idFactory(),
          );

        const pending =
          recorder.recordAction({
            sessionId:
              'paper-1',

            action:
              action(),

            suggestedStake:
              0.60,
          });

        expect(
          () =>
            recorder.settle({
              signalId:
                pending.signalId,

              formation:
                formation(
                  'WIN',
                  2,
                  'BLACK',
                ),
            }),
        ).toThrow(
          'triplicacao_recorder_inconsistent_settlement',
        );
      },
    );


    test(
      'lists signals independently by session',
      () => {
        const recorder =
          new TriplicacaoProspectiveRecorder(
            repository(),
            clock([
              1000,
              2000,
            ]),
            idFactory(),
          );

        recorder.recordAction({
          sessionId:
            'paper-a',

          action:
            action(),

          suggestedStake:
            0.50,
        });

        recorder.recordAction({
          sessionId:
            'paper-b',

          action:
            action(),

          suggestedStake:
            0.70,
        });

        expect(
          recorder.listSession(
            'paper-a',
          ),
        ).toHaveLength(1);

        expect(
          recorder.listSession(
            'paper-b',
          ),
        ).toHaveLength(1);
      },
    );


    test(
      'preserves permanent human-supervision invariants',
      () => {
        const recorder =
          new TriplicacaoProspectiveRecorder(
            repository(),
            clock([
              1000,
            ]),
            idFactory(),
          );

        const result =
          recorder.recordAction({
            sessionId:
              'paper-1',

            action:
              action(),

            suggestedStake:
              0.60,
          });

        expect(
          result.recommendationOnly,
        ).toBe(true);

        expect(
          result.humanExecutionRequired,
        ).toBe(true);

        expect(
          result.liveMoneyAuthorization,
        ).toBe(false);

        expect(
          result.automaticBetExecutionAllowed,
        ).toBe(false);
      },
    );
  },
);
