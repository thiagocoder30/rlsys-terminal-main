const {
  TriplicacaoJointCounterfactualCalibrationMatrix,
  TRIPLICACAO_JOINT_CALIBRATION_POLICIES,
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
      20,

    sessionEvent:
      'NO_RECOMMENDATION',

    formationState:
      'WAITING_THIRD',

    firstNumber:
      11,

    secondNumber:
      20,

    trioCompleted:
      false,

    trioDiscarded:
      false,

    trioNumbers:
      null,

    actualPatternKind:
      null,

    actionStatus:
      'NO_ACTION',

    selectedPatternKind:
      'NTC',

    probabilityMode:
      'OBSERVE',

    advancedEvidenceScore:
      33.5,

    advancedConfidenceScore:
      0.313,

    advancedRiskScore:
      0.560,

    baseOperationalMode:
      'OBSERVE',

    baseDominantPattern:
      'NTC',

    baseDominantFrequencyScore:
      29,

    baseConfidenceScore:
      0.295,

    baseRiskScore:
      0.626,

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
  'TriplicacaoJointCounterfactualCalibrationMatrix',
  () => {
    const matrix =
      new TriplicacaoJointCounterfactualCalibrationMatrix();


    test(
      'provides official and four joint counterfactual scenarios',
      () => {
        expect(
          TRIPLICACAO_JOINT_CALIBRATION_POLICIES.map(
            (policy) =>
              policy.id,
          ),
        ).toEqual([
          'OFFICIAL',
          'P25_PERMISSIVE',
          'P50_BALANCED',
          'EMPIRICAL_STEP',
          'P75_SELECTIVE',
        ]);
      },
    );


    test(
      'official thresholds remain unchanged',
      () => {
        expect(
          TRIPLICACAO_JOINT_CALIBRATION_POLICIES[0],
        ).toEqual({
          id:
            'OFFICIAL',

          label:
            'Institucional atual',

          baseDominanceMinimum:
            58,

          baseConfidenceMinimum:
            0.70,

          baseRiskMaximum:
            0.33,

          advancedEvidenceMinimum:
            68,

          advancedConfidenceMinimum:
            0.72,

          advancedRiskMaximum:
            0.34,

          official:
            true,
        });
      },
    );


    test(
      'balanced event passes balanced joint scenario',
      () => {
        const report =
          matrix.analyze({
            events: [
              event(),
            ],
          });

        const balanced =
          report.scenarios.find(
            (scenario) =>
              scenario.policy.id ===
              'P50_BALANCED',
          );

        expect(
          balanced.counterfactualPaperOnlyEvents,
        ).toBe(
          1,
        );

        expect(
          balanced.evaluations[0]
            .gates
            .allPassed,
        ).toBe(
          true,
        );
      },
    );


    test(
      'balanced event still fails official policy',
      () => {
        const report =
          matrix.analyze({
            events: [
              event(),
            ],
          });

        const official =
          report.scenarios.find(
            (scenario) =>
              scenario.policy.id ===
              'OFFICIAL',
          );

        expect(
          official.counterfactualPaperOnlyEvents,
        ).toBe(
          0,
        );
      },
    );


    test(
      'permissive scenario admits event below balanced thresholds',
      () => {
        const report =
          matrix.analyze({
            events: [
              event({
                baseDominantFrequencyScore:
                  28,

                baseConfidenceScore:
                  0.25,

                baseRiskScore:
                  0.66,

                advancedEvidenceScore:
                  30,

                advancedConfidenceScore:
                  0.29,

                advancedRiskScore:
                  0.59,
              }),
            ],
          });

        const permissive =
          report.scenarios.find(
            (scenario) =>
              scenario.policy.id ===
              'P25_PERMISSIVE',
          );

        const balanced =
          report.scenarios.find(
            (scenario) =>
              scenario.policy.id ===
              'P50_BALANCED',
          );

        expect(
          permissive.counterfactualPaperOnlyEvents,
        ).toBe(
          1,
        );

        expect(
          balanced.counterfactualPaperOnlyEvents,
        ).toBe(
          0,
        );
      },
    );


    test(
      'selective scenario requires stronger joint metrics',
      () => {
        const report =
          matrix.analyze({
            events: [
              event(),
            ],
          });

        const selective =
          report.scenarios.find(
            (scenario) =>
              scenario.policy.id ===
              'P75_SELECTIVE',
          );

        expect(
          selective.counterfactualPaperOnlyEvents,
        ).toBe(
          0,
        );
      },
    );


    test(
      'first formation spin is excluded from evaluable population',
      () => {
        const report =
          matrix.analyze({
            events: [
              event({
                actionStatus:
                  null,

                formationState:
                  'WAITING_SECOND',
              }),

              event({
                liveSpinIndex:
                  2,
              }),
            ],
          });

        expect(
          report.totalLiveEvents,
        ).toBe(
          2,
        );

        expect(
          report.decisionApplicableEvents,
        ).toBe(
          1,
        );
      },
    );


    test(
      'selected advanced pattern is still mandatory',
      () => {
        const report =
          matrix.analyze({
            events: [
              event({
                selectedPatternKind:
                  null,
              }),
            ],
          });

        const permissive =
          report.scenarios.find(
            (scenario) =>
              scenario.policy.id ===
              'P25_PERMISSIVE',
          );

        expect(
          permissive.counterfactualPaperOnlyEvents,
        ).toBe(
          0,
        );
      },
    );


    test(
      'joint calibration has no execution or bankroll authority',
      () => {
        const report =
          matrix.analyze({
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
          matrix.placeBet,
        ).toBeUndefined();

        expect(
          matrix.executeBet,
        ).toBeUndefined();
      },
    );
  },
);
