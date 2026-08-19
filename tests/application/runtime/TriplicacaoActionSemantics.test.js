const {
  TriplicacaoActionSemantics,
} = require(
  '../../../dist/application/runtime/TriplicacaoActionSemantics.js'
);


function analysis(
  pattern,
  overrides = {},
) {
  return {
    baseAnalysis: {},

    metrics: [],

    selectedPatternKind:
      pattern,

    advancedEvidenceScore:
      80,

    advancedConfidenceScore:
      0.78,

    advancedRiskScore:
      0.22,

    probabilityMode:
      'PAPER_ONLY',

    liveMoneyAuthorized:
      false,

    reasons: [],

    warnings: [],

    blockers: [],

    ...overrides,
  };
}


describe(
  'TriplicacaoActionSemantics',
  () => {
    const resolver =
      new TriplicacaoActionSemantics();


    test(
      'TC with RED RED targets RED',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis('TC'),

            firstNumber:
              1,

            secondNumber:
              3,
          });

        expect(
          result.status,
        ).toBe('ACTION');

        expect(
          result.openingRelation,
        ).toBe('SAME');

        expect(
          result.targetColor,
        ).toBe('RED');
      },
    );


    test(
      'TC with BLACK BLACK targets BLACK',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis('TC'),

            firstNumber:
              2,

            secondNumber:
              4,
          });

        expect(
          result.status,
        ).toBe('ACTION');

        expect(
          result.targetColor,
        ).toBe('BLACK');
      },
    );


    test(
      'NTC with RED RED targets BLACK',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis('NTC'),

            firstNumber:
              1,

            secondNumber:
              3,
          });

        expect(
          result.status,
        ).toBe('ACTION');

        expect(
          result.targetColor,
        ).toBe('BLACK');
      },
    );


    test(
      'NTC with BLACK BLACK targets RED',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis('NTC'),

            firstNumber:
              2,

            secondNumber:
              4,
          });

        expect(
          result.status,
        ).toBe('ACTION');

        expect(
          result.targetColor,
        ).toBe('RED');
      },
    );


    test(
      'TA with RED BLACK targets RED',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis('TA'),

            firstNumber:
              1,

            secondNumber:
              2,
          });

        expect(
          result.status,
        ).toBe('ACTION');

        expect(
          result.openingRelation,
        ).toBe(
          'ALTERNATING',
        );

        expect(
          result.targetColor,
        ).toBe('RED');
      },
    );


    test(
      'TA with BLACK RED targets BLACK',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis('TA'),

            firstNumber:
              2,

            secondNumber:
              1,
          });

        expect(
          result.status,
        ).toBe('ACTION');

        expect(
          result.targetColor,
        ).toBe('BLACK');
      },
    );


    test(
      'NTA with RED BLACK targets BLACK',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis('NTA'),

            firstNumber:
              1,

            secondNumber:
              2,
          });

        expect(
          result.status,
        ).toBe('ACTION');

        expect(
          result.targetColor,
        ).toBe('BLACK');
      },
    );


    test(
      'NTA with BLACK RED targets RED',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis('NTA'),

            firstNumber:
              2,

            secondNumber:
              1,
          });

        expect(
          result.status,
        ).toBe('ACTION');

        expect(
          result.targetColor,
        ).toBe('RED');
      },
    );


    test(
      'TC does not act on alternating opening',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis('TC'),

            firstNumber:
              1,

            secondNumber:
              2,
          });

        expect(
          result.status,
        ).toBe('NO_ACTION');

        expect(
          result.targetColor,
        ).toBeNull();

        expect(
          result.warnings,
        ).toContain(
          'TRIPLICACAO_PATTERN_OPENING_NOT_COMPATIBLE',
        );
      },
    );


    test(
      'TA does not act on same-color opening',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis('TA'),

            firstNumber:
              1,

            secondNumber:
              3,
          });

        expect(
          result.status,
        ).toBe('NO_ACTION');

        expect(
          result.targetColor,
        ).toBeNull();
      },
    );


    test(
      'does not act when advanced engine is OBSERVE',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis(
                'TC',
                {
                  probabilityMode:
                    'OBSERVE',
                },
              ),

            firstNumber:
              1,

            secondNumber:
              3,
          });

        expect(
          result.status,
        ).toBe('NO_ACTION');

        expect(
          result.targetColor,
        ).toBeNull();
      },
    );


    test(
      'does not act without selected pattern',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis(
                null,
              ),

            firstNumber:
              1,

            secondNumber:
              3,
          });

        expect(
          result.status,
        ).toBe('NO_ACTION');

        expect(
          result.targetColor,
        ).toBeNull();
      },
    );


    test(
      'zero in first opening position blocks prospective trio',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis('TC'),

            firstNumber:
              0,

            secondNumber:
              3,
          });

        expect(
          result.status,
        ).toBe(
          'ZERO_BLOCKED',
        );

        expect(
          result.targetColor,
        ).toBeNull();

        expect(
          result.blockers,
        ).toContain(
          'TRIPLICACAO_ACTION_ZERO_BLOCKED',
        );
      },
    );


    test(
      'zero in second opening position blocks prospective trio',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis('TA'),

            firstNumber:
              1,

            secondNumber:
              0,
          });

        expect(
          result.status,
        ).toBe(
          'ZERO_BLOCKED',
        );

        expect(
          result.targetColor,
        ).toBeNull();
      },
    );


    test(
      'rejects invalid roulette number',
      () => {
        expect(
          () =>
            resolver.resolve({
              analysis:
                analysis('TC'),

              firstNumber:
                37,

              secondNumber:
                1,
            }),
        ).toThrow(
          'triplicacao_action_invalid_number',
        );
      },
    );


    test(
      'preserves confidence evidence and risk from advanced analysis',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis(
                'TC',
                {
                  advancedEvidenceScore:
                    83,

                  advancedConfidenceScore:
                    0.81,

                  advancedRiskScore:
                    0.19,
                },
              ),

            firstNumber:
              1,

            secondNumber:
              3,
          });

        expect(
          result.evidenceScore,
        ).toBe(83);

        expect(
          result.confidenceScore,
        ).toBe(0.81);

        expect(
          result.riskScore,
        ).toBe(0.19);
      },
    );


    test(
      'preserves PAPER safety invariants',
      () => {
        const result =
          resolver.resolve({
            analysis:
              analysis('TC'),

            firstNumber:
              1,

            secondNumber:
              3,
          });

        expect(
          result.paperOnly,
        ).toBe(true);

        expect(
          result.liveMoneyAuthorization,
        ).toBe(false);

        expect(
          result.automaticBetExecutionAllowed,
        ).toBe(false);

        expect(
          result.operatorDecisionRequired,
        ).toBe(true);
      },
    );
  },
);
