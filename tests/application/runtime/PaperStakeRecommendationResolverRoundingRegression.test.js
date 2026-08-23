const {
  PaperStakeRecommendationResolver,
} = require(
  '../../../dist/application/runtime/PaperStakeRecommendationResolver.js',
);


describe(
  'PaperStakeRecommendationResolver monetary cap regression',
  () => {
    test(
      'never rounds a fractional-cent exposure ceiling upward',
      () => {
        const resolver =
          new PaperStakeRecommendationResolver();

        const result =
          resolver.resolve({
            bankroll:
              119.80,

            riskMode:
              'moderate',

            minimumStake:
              0.10,

            strategyRiskScore:
              0.28,
          });

        /*
         * Mathematical cap:
         *
         * 119.80 × 2% = 2.396
         *
         * A nearest-cent rounding would produce 2.40 and violate
         * the 2% institutional ceiling.
         *
         * Canonical behavior must be conservative:
         *
         * displayed cap = 2.39
         * executable 0.10 increment = 2.30
         */
        expect(
          result.status,
        ).toBe(
          'RECOMMENDED',
        );

        expect(
          result.exposureLimitAmount,
        ).toBe(
          2.39,
        );

        expect(
          result.suggestedStake,
        ).toBe(
          2.30,
        );

        expect(
          result.suggestedStake,
        ).toBeLessThanOrEqual(
          119.80 *
          0.02,
        );

        expect(
          result.effectiveExposureFraction,
        ).toBeLessThanOrEqual(
          0.02,
        );
      },
    );


    test(
      'Evolution quantization also remains below mathematical cap',
      () => {
        const resolver =
          new PaperStakeRecommendationResolver();

        const result =
          resolver.resolve({
            bankroll:
              137.40,

            riskMode:
              'moderate',

            minimumStake:
              0.50,

            strategyRiskScore:
              0.28,
          });

        /*
         * Mathematical cap:
         *
         * 137.40 × 2% = 2.748
         *
         * Evolution executable increments:
         *
         * 2.50 is valid.
         * 3.00 would exceed the cap.
         */
        expect(
          result.status,
        ).toBe(
          'RECOMMENDED',
        );

        expect(
          result.exposureLimitAmount,
        ).toBe(
          2.74,
        );

        expect(
          result.suggestedStake,
        ).toBe(
          2.50,
        );

        expect(
          result.suggestedStake,
        ).toBeLessThanOrEqual(
          137.40 *
          0.02,
        );
      },
    );


    test(
      'exact monetary caps remain unchanged',
      () => {
        const resolver =
          new PaperStakeRecommendationResolver();

        const result =
          resolver.resolve({
            bankroll:
              100,

            riskMode:
              'moderate',

            minimumStake:
              0.10,

            strategyRiskScore:
              0.28,
          });

        expect(
          result.exposureLimitAmount,
        ).toBe(
          2,
        );

        expect(
          result.suggestedStake,
        ).toBe(
          2,
        );

        expect(
          result.effectiveExposureFraction,
        ).toBe(
          0.02,
        );
      },
    );


    test(
      'manual-only invariant remains unchanged',
      () => {
        const result =
          new PaperStakeRecommendationResolver()
            .resolve({
              bankroll:
                119.80,

              riskMode:
                'moderate',

              minimumStake:
                0.10,

              strategyRiskScore:
                0.28,
            });

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
          result.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );
      },
    );
  },
);
