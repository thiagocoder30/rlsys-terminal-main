const {
  TriplicacaoLiveStatsDiagnostics,
  TRIPLICACAO_GATE_POLICY,
} = require(
  '../../../dist/application/runtime/TriplicacaoLiveStatsDiagnostics.js'
);


describe(
  'Triplicacao gate explainability',
  () => {
    const diagnostics =
      new TriplicacaoLiveStatsDiagnostics();


    test(
      'exposes current institutional gate policy without changing engine',
      () => {
        expect(
          TRIPLICACAO_GATE_POLICY,
        ).toEqual({
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
        });
      },
    );


    test(
      'all current gates pass exactly at institutional thresholds',
      () => {
        const result =
          diagnostics.evaluateGates({
            baseOperationalMode:
              'PAPER_ONLY',

            baseDominantFrequencyScore:
              58,

            baseConfidenceScore:
              0.70,

            baseRiskScore:
              0.33,

            selectedPatternKind:
              'TC',

            advancedEvidenceScore:
              68,

            advancedConfidenceScore:
              0.72,

            advancedRiskScore:
              0.34,
          });

        expect(
          result.total,
        ).toBe(
          8,
        );

        expect(
          result.passed,
        ).toBe(
          8,
        );

        expect(
          result.failed,
        ).toBe(
          0,
        );

        expect(
          result.allPassed,
        ).toBe(
          true,
        );
      },
    );


    test(
      'realistic blocked sample exposes every failed gate independently',
      () => {
        const result =
          diagnostics.evaluateGates({
            baseOperationalMode:
              'OBSERVE',

            baseDominantFrequencyScore:
              35,

            baseConfidenceScore:
              0.166,

            baseRiskScore:
              0.798,

            selectedPatternKind:
              'NTA',

            advancedEvidenceScore:
              31,

            advancedConfidenceScore:
              0.241,

            advancedRiskScore:
              0.646,
          });

        const byId =
          Object.fromEntries(
            result.evaluations.map(
              (gate) => [
                gate.id,
                gate,
              ],
            ),
          );

        expect(
          byId.BASE_DOMINANCE.passed,
        ).toBe(
          false,
        );

        expect(
          byId.BASE_CONFIDENCE.passed,
        ).toBe(
          false,
        );

        expect(
          byId.BASE_RISK.passed,
        ).toBe(
          false,
        );

        expect(
          byId.BASE_PAPER_ONLY.passed,
        ).toBe(
          false,
        );

        expect(
          byId.ADVANCED_PATTERN_SELECTED.passed,
        ).toBe(
          true,
        );

        expect(
          byId.ADVANCED_EVIDENCE.passed,
        ).toBe(
          false,
        );

        expect(
          byId.ADVANCED_CONFIDENCE.passed,
        ).toBe(
          false,
        );

        expect(
          byId.ADVANCED_RISK.passed,
        ).toBe(
          false,
        );

        expect(
          result.failed,
        ).toBe(
          7,
        );
      },
    );


    test(
      'minimum gate margin shows how far metric is below threshold',
      () => {
        const result =
          diagnostics.evaluateGates({
            baseOperationalMode:
              'OBSERVE',

            baseDominantFrequencyScore:
              35,

            baseConfidenceScore:
              0.70,

            baseRiskScore:
              0.33,

            selectedPatternKind:
              'TC',

            advancedEvidenceScore:
              68,

            advancedConfidenceScore:
              0.72,

            advancedRiskScore:
              0.34,
          });

        const dominance =
          result.evaluations.find(
            (gate) =>
              gate.id ===
              'BASE_DOMINANCE',
          );

        expect(
          dominance.margin,
        ).toBe(
          -23,
        );
      },
    );


    test(
      'maximum risk gate margin is negative when risk exceeds policy',
      () => {
        const result =
          diagnostics.evaluateGates({
            baseOperationalMode:
              'OBSERVE',

            baseDominantFrequencyScore:
              58,

            baseConfidenceScore:
              0.70,

            baseRiskScore:
              0.798,

            selectedPatternKind:
              'TC',

            advancedEvidenceScore:
              68,

            advancedConfidenceScore:
              0.72,

            advancedRiskScore:
              0.646,
          });

        const baseRisk =
          result.evaluations.find(
            (gate) =>
              gate.id ===
              'BASE_RISK',
          );

        const advancedRisk =
          result.evaluations.find(
            (gate) =>
              gate.id ===
              'ADVANCED_RISK',
          );

        expect(
          baseRisk.passed,
        ).toBe(
          false,
        );

        expect(
          baseRisk.margin,
        ).toBeLessThan(
          0,
        );

        expect(
          advancedRisk.passed,
        ).toBe(
          false,
        );

        expect(
          advancedRisk.margin,
        ).toBeLessThan(
          0,
        );
      },
    );


    test(
      'gate diagnostics have no execution capability',
      () => {
        expect(
          typeof diagnostics.evaluateGates,
        ).toBe(
          'function',
        );

        expect(
          diagnostics.placeBet,
        ).toBeUndefined();

        expect(
          diagnostics.autoBet,
        ).toBeUndefined();

        expect(
          diagnostics.executeBet,
        ).toBeUndefined();
      },
    );
  },
);
