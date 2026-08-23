const {
  StrategyPaperStakePlan,
} = require(
  '../../../dist/application/runtime/StrategyPaperStakePlan.js',
);


describe(
  'StrategyPaperStakePlan',
  () => {
    const resolver =
      new StrategyPaperStakePlan();


    test(
      'Fusion minimum Pragmatic layout costs BRL 1.90',
      () => {
        const result =
          resolver.resolve({
            strategyId:
              'fusion-reduced',

            provider:
              'PRAGMATIC',

            minimumChipValue:
              0.10,

            targetCount:
              19,

            maximumTotalStake:
              1.90,
          });

        expect(
          result.status,
        ).toBe(
          'READY',
        );

        expect(
          result.chipsPerTarget,
        ).toBe(
          1,
        );

        expect(
          result.stakePerTarget,
        ).toBe(
          0.10,
        );

        expect(
          result.totalStake,
        ).toBe(
          1.90,
        );
      },
    );


    test(
      'Fusion BRL 4 Pragmatic budget quantizes down to BRL 3.80',
      () => {
        const result =
          resolver.resolve({
            strategyId:
              'fusion-reduced',

            provider:
              'PRAGMATIC',

            minimumChipValue:
              0.10,

            targetCount:
              19,

            maximumTotalStake:
              4,
          });

        expect(
          result.chipsPerTarget,
        ).toBe(
          2,
        );

        expect(
          result.stakePerTarget,
        ).toBe(
          0.20,
        );

        expect(
          result.totalStake,
        ).toBe(
          3.80,
        );

        expect(
          result.unusedBudget,
        ).toBe(
          0.20,
        );
      },
    );


    test(
      'Fusion minimum Evolution layout costs BRL 9.50',
      () => {
        const result =
          resolver.resolve({
            strategyId:
              'fusion-reduced',

            provider:
              'EVOLUTION',

            minimumChipValue:
              0.50,

            targetCount:
              19,

            maximumTotalStake:
              9.50,
          });

        expect(
          result.status,
        ).toBe(
          'READY',
        );

        expect(
          result.stakePerTarget,
        ).toBe(
          0.50,
        );

        expect(
          result.totalStake,
        ).toBe(
          9.50,
        );
      },
    );


    test(
      'blocks Evolution Fusion when safe budget cannot build one layout',
      () => {
        const result =
          resolver.resolve({
            strategyId:
              'fusion-reduced',

            provider:
              'EVOLUTION',

            minimumChipValue:
              0.50,

            targetCount:
              19,

            maximumTotalStake:
              5,
          });

        expect(
          result.status,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.totalStake,
        ).toBe(
          0,
        );

        expect(
          result.minimumExecutableTotalStake,
        ).toBe(
          9.50,
        );

        expect(
          result.blocker,
        ).toBe(
          'PAPER_STAKE_BUDGET_BELOW_MINIMUM_EXECUTABLE',
        );
      },
    );


    test(
      'variable Heatmap target count uses the same physical quantizer',
      () => {
        const result =
          resolver.resolve({
            strategyId:
              'heatmap-dynamic',

            provider:
              'PRAGMATIC',

            minimumChipValue:
              0.10,

            targetCount:
              8,

            maximumTotalStake:
              3,
          });

        /*
         * One complete layout = 8 × 0.10 = 0.80
         *
         * Three complete chip layers = 2.40.
         * Four would cost 3.20 and violate the cap.
         */
        expect(
          result.chipsPerTarget,
        ).toBe(
          3,
        );

        expect(
          result.stakePerTarget,
        ).toBe(
          0.30,
        );

        expect(
          result.totalStake,
        ).toBe(
          2.40,
        );

        expect(
          result.unusedBudget,
        ).toBe(
          0.60,
        );
      },
    );


    test(
      'quantization never exceeds sovereign financial cap',
      () => {
        const scenarios = [
          {
            provider:
              'PRAGMATIC',

            minimumChipValue:
              0.10,

            targetCount:
              19,

            maximumTotalStake:
              7.99,
          },

          {
            provider:
              'EVOLUTION',

            minimumChipValue:
              0.50,

            targetCount:
              8,

            maximumTotalStake:
              17.40,
          },

          {
            provider:
              'PRAGMATIC',

            minimumChipValue:
              0.10,

            targetCount:
              3,

            maximumTotalStake:
              1.01,
          },
        ];

        for (
          const scenario of
          scenarios
        ) {
          const result =
            resolver.resolve({
              strategyId:
                'test',

              ...scenario,
            });

          if (
            result.status ===
            'READY'
          ) {
            expect(
              result.totalStake,
            ).toBeLessThanOrEqual(
              scenario.maximumTotalStake,
            );
          }
        }
      },
    );


    test(
      'is explicitly not a bankroll risk authority',
      () => {
        const result =
          resolver.resolve({
            strategyId:
              'fusion-reduced',

            provider:
              'PRAGMATIC',

            minimumChipValue:
              0.10,

            targetCount:
              19,

            maximumTotalStake:
              1.90,
          });

        expect(
          result.paperOnly,
        ).toBe(
          true,
        );

        expect(
          result.recommendationOnly,
        ).toBe(
          true,
        );

        expect(
          result.humanExecutionRequired,
        ).toBe(
          true,
        );

        expect(
          result.automaticExecutionAllowed,
        ).toBe(
          false,
        );

        expect(
          resolver.executeBet,
        ).toBeUndefined();
      },
    );
  },
);
