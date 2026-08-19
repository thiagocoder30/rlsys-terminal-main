const {
  TriplicacaoCounterfactualSettlementEngine,
} = require(
  '../../../dist/application/runtime/TriplicacaoCounterfactualSettlementEngine.js'
);


function event(
  overrides = {},
) {
  return {
    liveSpinIndex:
      1,

    spin:
      1,

    sessionEvent:
      'FORMATION_STARTED',

    formationState:
      'WAITING_SECOND',

    firstNumber:
      1,

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
      0.40,

    advancedRiskScore:
      0.50,

    baseOperationalMode:
      'OBSERVE',

    baseDominantPattern:
      'TC',

    baseDominantFrequencyScore:
      35,

    baseConfidenceScore:
      0.40,

    baseRiskScore:
      0.55,

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


function decision(
  overrides = {},
) {
  return event({
    liveSpinIndex:
      2,

    spin:
      3,

    sessionEvent:
      'NO_RECOMMENDATION',

    formationState:
      'WAITING_THIRD',

    firstNumber:
      1,

    secondNumber:
      3,

    trioCompleted:
      false,

    trioDiscarded:
      false,

    actionStatus:
      'NO_ACTION',

    selectedPatternKind:
      'TC',

    /*
     * Strong enough for all counterfactual joint scenarios except
     * OFFICIAL, while remaining below official requirements.
     */
    baseDominantFrequencyScore:
      40,

    baseConfidenceScore:
      0.50,

    baseRiskScore:
      0.50,

    advancedEvidenceScore:
      50,

    advancedConfidenceScore:
      0.50,

    advancedRiskScore:
      0.45,

    ...overrides,
  });
}


function third(
  overrides = {},
) {
  return event({
    liveSpinIndex:
      3,

    spin:
      5,

    sessionEvent:
      'NO_RECOMMENDATION',

    formationState:
      'WAITING_FIRST',

    firstNumber:
      1,

    secondNumber:
      3,

    trioCompleted:
      true,

    trioDiscarded:
      false,

    trioNumbers: [
      1,
      3,
      5,
    ],

    actualPatternKind:
      'TC',

    actionStatus:
      'NO_ACTION',

    selectedPatternKind:
      'TC',

    ...overrides,
  });
}


function scenario(
  report,
  id,
) {
  const found =
    report.scenarios.find(
      (item) =>
        item.policyId ===
        id,
    );

  if (
    found ===
    undefined
  ) {
    throw new Error(
      `scenario_not_found:${id}`,
    );
  }

  return found;
}


describe(
  'TriplicacaoCounterfactualSettlementEngine',
  () => {
    const engine =
      new TriplicacaoCounterfactualSettlementEngine();


    test(
      'settles WIN using the immediately following LIVE third spin',
      () => {
        const report =
          engine.analyze({
            events: [
              event(),
              decision(),
              third(),
            ],
          });

        const balanced =
          scenario(
            report,
            'P50_BALANCED',
          );

        expect(
          balanced.eligibleEvents,
        ).toBe(
          1,
        );

        expect(
          balanced.actionableEvents,
        ).toBe(
          1,
        );

        expect(
          balanced.wins,
        ).toBe(
          1,
        );

        expect(
          balanced.losses,
        ).toBe(
          0,
        );

        expect(
          balanced.records[0]
            .decisionLiveIndex,
        ).toBe(
          2,
        );

        expect(
          balanced.records[0]
            .settlementLiveIndex,
        ).toBe(
          3,
        );

        expect(
          balanced.records[0]
            .targetColor,
        ).toBe(
          'RED',
        );

        expect(
          balanced.records[0]
            .result,
        ).toBe(
          'WIN',
        );
      },
    );


    test(
      'settles LOSS when completed pattern differs from prospective hypothesis',
      () => {
        const report =
          engine.analyze({
            events: [
              event(),
              decision(),
              third({
                spin:
                  2,

                trioNumbers: [
                  1,
                  3,
                  2,
                ],

                actualPatternKind:
                  'NTC',
              }),
            ],
          });

        const balanced =
          scenario(
            report,
            'P50_BALANCED',
          );

        expect(
          balanced.wins,
        ).toBe(
          0,
        );

        expect(
          balanced.losses,
        ).toBe(
          1,
        );

        expect(
          balanced.hitRate,
        ).toBe(
          0,
        );
      },
    );


    test(
      'settles third-position zero as VOID',
      () => {
        const report =
          engine.analyze({
            events: [
              event(),
              decision(),
              third({
                spin:
                  0,

                trioCompleted:
                  false,

                trioDiscarded:
                  true,

                trioNumbers:
                  null,

                actualPatternKind:
                  null,

                sessionEvent:
                  'TRIO_VOID',
              }),
            ],
          });

        const balanced =
          scenario(
            report,
            'P50_BALANCED',
          );

        expect(
          balanced.voids,
        ).toBe(
          1,
        );

        expect(
          balanced.decisiveEvents,
        ).toBe(
          0,
        );

        expect(
          balanced.hitRate,
        ).toBeNull();

        expect(
          balanced.records[0]
            .result,
        ).toBe(
          'VOID',
        );
      },
    );


    test(
      'eligible event may still be NOT_ACTIONABLE when opening is incompatible',
      () => {
        const report =
          engine.analyze({
            events: [
              event({
                spin:
                  1,
              }),

              decision({
                spin:
                  2,

                firstNumber:
                  1,

                secondNumber:
                  2,

                selectedPatternKind:
                  'TC',
              }),

              third({
                firstNumber:
                  1,

                secondNumber:
                  2,

                spin:
                  3,

                trioNumbers: [
                  1,
                  2,
                  3,
                ],

                actualPatternKind:
                  'TA',
              }),
            ],
          });

        const balanced =
          scenario(
            report,
            'P50_BALANCED',
          );

        expect(
          balanced.eligibleEvents,
        ).toBe(
          1,
        );

        expect(
          balanced.actionableEvents,
        ).toBe(
          0,
        );

        expect(
          balanced.notActionableEvents,
        ).toBe(
          1,
        );

        expect(
          balanced.settledEvents,
        ).toBe(
          0,
        );

        expect(
          balanced.records[0]
            .result,
        ).toBe(
          'NOT_ACTIONABLE',
        );
      },
    );


    test(
      'last eligible decision remains PENDING until third LIVE spin exists',
      () => {
        const report =
          engine.analyze({
            events: [
              event(),
              decision(),
            ],
          });

        const balanced =
          scenario(
            report,
            'P50_BALANCED',
          );

        expect(
          balanced.pendingEvents,
        ).toBe(
          1,
        );

        expect(
          balanced.settledEvents,
        ).toBe(
          0,
        );

        expect(
          balanced.records[0]
            .settlementLiveIndex,
        ).toBeNull();

        expect(
          balanced.records[0]
            .result,
        ).toBe(
          'PENDING',
        );
      },
    );


    test(
      'third spin is never used to decide eligibility',
      () => {
        const weakDecision =
          decision({
            baseDominantFrequencyScore:
              1,

            baseConfidenceScore:
              0.01,

            baseRiskScore:
              0.99,

            advancedEvidenceScore:
              1,

            advancedConfidenceScore:
              0.01,

            advancedRiskScore:
              0.99,
          });

        const impossiblyStrongThird =
          third({
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
          });

        const report =
          engine.analyze({
            events: [
              event(),
              weakDecision,
              impossiblyStrongThird,
            ],
          });

        const permissive =
          scenario(
            report,
            'P25_PERMISSIVE',
          );

        expect(
          permissive.eligibleEvents,
        ).toBe(
          0,
        );
      },
    );


    test(
      'settlement live index is exactly decision live index plus one',
      () => {
        const report =
          engine.analyze({
            events: [
              event(),
              decision(),
              third(),
            ],
          });

        const record =
          scenario(
            report,
            'P50_BALANCED',
          ).records[0];

        expect(
          record.settlementLiveIndex,
        ).toBe(
          record.decisionLiveIndex +
          1,
        );
      },
    );


    test(
      'official scenario remains governed by official thresholds',
      () => {
        const report =
          engine.analyze({
            events: [
              event(),
              decision(),
              third(),
            ],
          });

        const official =
          scenario(
            report,
            'OFFICIAL',
          );

        expect(
          official.eligibleEvents,
        ).toBe(
          0,
        );

        expect(
          official.settledEvents,
        ).toBe(
          0,
        );
      },
    );


    test(
      'calculates hit rate and maximum loss streak',
      () => {
        const events = [
          event({
            liveSpinIndex:
              1,

            spin:
              1,
          }),

          decision({
            liveSpinIndex:
              2,

            firstNumber:
              1,

            secondNumber:
              3,
          }),

          third({
            liveSpinIndex:
              3,

            firstNumber:
              1,

            secondNumber:
              3,

            spin:
              2,

            trioNumbers: [
              1,
              3,
              2,
            ],

            actualPatternKind:
              'NTC',
          }),

          event({
            liveSpinIndex:
              4,

            spin:
              5,

            firstNumber:
              5,

            formationState:
              'WAITING_SECOND',
          }),

          decision({
            liveSpinIndex:
              5,

            spin:
              7,

            firstNumber:
              5,

            secondNumber:
              7,
          }),

          third({
            liveSpinIndex:
              6,

            spin:
              4,

            firstNumber:
              5,

            secondNumber:
              7,

            trioNumbers: [
              5,
              7,
              4,
            ],

            actualPatternKind:
              'NTC',
          }),

          event({
            liveSpinIndex:
              7,

            spin:
              9,

            firstNumber:
              9,

            formationState:
              'WAITING_SECOND',
          }),

          decision({
            liveSpinIndex:
              8,

            spin:
              21,

            firstNumber:
              9,

            secondNumber:
              21,
          }),

          third({
            liveSpinIndex:
              9,

            spin:
              23,

            firstNumber:
              9,

            secondNumber:
              21,

            trioNumbers: [
              9,
              21,
              23,
            ],

            actualPatternKind:
              'TC',
          }),
        ];

        const report =
          engine.analyze({
            events,
          });

        const balanced =
          scenario(
            report,
            'P50_BALANCED',
          );

        expect(
          balanced.wins,
        ).toBe(
          1,
        );

        expect(
          balanced.losses,
        ).toBe(
          2,
        );

        expect(
          balanced.decisiveEvents,
        ).toBe(
          3,
        );

        expect(
          balanced.hitRate,
        ).toBeCloseTo(
          1 / 3,
          4,
        );

        expect(
          balanced.maxLossStreak,
        ).toBe(
          2,
        );
      },
    );


    test(
      'rejects duplicate LIVE indices',
      () => {
        expect(
          () =>
            engine.analyze({
              events: [
                event({
                  liveSpinIndex:
                    1,
                }),

                event({
                  liveSpinIndex:
                    1,
                }),
              ],
            }),
        ).toThrow(
          'triplicacao_counterfactual_settlement_duplicate_live_index',
        );
      },
    );


    test(
      'preserves read-only safety invariants',
      () => {
        const report =
          engine.analyze({
            events:
              [],
          });

        expect(
          report.officialPolicyPreserved,
        ).toBe(
          true,
        );

        expect(
          report.counterfactualOnly,
        ).toBe(
          true,
        );

        expect(
          report.recommendationOnly,
        ).toBe(
          true,
        );

        expect(
          report.bankrollMutationAllowed,
        ).toBe(
          false,
        );

        expect(
          report.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );

        expect(
          engine.placeBet,
        ).toBeUndefined();

        expect(
          engine.executeBet,
        ).toBeUndefined();

        expect(
          engine.settleBankroll,
        ).toBeUndefined();
      },
    );
  },
);
