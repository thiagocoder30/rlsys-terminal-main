const {
  TriplicacaoCounterfactualCalibrationMatrix,
  TRIPLICACAO_DEFAULT_CALIBRATION_POLICIES,
} = require(
  '../../../dist/application/runtime/TriplicacaoCounterfactualCalibrationMatrix.js'
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
      41,

    advancedConfidenceScore:
      0.376,

    advancedRiskScore:
      0.522,

    baseOperationalMode:
      'OBSERVE',

    baseDominantPattern:
      'NTC',

    baseDominantFrequencyScore:
      31,

    baseConfidenceScore:
      0.353,

    baseRiskScore:
      0.584,

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

    blockers: [
      'TRIPLICACAO_ADVANCED_EVIDENCIA_INSUFICIENTE',
    ],

    recommendationIssued:
      false,

    ...overrides,
  };
}


describe(
  'TriplicacaoCounterfactualCalibrationMatrix',
  () => {
    const matrix =
      new TriplicacaoCounterfactualCalibrationMatrix();


    test(
      'default matrix preserves current official policy',
      () => {
        expect(
          TRIPLICACAO_DEFAULT_CALIBRATION_POLICIES[0],
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
      'default matrix compares 58 50 45 and 42 dominance',
      () => {
        expect(
          TRIPLICACAO_DEFAULT_CALIBRATION_POLICIES.map(
            (policy) =>
              policy
                .baseDominanceMinimum,
          ),
        ).toEqual([
          58,
          50,
          45,
          42,
        ]);
      },
    );


    test(
      'first formation spin is excluded from decision-applicable population',
      () => {
        const report =
          matrix.analyze({
            events: [
              event({
                liveSpinIndex:
                  1,

                formationState:
                  'WAITING_SECOND',

                actionStatus:
                  null,
              }),

              event({
                liveSpinIndex:
                  2,

                formationState:
                  'WAITING_THIRD',

                actionStatus:
                  'NO_ACTION',
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
      'lowering dominance alone does not bypass confidence risk or advanced gates',
      () => {
        const report =
          matrix.analyze({
            events: [
              event({
                baseDominantFrequencyScore:
                  44,

                baseConfidenceScore:
                  0.40,

                baseRiskScore:
                  0.55,

                advancedEvidenceScore:
                  50,

                advancedConfidenceScore:
                  0.45,

                advancedRiskScore:
                  0.50,
              }),
            ],
          });

        const d42 =
          report.scenarios.find(
            (scenario) =>
              scenario
                .policy.id ===
              'D42_ONLY',
          );

        expect(
          d42.counterfactualPaperOnlyEvents,
        ).toBe(
          0,
        );

        expect(
          d42.evaluations[0]
            .gates
            .baseDominance,
        ).toBe(
          true,
        );

        expect(
          d42.evaluations[0]
            .gates
            .baseConfidence,
        ).toBe(
          false,
        );

        expect(
          d42.evaluations[0]
            .gates
            .baseRisk,
        ).toBe(
          false,
        );
      },
    );


    test(
      'counterfactual base PAPER_ONLY is derived from scenario rather than official mode',
      () => {
        const customPolicy = {
          id:
            'TEST_RELAXED',

          label:
            'test',

          baseDominanceMinimum:
            40,

          baseConfidenceMinimum:
            0.40,

          baseRiskMaximum:
            0.50,

          advancedEvidenceMinimum:
            50,

          advancedConfidenceMinimum:
            0.50,

          advancedRiskMaximum:
            0.50,

          official:
            false,
        };

        const report =
          matrix.analyze({
            events: [
              event({
                baseOperationalMode:
                  'OBSERVE',

                baseDominantFrequencyScore:
                  45,

                baseConfidenceScore:
                  0.50,

                baseRiskScore:
                  0.40,

                advancedEvidenceScore:
                  60,

                advancedConfidenceScore:
                  0.60,

                advancedRiskScore:
                  0.40,
              }),
            ],

            policies: [
              customPolicy,
            ],
          });

        expect(
          report.scenarios[0]
            .evaluations[0]
            .gates
            .basePaperOnly,
        ).toBe(
          true,
        );

        expect(
          report.scenarios[0]
            .counterfactualPaperOnlyEvents,
        ).toBe(
          1,
        );
      },
    );


    test(
      'selected advanced pattern remains mandatory',
      () => {
        const relaxed = {
          id:
            'RELAXED',

          label:
            'relaxed',

          baseDominanceMinimum:
            0,

          baseConfidenceMinimum:
            0,

          baseRiskMaximum:
            1,

          advancedEvidenceMinimum:
            0,

          advancedConfidenceMinimum:
            0,

          advancedRiskMaximum:
            1,

          official:
            false,
        };

        const report =
          matrix.analyze({
            events: [
              event({
                selectedPatternKind:
                  null,
              }),
            ],

            policies: [
              relaxed,
            ],
          });

        expect(
          report.scenarios[0]
            .counterfactualPaperOnlyEvents,
        ).toBe(
          0,
        );

        expect(
          report.scenarios[0]
            .evaluations[0]
            .gates
            .advancedPatternSelected,
        ).toBe(
          false,
        );
      },
    );


    test(
      'reports metric distributions from decision-applicable events',
      () => {
        const report =
          matrix.analyze({
            events: [
              event({
                liveSpinIndex:
                  1,

                baseDominantFrequencyScore:
                  30,
              }),

              event({
                liveSpinIndex:
                  2,

                baseDominantFrequencyScore:
                  40,
              }),

              event({
                liveSpinIndex:
                  3,

                baseDominantFrequencyScore:
                  50,
              }),
            ],
          });

        expect(
          report.distributions
            .baseDominance
            .minimum,
        ).toBe(
          30,
        );

        expect(
          report.distributions
            .baseDominance
            .median,
        ).toBe(
          40,
        );

        expect(
          report.distributions
            .baseDominance
            .maximum,
        ).toBe(
          50,
        );

        expect(
          report.distributions
            .baseDominance
            .mean,
        ).toBe(
          40,
        );
      },
    );


    test(
      'counts gate failures independently',
      () => {
        const report =
          matrix.analyze({
            events: [
              event({
                baseDominantFrequencyScore:
                  35,

                baseConfidenceScore:
                  0.30,

                baseRiskScore:
                  0.60,

                advancedEvidenceScore:
                  40,

                advancedConfidenceScore:
                  0.35,

                advancedRiskScore:
                  0.55,
              }),
            ],
          });

        const official =
          report.scenarios.find(
            (scenario) =>
              scenario
                .policy.id ===
              'OFFICIAL',
          );

        expect(
          official
            .gateFailures
            .baseDominance,
        ).toBe(
          1,
        );

        expect(
          official
            .gateFailures
            .baseConfidence,
        ).toBe(
          1,
        );

        expect(
          official
            .gateFailures
            .baseRisk,
        ).toBe(
          1,
        );

        expect(
          official
            .gateFailures
            .advancedEvidence,
        ).toBe(
          1,
        );

        expect(
          official
            .gateFailures
            .advancedConfidence,
        ).toBe(
          1,
        );

        expect(
          official
            .gateFailures
            .advancedRisk,
        ).toBe(
          1,
        );
      },
    );


    test(
      'calibration remains counterfactual only with no bankroll or execution authority',
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
