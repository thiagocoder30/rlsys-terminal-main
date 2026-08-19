const {
  PaperStakeRecommendationResolver,
} = require(
  '../../../dist/application/runtime/PaperStakeRecommendationResolver.js'
);


describe(
  'PaperStakeRecommendationResolver',
  () => {
    const resolver =
      new PaperStakeRecommendationResolver();


    test(
      'moderate bankroll 30 with pragmatic minimum recommends 0.60',
      () => {
        const result =
          resolver.resolve({
            bankroll:
              30,

            riskMode:
              'moderate',

            minimumStake:
              0.10,

            strategyRiskScore:
              0.19,
          });

        expect(
          result.status,
        ).toBe(
          'RECOMMENDED',
        );

        expect(
          result.exposureLimitAmount,
        ).toBe(0.60);

        expect(
          result.suggestedStake,
        ).toBe(0.60);

        expect(
          result.effectiveExposureFraction,
        ).toBe(0.02);
      },
    );


    test(
      'moderate bankroll 30 with evolution minimum rounds down safely to 0.50',
      () => {
        const result =
          resolver.resolve({
            bankroll:
              30,

            riskMode:
              'moderate',

            minimumStake:
              0.50,

            strategyRiskScore:
              0.19,
          });

        expect(
          result.status,
        ).toBe(
          'RECOMMENDED',
        );

        expect(
          result.suggestedStake,
        ).toBe(0.50);

        expect(
          result.suggestedStake,
        ).toBeLessThanOrEqual(
          result.exposureLimitAmount,
        );
      },
    );


    test(
      'conservative mode uses one percent cap',
      () => {
        const result =
          resolver.resolve({
            bankroll:
              100,

            riskMode:
              'conservative',

            minimumStake:
              0.10,

            strategyRiskScore:
              0.20,
          });

        expect(
          result.exposureLimitFraction,
        ).toBe(0.01);

        expect(
          result.suggestedStake,
        ).toBe(1);
      },
    );


    test(
      'aggressive mode uses three percent cap',
      () => {
        const result =
          resolver.resolve({
            bankroll:
              100,

            riskMode:
              'aggressive',

            minimumStake:
              0.10,

            strategyRiskScore:
              0.20,
          });

        expect(
          result.exposureLimitFraction,
        ).toBe(0.03);

        expect(
          result.suggestedStake,
        ).toBe(3);
      },
    );


    test(
      'blocks when provider minimum exceeds safe exposure',
      () => {
        const result =
          resolver.resolve({
            bankroll:
              8,

            riskMode:
              'conservative',

            minimumStake:
              0.50,

            strategyRiskScore:
              0.20,
          });

        expect(
          result.status,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.suggestedStake,
        ).toBeNull();

        expect(
          result.blockers,
        ).toContain(
          'PAPER_STAKE_MINIMUM_EXCEEDS_SAFE_EXPOSURE',
        );
      },
    );


    test(
      'strategy risk may block but never increase stake',
      () => {
        const result =
          resolver.resolve({
            bankroll:
              100,

            riskMode:
              'moderate',

            minimumStake:
              0.10,

            strategyRiskScore:
              0.70,
          });

        expect(
          result.status,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.blockers,
        ).toContain(
          'PAPER_STAKE_STRATEGY_RISK_TOO_HIGH',
        );
      },
    );


    test(
      'smaller bankroll produces smaller stake',
      () => {
        const large =
          resolver.resolve({
            bankroll:
              100,

            riskMode:
              'moderate',

            minimumStake:
              0.10,

            strategyRiskScore:
              0.20,
          });

        const small =
          resolver.resolve({
            bankroll:
              30,

            riskMode:
              'moderate',

            minimumStake:
              0.10,

            strategyRiskScore:
              0.20,
          });

        expect(
          small.suggestedStake,
        ).toBeLessThan(
          large.suggestedStake,
        );
      },
    );


    test(
      'stake never exceeds configured exposure cap',
      () => {
        const result =
          resolver.resolve({
            bankroll:
              37,

            riskMode:
              'moderate',

            minimumStake:
              0.50,

            strategyRiskScore:
              0.20,
          });

        expect(
          result.suggestedStake,
        ).toBe(0.50);

        expect(
          result.suggestedStake,
        ).toBeLessThanOrEqual(
          37 *
          0.02,
        );
      },
    );


    test(
      'preserves permanent manual execution invariant',
      () => {
        const result =
          resolver.resolve({
            bankroll:
              100,

            riskMode:
              'moderate',

            minimumStake:
              0.10,

            strategyRiskScore:
              0.20,
          });

        expect(
          result.recommendationOnly,
        ).toBe(true);

        expect(
          result.humanExecutionRequired,
        ).toBe(true);

        expect(
          result.automaticBetExecutionAllowed,
        ).toBe(false);
      },
    );
  },
);
