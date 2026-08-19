const {
  PaperCapitalPreservationGuard,
} = require(
  '../../../dist/application/runtime/PaperCapitalPreservationGuard.js'
);


describe(
  'PaperCapitalPreservationGuard',
  () => {
    const guard =
      new PaperCapitalPreservationGuard();


    test(
      'moderate profile allows normal operation inside limits',
      () => {
        const result =
          guard.evaluate({
            initialBankroll:
              30,

            currentBankroll:
              30,

            peakBankroll:
              30,

            riskMode:
              'moderate',
          });

        expect(
          result.decision,
        ).toBe('ALLOW');

        expect(
          result.stopWinFraction,
        ).toBe(0.20);

        expect(
          result.stopLossFraction,
        ).toBe(0.10);

        expect(
          result.maxDrawdownFraction,
        ).toBe(0.10);

        expect(
          result.newRecommendationsAllowed,
        ).toBe(true);

        expect(
          result.recoveryAllowed,
        ).toBe(true);
      },
    );


    test(
      'moderate stop win is twenty percent above initial bankroll',
      () => {
        const result =
          guard.evaluate({
            initialBankroll:
              30,

            currentBankroll:
              36,

            peakBankroll:
              36,

            riskMode:
              'moderate',
          });

        expect(
          result.stopWinBankroll,
        ).toBe(36);

        expect(
          result.decision,
        ).toBe('STOP');

        expect(
          result.stopReason,
        ).toBe(
          'STOP_WIN_REACHED',
        );

        expect(
          result.newRecommendationsAllowed,
        ).toBe(false);

        expect(
          result.recoveryAllowed,
        ).toBe(false);
      },
    );


    test(
      'moderate stop loss is ten percent below initial bankroll',
      () => {
        const result =
          guard.evaluate({
            initialBankroll:
              30,

            currentBankroll:
              27,

            peakBankroll:
              30,

            riskMode:
              'moderate',
          });

        expect(
          result.stopLossBankroll,
        ).toBe(27);

        expect(
          result.decision,
        ).toBe('STOP');

        expect(
          result.stopReason,
        ).toBe(
          'STOP_LOSS_REACHED',
        );
      },
    );


    test(
      'moderate max drawdown protects profits from session peak',
      () => {
        const result =
          guard.evaluate({
            initialBankroll:
              30,

            currentBankroll:
              31.50,

            peakBankroll:
              35,

            riskMode:
              'moderate',
          });

        expect(
          result.sessionProfitAmount,
        ).toBe(1.50);

        expect(
          result.drawdownAmount,
        ).toBe(3.50);

        expect(
          result.drawdownFraction,
        ).toBe(0.10);

        expect(
          result.decision,
        ).toBe('STOP');

        expect(
          result.stopReason,
        ).toBe(
          'MAX_DRAWDOWN_REACHED',
        );
      },
    );


    test(
      'drawdown stop may trigger even while session remains profitable',
      () => {
        const result =
          guard.evaluate({
            initialBankroll:
              100,

            currentBankroll:
              105,

            peakBankroll:
              117,

            riskMode:
              'moderate',
          });

        expect(
          result.sessionProfitAmount,
        ).toBe(5);

        expect(
          result.drawdownFraction,
        ).toBeGreaterThan(
          0.10,
        );

        expect(
          result.decision,
        ).toBe('STOP');

        expect(
          result.stopReason,
        ).toBe(
          'MAX_DRAWDOWN_REACHED',
        );
      },
    );


    test(
      'conservative profile uses ten five five policy',
      () => {
        const result =
          guard.evaluate({
            initialBankroll:
              100,

            currentBankroll:
              100,

            peakBankroll:
              100,

            riskMode:
              'conservative',
          });

        expect(
          result.stopWinFraction,
        ).toBe(0.10);

        expect(
          result.stopLossFraction,
        ).toBe(0.05);

        expect(
          result.maxDrawdownFraction,
        ).toBe(0.05);
      },
    );


    test(
      'aggressive profile uses thirty fifteen fifteen policy',
      () => {
        const result =
          guard.evaluate({
            initialBankroll:
              100,

            currentBankroll:
              100,

            peakBankroll:
              100,

            riskMode:
              'aggressive',
          });

        expect(
          result.stopWinFraction,
        ).toBe(0.30);

        expect(
          result.stopLossFraction,
        ).toBe(0.15);

        expect(
          result.maxDrawdownFraction,
        ).toBe(0.15);
      },
    );


    test(
      'enters caution when seventy five percent of stop loss is consumed',
      () => {
        /*
         * Moderate:
         * initial = 100
         * stop loss = 10
         * 75% consumed = loss of 7.50
         */
        const result =
          guard.evaluate({
            initialBankroll:
              100,

            currentBankroll:
              92.50,

            peakBankroll:
              100,

            riskMode:
              'moderate',
          });

        expect(
          result.decision,
        ).toBe(
          'CAUTION',
        );

        expect(
          result.warnings,
        ).toContain(
          'CAPITAL_PRESERVATION_STOP_LOSS_CAUTION',
        );

        expect(
          result.newRecommendationsAllowed,
        ).toBe(true);

        expect(
          result.recoveryAllowed,
        ).toBe(false);
      },
    );


    test(
      'enters caution when seventy five percent of drawdown limit is consumed',
      () => {
        /*
         * Moderate max drawdown = 10%.
         * Peak 100 -> current 92.50 = 7.5%.
         */
        const result =
          guard.evaluate({
            initialBankroll:
              90,

            currentBankroll:
              92.50,

            peakBankroll:
              100,

            riskMode:
              'moderate',
          });

        expect(
          result.decision,
        ).toBe(
          'CAUTION',
        );

        expect(
          result.warnings,
        ).toContain(
          'CAPITAL_PRESERVATION_DRAWDOWN_CAUTION',
        );

        expect(
          result.recoveryAllowed,
        ).toBe(false);
      },
    );


    test(
      'caution disables recovery but does not necessarily stop base recommendations',
      () => {
        const result =
          guard.evaluate({
            initialBankroll:
              100,

            currentBankroll:
              92,

            peakBankroll:
              100,

            riskMode:
              'moderate',
          });

        expect(
          result.decision,
        ).toBe(
          'CAUTION',
        );

        expect(
          result.newRecommendationsAllowed,
        ).toBe(true);

        expect(
          result.recoveryAllowed,
        ).toBe(false);

        expect(
          result.bankrollExposureAllowed,
        ).toBe(true);
      },
    );


    test(
      'stop disables all new exposure including recovery',
      () => {
        const result =
          guard.evaluate({
            initialBankroll:
              100,

            currentBankroll:
              90,

            peakBankroll:
              100,

            riskMode:
              'moderate',
          });

        expect(
          result.decision,
        ).toBe('STOP');

        expect(
          result.newRecommendationsAllowed,
        ).toBe(false);

        expect(
          result.recoveryAllowed,
        ).toBe(false);

        expect(
          result.bankrollExposureAllowed,
        ).toBe(false);
      },
    );


    test(
      'tracks session return independently from peak drawdown',
      () => {
        const result =
          guard.evaluate({
            initialBankroll:
              100,

            currentBankroll:
              108,

            peakBankroll:
              112,

            riskMode:
              'moderate',
          });

        expect(
          result.sessionReturnFraction,
        ).toBe(0.08);

        expect(
          result.drawdownFraction,
        ).toBeCloseTo(
          4 / 112,
          6,
        );

        expect(
          result.decision,
        ).toBe('ALLOW');
      },
    );


    test(
      'rejects peak bankroll below current bankroll',
      () => {
        expect(
          () =>
            guard.evaluate({
              initialBankroll:
                100,

              currentBankroll:
                105,

              peakBankroll:
                100,

              riskMode:
                'moderate',
            }),
        ).toThrow(
          'capital_preservation_peak_below_current_bankroll',
        );
      },
    );


    test(
      'preserves permanent recommendation-only philosophy',
      () => {
        const result =
          guard.evaluate({
            initialBankroll:
              100,

            currentBankroll:
              100,

            peakBankroll:
              100,

            riskMode:
              'moderate',
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
