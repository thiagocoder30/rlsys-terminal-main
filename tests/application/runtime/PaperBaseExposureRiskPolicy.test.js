const {
  PaperBaseExposureRiskPolicy,
} = require(
  '../../../dist/application/runtime/PaperBaseExposureRiskPolicy.js',
);

const {
  PaperStakeRecommendationResolver,
} = require(
  '../../../dist/application/runtime/PaperStakeRecommendationResolver.js',
);


describe(
  'PaperBaseExposureRiskPolicy',
  () => {
    test.each([
      [
        'conservative',
        0.01,
      ],

      [
        'moderate',
        0.02,
      ],

      [
        'aggressive',
        0.03,
      ],
    ])(
      '%s exposes certified base fraction',
      (
        riskMode,
        expected,
      ) => {
        expect(
          new PaperBaseExposureRiskPolicy()
            .resolve(
              riskMode,
            )
            .exposureFraction,
        ).toBe(
          expected,
        );
      },
    );


    test.each([
      'conservative',
      'moderate',
      'aggressive',
    ])(
      '%s remains identical to certified PaperStakeRecommendationResolver doctrine',
      (
        riskMode,
      ) => {
        const policy =
          new PaperBaseExposureRiskPolicy()
            .resolve(
              riskMode,
            );

        const existing =
          new PaperStakeRecommendationResolver()
            .resolve({
              bankroll:
                100,

              riskMode,

              minimumStake:
                0.10,

              strategyRiskScore:
                0,
            });

        expect(
          policy.exposureFraction,
        ).toBe(
          existing.exposureLimitFraction,
        );
      },
    );


    test(
      'rejects unknown mode',
      () => {
        expect(
          () =>
            new PaperBaseExposureRiskPolicy()
              .resolve(
                'unknown',
              ),
        ).toThrow(
          'paper_base_exposure_invalid_risk_mode',
        );
      },
    );
  },
);


describe(
  'sovereign exposure authority hardening',
  () => {
    test(
      'stake resolver cannot be overridden by injected exposure doctrine',
      () => {
        const maliciousPolicy = {
          resolve() {
            return {
              riskMode:
                'moderate',

              exposureFraction:
                0.50,
            };
          },
        };

        /*
         * JavaScript permits surplus constructor arguments.
         * They must have no authority.
         */
        const resolver =
          new PaperStakeRecommendationResolver(
            maliciousPolicy,
          );

        const result =
          resolver.resolve({
            bankroll:
              100,

            riskMode:
              'moderate',

            minimumStake:
              0.10,

            strategyRiskScore:
              0,
          });

        expect(
          result.exposureLimitFraction,
        ).toBe(
          0.02,
        );

        expect(
          result.exposureLimitAmount,
        ).toBe(
          2,
        );
      },
    );
  },
);
