const {
  PaperProspectivePortfolioRiskController,
} = require(
  '../../../dist/application/runtime/PaperProspectivePortfolioRiskController.js',
);


function createController(
  overrides = {},
) {
  return new PaperProspectivePortfolioRiskController({
    initialBankroll:
      100,

    riskMode:
      'moderate',

    ...overrides,
  });
}


describe(
  'PaperProspectivePortfolioRiskController',
  () => {
    test(
      'derives moderate aggregate ceiling from sovereign risk doctrine',
      () => {
        const snapshot =
          createController()
            .snapshot();

        expect(
          snapshot.exposureLimitFraction,
        ).toBe(
          0.02,
        );

        expect(
          snapshot.maximumAggregateExposure,
        ).toBe(
          2,
        );
      },
    );


    test.each([
      [
        'conservative',
        0.01,
        1,
      ],

      [
        'moderate',
        0.02,
        2,
      ],

      [
        'aggressive',
        0.03,
        3,
      ],
    ])(
      '%s derives canonical portfolio exposure',
      (
        riskMode,
        fraction,
        amount,
      ) => {
        const snapshot =
          createController({
            riskMode,
          })
            .snapshot();

        expect(
          snapshot.exposureLimitFraction,
        ).toBe(
          fraction,
        );

        expect(
          snapshot.maximumAggregateExposure,
        ).toBe(
          amount,
        );
      },
    );


    test(
      'hard aggregate ceiling rounds down rather than up',
      () => {
        const snapshot =
          createController({
            initialBankroll:
              119.80,
          })
            .snapshot();

        expect(
          snapshot.maximumAggregateExposure,
        ).toBe(
          2.39,
        );
      },
    );


    test(
      'aggregates simultaneous strategy exposure',
      () => {
        const controller =
          createController();

        controller.reserve({
          strategyId:
            'triplicacao',

          requestedStake:
            0.8,
        });

        controller.reserve({
          strategyId:
            'fusion-reduced',

          requestedStake:
            0.7,
        });

        expect(
          controller
            .snapshot()
            .aggregateExposure,
        ).toBe(
          1.5,
        );

        expect(
          controller
            .snapshot()
            .availableExposure,
        ).toBe(
          0.5,
        );
      },
    );


    test(
      'blocks aggregate over-allocation across strategies',
      () => {
        const controller =
          createController();

        controller.reserve({
          strategyId:
            'triplicacao',

          requestedStake:
            1,
        });

        controller.reserve({
          strategyId:
            'fusion-reduced',

          requestedStake:
            0.9,
        });

        const result =
          controller.reserve({
            strategyId:
              'heatmap-dynamic',

            requestedStake:
              0.2,
          });

        expect(
          result.decision,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.blocker,
        ).toBe(
          'PORTFOLIO_EXPOSURE_LIMIT_EXCEEDED',
        );

        expect(
          controller
            .snapshot()
            .aggregateExposure,
        ).toBe(
          1.9,
        );
      },
    );


    test(
      'exact aggregate ceiling remains allowed',
      () => {
        const controller =
          createController();

        expect(
          controller.reserve({
            strategyId:
              'triplicacao',

            requestedStake:
              1,
          }).decision,
        ).toBe(
          'APPROVED',
        );

        expect(
          controller.reserve({
            strategyId:
              'fusion-reduced',

            requestedStake:
              1,
          }).decision,
        ).toBe(
          'APPROVED',
        );

        expect(
          controller
            .snapshot()
            .aggregateExposure,
        ).toBe(
          2,
        );
      },
    );


    test(
      'same strategy cannot reserve twice before settlement or release',
      () => {
        const controller =
          createController();

        controller.reserve({
          strategyId:
            'triplicacao',

          requestedStake:
            1,
        });

        const duplicate =
          controller.reserve({
            strategyId:
              'triplicacao',

          requestedStake:
              0.5,
          });

        expect(
          duplicate.decision,
        ).toBe(
          'BLOCKED',
        );

        expect(
          duplicate.blocker,
        ).toBe(
          'STRATEGY_EXPOSURE_ALREADY_PENDING',
        );
      },
    );


    test(
      'settlement updates one canonical bankroll and releases reservation',
      () => {
        const controller =
          createController();

        controller.reserve({
          strategyId:
            'fusion-reduced',

          requestedStake:
            1.5,
        });

        const settlement =
          controller.settle({
            strategyId:
              'fusion-reduced',

            outcome:
              'WIN',

            pnl:
              3.5,
          });

        expect(
          settlement.bankrollBefore,
        ).toBe(
          100,
        );

        expect(
          settlement.bankrollAfter,
        ).toBe(
          103.5,
        );

        expect(
          settlement.aggregateExposureAfter,
        ).toBe(
          0,
        );

        expect(
          controller
            .snapshot()
            .maximumAggregateExposure,
        ).toBe(
          2.07,
        );
      },
    );


    test(
      'settling one strategy preserves another pending reservation',
      () => {
        const controller =
          createController();

        controller.reserve({
          strategyId:
            'triplicacao',

          requestedStake:
            1,
        });

        controller.reserve({
          strategyId:
            'fusion-reduced',

          requestedStake:
            1,
        });

        controller.settle({
          strategyId:
            'triplicacao',

          outcome:
            'LOSS',

          pnl:
            -1,
        });

        const snapshot =
          controller.snapshot();

        expect(
          snapshot.currentBankroll,
        ).toBe(
          99,
        );

        expect(
          snapshot.aggregateExposure,
        ).toBe(
          1,
        );

        expect(
          snapshot.maximumAggregateExposure,
        ).toBe(
          1.98,
        );

        expect(
          snapshot.availableExposure,
        ).toBe(
          0.98,
        );
      },
    );


    test(
      'release removes reservation without bankroll mutation',
      () => {
        const controller =
          createController();

        controller.reserve({
          strategyId:
            'heatmap-dynamic',

          requestedStake:
            1,
        });

        const snapshot =
          controller.release(
            'heatmap-dynamic',
          );

        expect(
          snapshot.currentBankroll,
        ).toBe(
          100,
        );

        expect(
          snapshot.aggregateExposure,
        ).toBe(
          0,
        );
      },
    );


    test(
      'capital stop blocks every new strategy reservation',
      () => {
        const controller =
          createController();

        /*
         * Moderate Stop Win = +20%.
         *
         * Reach it through a canonical reserved settlement.
         */
        controller.reserve({
          strategyId:
            'triplicacao',

          requestedStake:
            2,
        });

        controller.settle({
          strategyId:
            'triplicacao',

          outcome:
            'WIN',

          pnl:
            20,
        });

        const snapshot =
          controller.snapshot();

        expect(
          snapshot.currentBankroll,
        ).toBe(
          120,
        );

        expect(
          snapshot.capital.decision,
        ).toBe(
          'STOP',
        );

        expect(
          snapshot.capital.stopReason,
        ).toBe(
          'STOP_WIN_REACHED',
        );

        const result =
          controller.reserve({
            strategyId:
              'fusion-reduced',

            requestedStake:
              1,
          });

        expect(
          result.decision,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.blocker,
        ).toBe(
          'CAPITAL_PRESERVATION_BLOCKED',
        );
      },
    );


    test(
      'settlement requires pending reservation',
      () => {
        expect(
          () =>
            createController()
              .settle({
                strategyId:
                  'fusion-reduced',

                outcome:
                  'WIN',

                pnl:
                  1,
              }),
        ).toThrow(
          'paper_portfolio_settlement_without_pending_exposure',
        );
      },
    );


    test(
      'VOID requires zero pnl',
      () => {
        const controller =
          createController();

        controller.reserve({
          strategyId:
            'triplicacao',

          requestedStake:
            1,
        });

        expect(
          () =>
            controller.settle({
              strategyId:
                'triplicacao',

              outcome:
                'VOID',

              pnl:
                -1,
            }),
        ).toThrow(
          'paper_portfolio_void_with_non_zero_pnl',
        );
      },
    );


    test(
      'WIN cannot carry negative pnl',
      () => {
        const controller =
          createController();

        controller.reserve({
          strategyId:
            'fusion-reduced',

          requestedStake:
            1,
        });

        expect(
          () =>
            controller.settle({
              strategyId:
                'fusion-reduced',

              outcome:
                'WIN',

              pnl:
                -1,
            }),
        ).toThrow(
          'paper_portfolio_win_with_negative_pnl',
        );
      },
    );


    test(
      'LOSS cannot carry positive pnl',
      () => {
        const controller =
          createController();

        controller.reserve({
          strategyId:
            'heatmap-dynamic',

          requestedStake:
            1,
        });

        expect(
          () =>
            controller.settle({
              strategyId:
                'heatmap-dynamic',

              outcome:
                'LOSS',

              pnl:
                1,
            }),
        ).toThrow(
          'paper_portfolio_loss_with_positive_pnl',
        );
      },
    );


    test(
      'manual recommendation-only invariants remain sovereign',
      () => {
        const controller =
          createController();

        const snapshot =
          controller.snapshot();

        expect(
          snapshot.recommendationOnly,
        ).toBe(
          true,
        );

        expect(
          snapshot.humanExecutionRequired,
        ).toBe(
          true,
        );

        expect(
          snapshot.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );

        expect(
          controller.executeBet,
        ).toBeUndefined();

        expect(
          controller.placeBet,
        ).toBeUndefined();
      },
    );


    test.each([
      0,
      -1,
    ])(
      'rejects invalid bankroll %p',
      (
        initialBankroll,
      ) => {
        expect(
          () =>
            createController({
              initialBankroll,
            }),
        ).toThrow(
          'paper_portfolio_invalid_initial_bankroll',
        );
      },
    );
  },
);


describe(
  'PaperProspectivePortfolioRiskController sovereign authority hardening',
  () => {
    test(
      'external policy arguments cannot override aggregate exposure doctrine',
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

        const controller =
          new PaperProspectivePortfolioRiskController(
            {
              initialBankroll:
                100,

              riskMode:
                'moderate',
            },

            maliciousPolicy,
          );

        const snapshot =
          controller.snapshot();

        expect(
          snapshot.exposureLimitFraction,
        ).toBe(
          0.02,
        );

        expect(
          snapshot.maximumAggregateExposure,
        ).toBe(
          2,
        );
      },
    );


    test(
      'external capital guard arguments cannot bypass Capital Preservation',
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

        const maliciousCapitalGuard = {
          evaluate() {
            return {
              decision:
                'ALLOW',

              newRecommendationsAllowed:
                true,

              bankrollExposureAllowed:
                true,

              stopReason:
                null,
            };
          },
        };

        const controller =
          new PaperProspectivePortfolioRiskController(
            {
              initialBankroll:
                100,

              riskMode:
                'moderate',
            },

            maliciousPolicy,
            maliciousCapitalGuard,
          );

        controller.reserve({
          strategyId:
            'triplicacao',

          requestedStake:
            2,
        });

        controller.settle({
          strategyId:
            'triplicacao',

          outcome:
            'WIN',

          pnl:
            20,
        });

        const snapshot =
          controller.snapshot();

        expect(
          snapshot.capital.decision,
        ).toBe(
          'STOP',
        );

        expect(
          snapshot.capital.stopReason,
        ).toBe(
          'STOP_WIN_REACHED',
        );

        expect(
          controller.reserve({
            strategyId:
              'fusion-reduced',

            requestedStake:
              1,
          }).decision,
        ).toBe(
          'BLOCKED',
        );
      },
    );
  },
);
