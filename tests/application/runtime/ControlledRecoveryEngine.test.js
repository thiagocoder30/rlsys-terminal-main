const {
  ControlledRecoveryEngine,
} = require(
  '../../../dist/application/runtime/ControlledRecoveryEngine.js'
);


describe(
  'ControlledRecoveryEngine',
  () => {
    const engine =
      new ControlledRecoveryEngine();


    test(
      'does not enter recovery when no loss debt exists',
      () => {
        const result =
          engine.evaluate({
            bankroll:
              30,

            riskMode:
              'moderate',

            martingaleEnabled:
              true,

            baseStake:
              0.60,

            pendingLossDebt:
              0,

            strategyRiskScore:
              0.20,

            drawdownFraction:
              0,

            minimumStake:
              0.10,
          });

        expect(
          result.decision,
        ).toBe(
          'NO_RECOVERY',
        );

        expect(
          result.suggestedStake,
        ).toBe(0.60);
      },
    );


    test(
      'martingale off preserves base stake despite pending debt',
      () => {
        const result =
          engine.evaluate({
            bankroll:
              30,

            riskMode:
              'moderate',

            martingaleEnabled:
              false,

            baseStake:
              0.60,

            pendingLossDebt:
              0.60,

            strategyRiskScore:
              0.20,

            drawdownFraction:
              0.02,

            minimumStake:
              0.10,
          });

        expect(
          result.decision,
        ).toBe(
          'BASE_STAKE_ONLY',
        );

        expect(
          result.suggestedStake,
        ).toBe(0.60);

        expect(
          result.recoveryComponent,
        ).toBe(0);
      },
    );


    test(
      'moderate recovery never exceeds three percent bankroll exposure',
      () => {
        const result =
          engine.evaluate({
            bankroll:
              29.40,

            riskMode:
              'moderate',

            martingaleEnabled:
              true,

            baseStake:
              0.50,

            pendingLossDebt:
              0.60,

            strategyRiskScore:
              0.20,

            drawdownFraction:
              0.02,

            minimumStake:
              0.10,
          });

        expect(
          result.maximumRecoveryExposureFraction,
        ).toBe(0.03);

        expect(
          result.maximumRecoveryStake,
        ).toBe(0.80);

        expect(
          result.suggestedStake,
        ).toBeLessThanOrEqual(
          0.80,
        );

        expect(
          result.suggestedStake,
        ).toBe(0.80);

        expect(
          result.recoveryComponent,
        ).toBe(0.30);

        expect(
          result.remainingLossDebtIfWin,
        ).toBe(0.30);

        expect(
          result.decision,
        ).toBe(
          'RECOVERY_REDUCED',
        );
      },
    );


    test(
      'recovery may fully clear a small debt inside safe budget',
      () => {
        const result =
          engine.evaluate({
            bankroll:
              50,

            riskMode:
              'moderate',

            martingaleEnabled:
              true,

            baseStake:
              1,

            pendingLossDebt:
              0.40,

            strategyRiskScore:
              0.20,

            drawdownFraction:
              0.01,

            minimumStake:
              0.10,
          });

        expect(
          result.suggestedStake,
        ).toBe(1.40);

        expect(
          result.recoveryComponent,
        ).toBe(0.40);

        expect(
          result.remainingLossDebtIfWin,
        ).toBe(0);

        expect(
          result.decision,
        ).toBe(
          'RECOVERY_ALLOWED',
        );
      },
    );


    test(
      'high strategy risk suppresses recovery instead of increasing stake',
      () => {
        const result =
          engine.evaluate({
            bankroll:
              30,

            riskMode:
              'moderate',

            martingaleEnabled:
              true,

            baseStake:
              0.60,

            pendingLossDebt:
              1.20,

            strategyRiskScore:
              0.60,

            drawdownFraction:
              0.03,

            minimumStake:
              0.10,
          });

        expect(
          result.decision,
        ).toBe(
          'BASE_STAKE_ONLY',
        );

        expect(
          result.suggestedStake,
        ).toBe(0.60);

        expect(
          result.warnings,
        ).toContain(
          'RECOVERY_SUPPRESSED_BY_STRATEGY_RISK',
        );
      },
    );


    test(
      'excessive drawdown blocks recovery operation',
      () => {
        const result =
          engine.evaluate({
            bankroll:
              25,

            riskMode:
              'moderate',

            martingaleEnabled:
              true,

            baseStake:
              0.50,

            pendingLossDebt:
              3,

            strategyRiskScore:
              0.20,

            drawdownFraction:
              0.15,

            minimumStake:
              0.10,
          });

        expect(
          result.decision,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.suggestedStake,
        ).toBeNull();

        expect(
          result.blockers,
        ).toContain(
          'RECOVERY_DRAWDOWN_LIMIT_REACHED',
        );
      },
    );


    test(
      'drawdown caution reduces neither safety nor audit visibility',
      () => {
        const result =
          engine.evaluate({
            bankroll:
              30,

            riskMode:
              'moderate',

            martingaleEnabled:
              true,

            baseStake:
              0.60,

            pendingLossDebt:
              0.20,

            strategyRiskScore:
              0.20,

            drawdownFraction:
              0.10,

            minimumStake:
              0.10,
          });

        expect(
          result.decision,
        ).toBe(
          'RECOVERY_ALLOWED',
        );

        expect(
          result.warnings,
        ).toContain(
          'RECOVERY_DRAWDOWN_CAUTION',
        );
      },
    );


    test(
      'provider increment may force base stake only',
      () => {
        const result =
          engine.evaluate({
            bankroll:
              30,

            riskMode:
              'moderate',

            martingaleEnabled:
              true,

            baseStake:
              0.50,

            pendingLossDebt:
              0.20,

            strategyRiskScore:
              0.20,

            drawdownFraction:
              0.02,

            minimumStake:
              0.50,
          });

        expect(
          result.suggestedStake,
        ).toBe(0.50);

        expect(
          result.recoveryComponent,
        ).toBe(0);

        expect(
          result.decision,
        ).toBe(
          'BASE_STAKE_ONLY',
        );
      },
    );


    test(
      'preserves permanent human execution invariant',
      () => {
        const result =
          engine.evaluate({
            bankroll:
              30,

            riskMode:
              'moderate',

            martingaleEnabled:
              true,

            baseStake:
              0.60,

            pendingLossDebt:
              0.60,

            strategyRiskScore:
              0.20,

            drawdownFraction:
              0.02,

            minimumStake:
              0.10,
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
