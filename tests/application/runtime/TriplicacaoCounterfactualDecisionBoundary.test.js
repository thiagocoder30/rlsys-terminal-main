const {
  isTriplicacaoCounterfactualDecisionPoint,
  triplicacaoCounterfactualDecisionEvents,
} = require(
  '../../../dist/application/runtime/TriplicacaoCounterfactualDecisionPoint.js'
);

const {
  TriplicacaoCounterfactualCalibrationMatrix,
} = require(
  '../../../dist/application/runtime/TriplicacaoCounterfactualCalibrationMatrix.js'
);

const {
  TriplicacaoJointCounterfactualCalibrationMatrix,
} = require(
  '../../../dist/application/runtime/TriplicacaoJointCounterfactualCalibrationMatrix.js'
);


function event(
  overrides = {},
) {
  return {
    liveSpinIndex:
      1,

    spin:
      11,

    sessionEvent:
      'NO_RECOMMENDATION',

    formationState:
      'WAITING_SECOND',

    firstNumber:
      11,

    secondNumber:
      null,

    trioCompleted:
      false,

    trioDiscarded:
      false,

    trioNumbers:
      null,

    actualPatternKind:
      null,

    actionStatus:
      null,

    selectedPatternKind:
      'TC',

    probabilityMode:
      'OBSERVE',

    advancedEvidenceScore:
      40,

    advancedConfidenceScore:
      0.35,

    advancedRiskScore:
      0.55,

    baseOperationalMode:
      'OBSERVE',

    baseDominantPattern:
      'TC',

    baseDominantFrequencyScore:
      30,

    baseConfidenceScore:
      0.32,

    baseRiskScore:
      0.61,

    gateSummary: {
      total:
        8,

      passed:
        1,

      failed:
        7,

      allPassed:
        false,

      evaluations:
        [],
    },

    rationale:
      null,

    reasons:
      [],

    warnings:
      [],

    blockers:
      [],

    recommendationIssued:
      false,

    ...overrides,
  };
}


describe(
  'Triplicacao counterfactual decision boundary',
  () => {
    test(
      'first spin is not a prospective decision point',
      () => {
        expect(
          isTriplicacaoCounterfactualDecisionPoint(
            event({
              formationState:
                'WAITING_SECOND',

              firstNumber:
                11,

              secondNumber:
                null,
            }),
          ),
        ).toBe(
          false,
        );
      },
    );


    test(
      'second spin is the canonical prospective decision point',
      () => {
        expect(
          isTriplicacaoCounterfactualDecisionPoint(
            event({
              liveSpinIndex:
                2,

              formationState:
                'WAITING_THIRD',

              firstNumber:
                11,

              secondNumber:
                20,

              actionStatus:
                'NO_ACTION',
            }),
          ),
        ).toBe(
          true,
        );
      },
    );


    test(
      'third spin is never reused for candidate generation',
      () => {
        expect(
          isTriplicacaoCounterfactualDecisionPoint(
            event({
              liveSpinIndex:
                3,

              formationState:
                'WAITING_FIRST',

              firstNumber:
                11,

              secondNumber:
                20,

              trioCompleted:
                true,

              trioNumbers: [
                11,
                20,
                25,
              ],

              actualPatternKind:
                'NTC',

              actionStatus:
                'NO_ACTION',
            }),
          ),
        ).toBe(
          false,
        );
      },
    );


    test(
      'zero-discarded formation is never a candidate',
      () => {
        expect(
          isTriplicacaoCounterfactualDecisionPoint(
            event({
              formationState:
                'WAITING_THIRD',

              firstNumber:
                11,

              secondNumber:
                0,

              trioDiscarded:
                true,

              actionStatus:
                'ZERO_BLOCKED',
            }),
          ),
        ).toBe(
          false,
        );
      },
    );


    test(
      'canonical population contains one decision event per completed normal trio',
      () => {
        const events = [
          event({
            liveSpinIndex:
              1,
          }),

          event({
            liveSpinIndex:
              2,

            spin:
              20,

            formationState:
              'WAITING_THIRD',

            firstNumber:
              11,

            secondNumber:
              20,

            actionStatus:
              'NO_ACTION',
          }),

          event({
            liveSpinIndex:
              3,

            spin:
              25,

            formationState:
              'WAITING_FIRST',

            firstNumber:
              11,

            secondNumber:
              20,

            trioCompleted:
              true,

            trioNumbers: [
              11,
              20,
              25,
            ],

            actualPatternKind:
              'NTC',

            actionStatus:
              'NO_ACTION',
          }),
        ];

        const decisionEvents =
          triplicacaoCounterfactualDecisionEvents(
            events,
          );

        expect(
          decisionEvents,
        ).toHaveLength(
          1,
        );

        expect(
          decisionEvents[0]
            .liveSpinIndex,
        ).toBe(
          2,
        );
      },
    );


    test(
      'isolated matrix cannot use third-spin information',
      () => {
        const events = [
          event({
            liveSpinIndex:
              1,
          }),

          event({
            liveSpinIndex:
              2,

            formationState:
              'WAITING_THIRD',

            firstNumber:
              11,

            secondNumber:
              20,

            actionStatus:
              'NO_ACTION',
          }),

          event({
            liveSpinIndex:
              3,

            formationState:
              'WAITING_FIRST',

            firstNumber:
              11,

            secondNumber:
              20,

            trioCompleted:
              true,

            trioNumbers: [
              11,
              20,
              25,
            ],

            actualPatternKind:
              'NTC',

            actionStatus:
              'NO_ACTION',

            baseDominantFrequencyScore:
              100,

            baseConfidenceScore:
              1,

            baseRiskScore:
              0,

            advancedEvidenceScore:
              100,

            advancedConfidenceScore:
              1,

            advancedRiskScore:
              0,
          }),
        ];

        const report =
          new TriplicacaoCounterfactualCalibrationMatrix()
            .analyze({
              events,
            });

        expect(
          report.decisionApplicableEvents,
        ).toBe(
          1,
        );
      },
    );


    test(
      'joint matrix uses the same prospective boundary',
      () => {
        const events = [
          event({
            liveSpinIndex:
              1,
          }),

          event({
            liveSpinIndex:
              2,

            formationState:
              'WAITING_THIRD',

            firstNumber:
              11,

            secondNumber:
              20,

            actionStatus:
              'NO_ACTION',
          }),

          event({
            liveSpinIndex:
              3,

            formationState:
              'WAITING_FIRST',

            firstNumber:
              11,

            secondNumber:
              20,

            trioCompleted:
              true,

            actualPatternKind:
              'TC',

            actionStatus:
              'NO_ACTION',
          }),
        ];

        const report =
          new TriplicacaoJointCounterfactualCalibrationMatrix()
            .analyze({
              events,
            });

        expect(
          report.decisionApplicableEvents,
        ).toBe(
          1,
        );
      },
    );


    test(
      'decision boundary adds no execution authority',
      () => {
        expect(
          triplicacaoCounterfactualDecisionEvents.placeBet,
        ).toBeUndefined();

        expect(
          triplicacaoCounterfactualDecisionEvents.executeBet,
        ).toBeUndefined();
      },
    );
  },
);
