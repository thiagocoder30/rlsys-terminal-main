const {
  PaperInstitutionalRecoveryController,
} = require(
  '../../../dist/application/runtime/PaperInstitutionalRecoveryController.js'
);


function controller(
  overrides = {},
) {
  return new PaperInstitutionalRecoveryController({
    initialBankroll:
      30,

    riskMode:
      'moderate',

    minimumStake:
      0.10,

    martingaleEnabled:
      true,

    ...overrides,
  });
}


describe(
  'PaperInstitutionalRecoveryController',
  () => {
    test(
      'starts with base stake when no recovery debt exists',
      () => {
        const runtime =
          controller();

        const result =
          runtime.recommend(
            0.19,
          );

        expect(
          result.decision,
        ).toBe(
          'BASE_STAKE',
        );

        expect(
          result.suggestedStake,
        ).toBe(0.60);

        expect(
          result.recoveryComponent,
        ).toBe(0);

        expect(
          result.pendingLossDebt,
        ).toBe(0);
      },
    );


    test(
      'martingale off never increases stake after loss',
      () => {
        const runtime =
          controller({
            martingaleEnabled:
              false,
          });

        const first =
          runtime.recommend(
            0.19,
          );

        runtime.settle({
          operatorDecision:
            'FOLLOWED',

          statisticalResult:
            'LOSS',

          thirdColor:
            'BLACK',

          suggestedStake:
            first.suggestedStake,

          recoveryComponent:
            first.recoveryComponent,
        });

        const next =
          runtime.recommend(
            0.19,
          );

        expect(
          next.decision,
        ).toBe(
          'BASE_STAKE',
        );

        /*
         * Bankroll 29.40, moderate 2% = 0.588.
         * Pragmatic increment 0.10 => 0.50.
         */
        expect(
          next.suggestedStake,
        ).toBe(0.50);

        expect(
          next.recoveryComponent,
        ).toBe(0);

        expect(
          next.pendingLossDebt,
        ).toBe(0.60);
      },
    );


    test(
      'martingale on uses controlled recovery after followed loss',
      () => {
        const runtime =
          controller();

        const first =
          runtime.recommend(
            0.19,
          );

        runtime.settle({
          operatorDecision:
            'FOLLOWED',

          statisticalResult:
            'LOSS',

          thirdColor:
            'BLACK',

          suggestedStake:
            first.suggestedStake,

          recoveryComponent:
            0,
        });

        const next =
          runtime.recommend(
            0.19,
          );

        expect(
          next.decision,
        ).toBe(
          'RECOVERY_STAKE',
        );

        expect(
          next.baseStakeAmount,
        ).toBe(0.50);

        expect(
          next.suggestedStake,
        ).toBe(0.80);

        expect(
          next.recoveryComponent,
        ).toBe(0.30);

        expect(
          next.pendingLossDebt,
        ).toBe(0.60);
      },
    );


    test(
      'recovery win reduces historical debt only by recovery component',
      () => {
        const runtime =
          controller();

        const first =
          runtime.recommend(
            0.19,
          );

        runtime.settle({
          operatorDecision:
            'FOLLOWED',

          statisticalResult:
            'LOSS',

          thirdColor:
            'BLACK',

          suggestedStake:
            first.suggestedStake,

          recoveryComponent:
            0,
        });

        const recovery =
          runtime.recommend(
            0.19,
          );

        const settlement =
          runtime.settle({
            operatorDecision:
              'FOLLOWED',

            statisticalResult:
              'WIN',

            thirdColor:
              'RED',

            suggestedStake:
              recovery.suggestedStake,

            recoveryComponent:
              recovery.recoveryComponent,
          });

        expect(
          settlement.recoveryLedger
            .pendingLossDebt,
        ).toBe(0.30);

        expect(
          settlement.recoveryLedger
            .recoveredAmount,
        ).toBe(0.30);
      },
    );


    test(
      'second followed loss increases recovery debt',
      () => {
        const runtime =
          controller();

        const first =
          runtime.recommend(
            0.19,
          );

        runtime.settle({
          operatorDecision:
            'FOLLOWED',

          statisticalResult:
            'LOSS',

          thirdColor:
            'BLACK',

          suggestedStake:
            first.suggestedStake,

          recoveryComponent:
            0,
        });

        const recovery =
          runtime.recommend(
            0.19,
          );

        const secondLoss =
          runtime.settle({
            operatorDecision:
              'FOLLOWED',

            statisticalResult:
              'LOSS',

            thirdColor:
              'BLACK',

            suggestedStake:
              recovery.suggestedStake,

            recoveryComponent:
              recovery.recoveryComponent,
          });

        expect(
          secondLoss.recoveryLedger
            .pendingLossDebt,
        ).toBe(1.40);

        expect(
          secondLoss.bankrollAfter,
        ).toBe(28.60);
      },
    );


    test(
      'ignored loss never changes bankroll or recovery debt',
      () => {
        const runtime =
          controller();

        const recommendation =
          runtime.recommend(
            0.19,
          );

        const result =
          runtime.settle({
            operatorDecision:
              'IGNORED',

            statisticalResult:
              'LOSS',

            thirdColor:
              'BLACK',

            suggestedStake:
              recommendation.suggestedStake,

            recoveryComponent:
              recommendation.recoveryComponent,
          });

        expect(
          result.financialSettlement,
        ).toBe(
          'NO_EXPOSURE',
        );

        expect(
          result.bankrollDelta,
        ).toBe(0);

        expect(
          result.bankrollAfter,
        ).toBe(30);

        expect(
          result.recoveryLedger
            .pendingLossDebt,
        ).toBe(0);
      },
    );


    test(
      'followed zero is statistical VOID but financial ZERO_LOSS',
      () => {
        const runtime =
          controller();

        const recommendation =
          runtime.recommend(
            0.19,
          );

        const result =
          runtime.settle({
            operatorDecision:
              'FOLLOWED',

            statisticalResult:
              'VOID',

            thirdColor:
              'ZERO',

            suggestedStake:
              recommendation.suggestedStake,

            recoveryComponent:
              recommendation.recoveryComponent,
          });

        expect(
          result.financialSettlement,
        ).toBe(
          'ZERO_LOSS',
        );

        expect(
          result.bankrollDelta,
        ).toBe(-0.60);

        expect(
          result.recoveryLedger
            .pendingLossDebt,
        ).toBe(0.60);
      },
    );


    test(
      'winning operation updates session peak bankroll',
      () => {
        const runtime =
          controller();

        const recommendation =
          runtime.recommend(
            0.19,
          );

        const result =
          runtime.settle({
            operatorDecision:
              'FOLLOWED',

            statisticalResult:
              'WIN',

            thirdColor:
              'RED',

            suggestedStake:
              recommendation.suggestedStake,

            recoveryComponent:
              0,
          });

        expect(
          result.bankrollAfter,
        ).toBe(30.60);

        expect(
          result.peakBankroll,
        ).toBe(30.60);
      },
    );


    test(
      'drawdown is measured from updated session peak',
      () => {
        const runtime =
          controller();

        const win =
          runtime.recommend(
            0.19,
          );

        runtime.settle({
          operatorDecision:
            'FOLLOWED',

          statisticalResult:
            'WIN',

          thirdColor:
            'RED',

          suggestedStake:
            win.suggestedStake,

          recoveryComponent:
            0,
        });

        const second =
          runtime.recommend(
            0.19,
          );

        const loss =
          runtime.settle({
            operatorDecision:
              'FOLLOWED',

          statisticalResult:
              'LOSS',

          thirdColor:
              'BLACK',

          suggestedStake:
              second.suggestedStake,

          recoveryComponent:
              second.recoveryComponent,
        });

        expect(
          loss.peakBankroll,
        ).toBe(30.60);

        expect(
          loss.drawdownFraction,
        ).toBeGreaterThan(0);
      },
    );


    test(
      'capital stop prevents any new recovery or base stake',
      () => {
        const runtime =
          new PaperInstitutionalRecoveryController({
            initialBankroll:
              10,

            riskMode:
              'conservative',

            minimumStake:
              0.10,

            martingaleEnabled:
              true,
          });

        /*
         * Conservative Stop Win = +10%.
         *
         * We generate enough followed wins to cross it.
         */
        for (
          let index = 0;
          index < 10;
          index += 1
        ) {
          const recommendation =
            runtime.recommend(
              0.10,
            );

          if (
            recommendation.decision ===
            'CAPITAL_STOP'
          ) {
            break;
          }

          runtime.settle({
            operatorDecision:
              'FOLLOWED',

            statisticalResult:
              'WIN',

            thirdColor:
              'RED',

            suggestedStake:
              recommendation.suggestedStake,

            recoveryComponent:
              recommendation.recoveryComponent,
          });
        }

        const final =
          runtime.recommend(
            0.10,
          );

        expect(
          final.decision,
        ).toBe(
          'CAPITAL_STOP',
        );

        expect(
          final.suggestedStake,
        ).toBeNull();

        expect(
          final.capital
            .newRecommendationsAllowed,
        ).toBe(false);

        expect(
          final.capital
            .recoveryAllowed,
        ).toBe(false);
      },
    );


    test(
      'capital caution suppresses recovery before full session stop',
      () => {
        /*
         * Use dependency-free public behavior by creating losses
         * until capital enters caution.
         */
        const runtime =
          new PaperInstitutionalRecoveryController({
            initialBankroll:
              100,

            riskMode:
              'moderate',

            minimumStake:
              0.10,

            martingaleEnabled:
              true,
          });

        let recommendation =
          runtime.recommend(
            0.20,
          );

        /*
         * Repeated followed losses.
         * The controller must eventually enter CAUTION before STOP.
         */
        let cautionSeen =
          false;

        for (
          let index = 0;
          index < 10;
          index += 1
        ) {
          if (
            recommendation.capital
              .decision ===
              'CAUTION'
          ) {
            cautionSeen =
              true;

            break;
          }

          if (
            recommendation.decision ===
            'CAPITAL_STOP'
          ) {
            break;
          }

          runtime.settle({
            operatorDecision:
              'FOLLOWED',

            statisticalResult:
              'LOSS',

            thirdColor:
              'BLACK',

            suggestedStake:
              recommendation.suggestedStake,

            recoveryComponent:
              recommendation.recoveryComponent,
          });

          recommendation =
            runtime.recommend(
              0.20,
            );
        }

        if (
          recommendation.capital
            .decision ===
            'CAUTION'
        ) {
          cautionSeen =
            true;

          expect(
            recommendation.decision,
          ).toBe(
            'BASE_STAKE',
          );

          expect(
            recommendation.recoveryComponent,
          ).toBe(0);
        }

        expect(
          cautionSeen,
        ).toBe(true);
      },
    );


    test(
      'small bankroll can block safe stake before recovery',
      () => {
        const runtime =
          controller({
            initialBankroll:
              8,

            riskMode:
              'conservative',

            minimumStake:
              0.50,
          });

        const result =
          runtime.recommend(
            0.20,
          );

        expect(
          result.decision,
        ).toBe(
          'STAKE_BLOCKED',
        );

        expect(
          result.suggestedStake,
        ).toBeNull();
      },
    );


    test(
      'snapshot exposes bankroll peak debt and capital status',
      () => {
        const runtime =
          controller();

        const snapshot =
          runtime.snapshot();

        expect(
          snapshot.initialBankroll,
        ).toBe(30);

        expect(
          snapshot.currentBankroll,
        ).toBe(30);

        expect(
          snapshot.peakBankroll,
        ).toBe(30);

        expect(
          snapshot.recoveryLedger
            .pendingLossDebt,
        ).toBe(0);

        expect(
          snapshot.capital.decision,
        ).toBe('ALLOW');
      },
    );


    test(
      'controller has no automatic execution API',
      () => {
        const runtime =
          controller();

        expect(
          runtime.snapshot()
            .recommendationOnly,
        ).toBe(true);

        expect(
          runtime.snapshot()
            .humanExecutionRequired,
        ).toBe(true);

        expect(
          runtime.snapshot()
            .automaticBetExecutionAllowed,
        ).toBe(false);

        expect(
          typeof runtime.execute,
        ).toBe('undefined');

        expect(
          typeof runtime.placeBet,
        ).toBe('undefined');

        expect(
          typeof runtime.autoBet,
        ).toBe('undefined');
      },
    );
  },
);


describe(
  'PaperInstitutionalRecoveryController external capital contract',
  () => {
    test(
      'external bankroll governs base stake calculation without mutating internal bankroll',
      () => {
        const runtime =
          controller();

        const recommendation =
          runtime.recommend(
            0.19,
            {
              currentBankroll:
                29,

              peakBankroll:
                30,
            },
          );

        expect(
          recommendation.suggestedStake,
        ).toBe(
          0.50,
        );

        expect(
          runtime.snapshot()
            .currentBankroll,
        ).toBe(
          30,
        );
      },
    );


    test(
      'external peak and bankroll govern Capital Preservation evaluation',
      () => {
        const runtime =
          controller();

        const recommendation =
          runtime.recommend(
            0.19,
            {
              currentBankroll:
                27,

              peakBankroll:
                30,
            },
          );

        expect(
          recommendation.capital
            .currentBankroll,
        ).toBe(
          27,
        );

        expect(
          recommendation.capital
            .peakBankroll,
        ).toBe(
          30,
        );
      },
    );


    test(
      'invalid external capital state is rejected',
      () => {
        const runtime =
          controller();

        expect(
          () =>
            runtime.recommend(
              0.19,
              {
                currentBankroll:
                  31,

                peakBankroll:
                  30,
              },
            ),
        ).toThrow(
          'institutional_recovery_invalid_external_peak_bankroll',
        );
      },
    );
  },
);


describe(
  'PaperInstitutionalRecoveryController external settlement contract',
  () => {
    test(
      'recommendation exposes the same external bankroll used for stake calculation',
      () => {
        const runtime =
          controller();

        const recommendation =
          runtime.recommend(
            0.19,
            {
              currentBankroll:
                29,

              peakBankroll:
                30,
            },
          );

        expect(
          recommendation.currentBankroll,
        ).toBe(
          29,
        );

        expect(
          recommendation.peakBankroll,
        ).toBe(
          30,
        );

        expect(
          recommendation.suggestedStake,
        ).toBe(
          0.50,
        );

        expect(
          runtime.snapshot()
            .currentBankroll,
        ).toBe(
          30,
        );
      },
    );


    test(
      'external followed loss returns projected bankroll without mutating internal bankroll',
      () => {
        const runtime =
          controller();

        const recommendation =
          runtime.recommend(
            0.19,
            {
              currentBankroll:
                29,

              peakBankroll:
                30,
            },
          );

        const settlement =
          runtime.settle(
            {
              operatorDecision:
                'FOLLOWED',

              statisticalResult:
                'LOSS',

              thirdColor:
                'BLACK',

              suggestedStake:
                recommendation.suggestedStake,

              recoveryComponent:
                recommendation.recoveryComponent,
            },
            {
              currentBankroll:
                29,

              peakBankroll:
                30,
            },
          );

        expect(
          settlement.financialSettlement,
        ).toBe(
          'LOSS',
        );

        expect(
          settlement.bankrollBefore,
        ).toBe(
          29,
        );

        expect(
          settlement.bankrollDelta,
        ).toBe(
          -0.50,
        );

        expect(
          settlement.bankrollAfter,
        ).toBe(
          28.50,
        );

        expect(
          settlement.peakBankroll,
        ).toBe(
          30,
        );

        expect(
          settlement.recoveryLedger
            .pendingLossDebt,
        ).toBe(
          0.50,
        );

        expect(
          runtime.snapshot()
            .currentBankroll,
        ).toBe(
          30,
        );
      },
    );


    test(
      'external followed win projects new peak without mutating internal bankroll',
      () => {
        const runtime =
          controller();

        const settlement =
          runtime.settle(
            {
              operatorDecision:
                'FOLLOWED',

              statisticalResult:
                'WIN',

              thirdColor:
                'RED',

              suggestedStake:
                0.60,

              recoveryComponent:
                0,
            },
            {
              currentBankroll:
                30,

              peakBankroll:
                30,
            },
          );

        expect(
          settlement.bankrollAfter,
        ).toBe(
          30.60,
        );

        expect(
          settlement.peakBankroll,
        ).toBe(
          30.60,
        );

        expect(
          runtime.snapshot()
            .currentBankroll,
        ).toBe(
          30,
        );

        expect(
          runtime.snapshot()
            .peakBankroll,
        ).toBe(
          30,
        );
      },
    );


    test(
      'external ignored settlement preserves external bankroll and creates no recovery debt',
      () => {
        const runtime =
          controller();

        const settlement =
          runtime.settle(
            {
              operatorDecision:
                'IGNORED',

              statisticalResult:
                'LOSS',

              thirdColor:
                'BLACK',

              suggestedStake:
                0.50,

              recoveryComponent:
                0,
            },
            {
              currentBankroll:
                29,

              peakBankroll:
                30,
            },
          );

        expect(
          settlement.financialSettlement,
        ).toBe(
          'NO_EXPOSURE',
        );

        expect(
          settlement.bankrollBefore,
        ).toBe(
          29,
        );

        expect(
          settlement.bankrollAfter,
        ).toBe(
          29,
        );

        expect(
          settlement.bankrollDelta,
        ).toBe(
          0,
        );

        expect(
          settlement.recoveryLedger
            .pendingLossDebt,
        ).toBe(
          0,
        );

        expect(
          runtime.snapshot()
            .currentBankroll,
        ).toBe(
          30,
        );
      },
    );
  },
);
