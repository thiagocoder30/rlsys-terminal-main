const {
  PaperOracleTargetResolver,
} = require(
  '../../../dist/application/runtime/PaperOracleTargetResolver.js'
);


function analysis(
  overrides = {},
) {
  return {
    status:
      'ALLOWED',

    reason:
      'Sinal estatístico detectado.',

    metrics: {},

    signals: [
      {
        type:
          'SECTOR_BIAS',

        target:
          'voisins',

        confidence:
          0.72,

        rationale:
          'Bias estrutural em voisins.',
      },

      {
        type:
          'MARKOV_TRANSITION',

        target:
          'tiers',

        confidence:
          0.61,

        rationale:
          'Transição recente para tiers.',
      },
    ],

    suggestedFraction:
      0.005,

    bankroll:
      0.005,

    risk: {
      level:
        'MEDIUM',

      warnings: [
        'Amostra abaixo de 500 giros.',
      ],
    },

    ...overrides,
  };
}


describe(
  'PaperOracleTargetResolver',
  () => {
    test(
      'does not resolve target before PAPER favorable oracle decision',
      () => {
        let analyzeCalled =
          false;

        const resolver =
          new PaperOracleTargetResolver({
            analyze() {
              analyzeCalled =
                true;

              return analysis();
            },
          });

        const result =
          resolver.resolve({
            oracleDecision:
              'WATCHLIST',

            warmupRounds:
              [1, 2, 3],

            liveRounds:
              [4, 5, 6],

            bankroll:
              30,
          });

        expect(
          result.status,
        ).toBe('NONE');

        expect(
          result.target,
        ).toBeNull();

        expect(
          analyzeCalled,
        ).toBe(false);
      },
    );


    test(
      'selects highest confidence supported strategy signal',
      () => {
        const resolver =
          new PaperOracleTargetResolver({
            analyze() {
              return analysis();
            },
          });

        const result =
          resolver.resolve({
            oracleDecision:
              'PAPER_FAVORAVEL',

            warmupRounds:
              [1, 2, 3],

            liveRounds:
              [4, 5, 6],

            bankroll:
              30,
          });

        expect(
          result.status,
        ).toBe('CANDIDATE');

        expect(
          result.strategySignal,
        ).toBe(
          'SECTOR_BIAS',
        );

        expect(
          result.target,
        ).toBe('voisins');

        expect(
          result.confidencePercent,
        ).toBe(72);
      },
    );


    test(
      'uses deterministic tie break in favor of sector bias',
      () => {
        const resolver =
          new PaperOracleTargetResolver({
            analyze() {
              return analysis({
                signals: [
                  {
                    type:
                      'MARKOV_TRANSITION',

                    target:
                      'tiers',

                    confidence:
                      0.7,

                    rationale:
                      'transition',
                  },

                  {
                    type:
                      'SECTOR_BIAS',

                    target:
                      'orphelins',

                    confidence:
                      0.7,

                    rationale:
                      'bias',
                  },
                ],
              });
            },
          });

        const result =
          resolver.resolve({
            oracleDecision:
              'PAPER_FAVORAVEL',

            warmupRounds:
              [1, 2, 3],

            liveRounds:
              [4, 5, 6],

            bankroll:
              30,
          });

        expect(
          result.strategySignal,
        ).toBe(
          'SECTOR_BIAS',
        );

        expect(
          result.target,
        ).toBe(
          'orphelins',
        );
      },
    );


    test(
      'calculates bounded PAPER stake from strategy fraction',
      () => {
        const resolver =
          new PaperOracleTargetResolver({
            analyze() {
              return analysis({
                suggestedFraction:
                  0.005,
              });
            },
          });

        const result =
          resolver.resolve({
            oracleDecision:
              'PAPER_FAVORAVEL',

            warmupRounds:
              [1, 2, 3],

            liveRounds:
              [4, 5, 6],

            bankroll:
              30,
          });

        expect(
          result.suggestedFraction,
        ).toBe(0.005);

        expect(
          result.suggestedStake,
        ).toBe(0.15);
      },
    );


    test(
      'caps legacy fraction to one percent',
      () => {
        const resolver =
          new PaperOracleTargetResolver({
            analyze() {
              return analysis({
                suggestedFraction:
                  0.25,
              });
            },
          });

        const result =
          resolver.resolve({
            oracleDecision:
              'PAPER_FAVORAVEL',

            warmupRounds:
              [1, 2, 3],

            liveRounds:
              [4, 5, 6],

            bankroll:
              100,
          });

        expect(
          result.suggestedFraction,
        ).toBe(0.01);

        expect(
          result.suggestedStake,
        ).toBe(1);
      },
    );


    test(
      'fails closed when strategy engine is locked',
      () => {
        const resolver =
          new PaperOracleTargetResolver({
            analyze() {
              return analysis({
                status:
                  'LOCKED',

                signals: [],

                suggestedFraction:
                  0,

                risk: {
                  level:
                    'CRITICAL',

                  warnings: [
                    'No evidence.',
                  ],
                },
              });
            },
          });

        const result =
          resolver.resolve({
            oracleDecision:
              'PAPER_FAVORAVEL',

            warmupRounds:
              [1, 2, 3],

            liveRounds:
              [4, 5, 6],

            bankroll:
              30,
          });

        expect(
          result.status,
        ).toBe('NONE');

        expect(
          result.target,
        ).toBeNull();
      },
    );


    test(
      'fails closed when strategy risk is high',
      () => {
        const resolver =
          new PaperOracleTargetResolver({
            analyze() {
              return analysis({
                risk: {
                  level:
                    'HIGH',

                  warnings: [
                    'High risk.',
                  ],
                },
              });
            },
          });

        const result =
          resolver.resolve({
            oracleDecision:
              'PAPER_FAVORAVEL',

            warmupRounds:
              [1, 2, 3],

            liveRounds:
              [4, 5, 6],

            bankroll:
              30,
          });

        expect(
          result.status,
        ).toBe('NONE');

        expect(
          result.reasons,
        ).toContain(
          'TARGET_BLOCKED_BY_RISK',
        );
      },
    );


    test(
      'rejects unsupported target instead of inventing mapping',
      () => {
        const resolver =
          new PaperOracleTargetResolver({
            analyze() {
              return analysis({
                signals: [
                  {
                    type:
                      'SECTOR_BIAS',

                    target:
                      'unknown',

                    confidence:
                      0.9,

                    rationale:
                      'unsupported',
                  },
                ],
              });
            },
          });

        const result =
          resolver.resolve({
            oracleDecision:
              'PAPER_FAVORAVEL',

            warmupRounds:
              [1, 2, 3],

            liveRounds:
              [4, 5, 6],

            bankroll:
              30,
          });

        expect(
          result.status,
        ).toBe('NONE');

        expect(
          result.target,
        ).toBeNull();
      },
    );


    test(
      'preserves PAPER safety invariants',
      () => {
        const resolver =
          new PaperOracleTargetResolver({
            analyze() {
              return analysis();
            },
          });

        const result =
          resolver.resolve({
            oracleDecision:
              'PAPER_FAVORAVEL',

            warmupRounds:
              [1, 2, 3],

            liveRounds:
              [4, 5, 6],

            bankroll:
              30,
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
