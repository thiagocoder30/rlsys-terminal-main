const {
  TriplicacaoLiveStatsDiagnostics,
} = require(
  '../../../dist/application/runtime/TriplicacaoLiveStatsDiagnostics.js'
);


function advancedAnalysis(
  overrides = {},
) {
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

    ...overrides,
  };
}


function formation(
  overrides = {},
) {
  return {
    stateBefore:
      'WAITING_FIRST',

    stateAfter:
      'WAITING_SECOND',

    spin:
      1,

    firstNumber:
      1,

    secondNumber:
      null,

    action:
      null,

    settlement:
      null,

    settledTargetColor:
      null,

    settledSpinColor:
      null,

    trioCompleted:
      false,

    trioDiscarded:
      false,

    reasons:
      [],

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


describe(
  'TriplicacaoLiveStatsDiagnostics',
  () => {
    const diagnostics =
      new TriplicacaoLiveStatsDiagnostics();


    test(
      'historical classification still uses canonical PatternEngine',
      () => {
        const report =
          diagnostics.analyze({
            history: [
              1,
              3,
              5,
            ],

            synchronizedHistorySize:
              3,

            catchUpSpinCount:
              0,

            liveSpinCount:
              0,

            events:
              [],
          });

        expect(
          report.synchronized.tc,
        ).toBe(
          1,
        );
      },
    );


    test(
      'completed prospective trio is classified canonically',
      () => {
        const event =
          diagnostics.event({
            liveSpinIndex:
              3,

            spin:
              5,

            sessionEvent:
              'NO_RECOMMENDATION',

            formationState:
              'WAITING_FIRST',

            formation:
              formation({
                stateBefore:
                  'WAITING_THIRD',

                stateAfter:
                  'WAITING_FIRST',

                spin:
                  5,

                firstNumber:
                  1,

                secondNumber:
                  3,

                trioCompleted:
                  true,
              }),

            recommendationIssued:
              false,

            analysis:
              advancedAnalysis(),
          });

        expect(
          event.trioNumbers,
        ).toEqual([
          1,
          3,
          5,
        ]);

        expect(
          event.actualPatternKind,
        ).toBe(
          'TC',
        );
      },
    );


    test(
      'LIVE stats use completed prospective trios rather than raw fixed grouping',
      () => {
        const first =
          diagnostics.event({
            liveSpinIndex:
              1,

            spin:
              0,

            sessionEvent:
              'TRIO_VOID',

            formationState:
              'WAITING_FIRST',

            formation:
              formation({
                spin:
                  0,

                firstNumber:
                  null,

                trioDiscarded:
                  true,
              }),

            recommendationIssued:
              false,

            analysis:
              advancedAnalysis(),
          });

        const completed =
          diagnostics.event({
            liveSpinIndex:
              4,

            spin:
              5,

            sessionEvent:
              'NO_RECOMMENDATION',

            formationState:
              'WAITING_FIRST',

            formation:
              formation({
                stateBefore:
                  'WAITING_THIRD',

                stateAfter:
                  'WAITING_FIRST',

                spin:
                  5,

                firstNumber:
                  1,

                secondNumber:
                  3,

                trioCompleted:
                  true,
              }),

            recommendationIssued:
              false,

            analysis:
              advancedAnalysis(),
          });

        /*
         * Raw LIVE sequence is:
         *
         * 0, 1, 3, 5
         *
         * Fixed groups-of-three would discard [0,1,3]
         * and lose the actual prospective [1,3,5].
         *
         * Diagnostics must follow prospective formation semantics.
         */
        const report =
          diagnostics.analyze({
            history: [
              0,
              1,
              3,
              5,
            ],

            synchronizedHistorySize:
              0,

            catchUpSpinCount:
              0,

            liveSpinCount:
              4,

            events: [
              first,
              completed,
            ],
          });

        expect(
          report.live.zeroDiscarded,
        ).toBe(
          1,
        );

        expect(
          report.live.total,
        ).toBe(
          1,
        );

        expect(
          report.live.tc,
        ).toBe(
          1,
        );
      },
    );


    test(
      'separates Sync catch-up and LIVE counters',
      () => {
        const report =
          diagnostics.analyze({
            history: [
              1,
              3,
              5,
              2,
              4,
              6,
              7,
            ],

            synchronizedHistorySize:
              3,

            catchUpSpinCount:
              3,

            liveSpinCount:
              1,

            events:
              [],
          });

        expect(
          report.synchronizedHistorySize,
        ).toBe(
          3,
        );

        expect(
          report.catchUpSpinCount,
        ).toBe(
          3,
        );

        expect(
          report.liveSpinCount,
        ).toBe(
          1,
        );

        expect(
          report.totalHistorySize,
        ).toBe(
          7,
        );
      },
    );


    test(
      'records advanced OBSERVE diagnostics',
      () => {
        const event =
          diagnostics.event({
            liveSpinIndex:
              2,

            spin:
              3,

            sessionEvent:
              'NO_RECOMMENDATION',

            formationState:
              'WAITING_THIRD',

            formation:
              formation({
                stateBefore:
                  'WAITING_SECOND',

                stateAfter:
                  'WAITING_THIRD',

                spin:
                  3,

                firstNumber:
                  1,

                secondNumber:
                  3,
              }),

            recommendationIssued:
              false,

            analysis:
              advancedAnalysis(),
          });

        expect(
          event.probabilityMode,
        ).toBe(
          'OBSERVE',
        );

        expect(
          event.baseDominantFrequencyScore,
        ).toBe(
          31,
        );

        expect(
          event.recommendationIssued,
        ).toBe(
          false,
        );
      },
    );


    test(
      'diagnostics remain recommendation-only',
      () => {
        const report =
          diagnostics.analyze({
            history:
              [],

            synchronizedHistorySize:
              0,

            catchUpSpinCount:
              0,

            liveSpinCount:
              0,

            events:
              [],
          });

        expect(
          report.recommendationOnly,
        ).toBe(
          true,
        );

        expect(
          report.humanExecutionRequired,
        ).toBe(
          true,
        );

        expect(
          report.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );
      },
    );
  },
);
