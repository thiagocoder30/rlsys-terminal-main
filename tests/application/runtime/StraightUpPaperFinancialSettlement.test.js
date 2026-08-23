const {
  StrategyPaperStakePlan,
} = require(
  '../../../dist/application/runtime/StrategyPaperStakePlan.js',
);

const {
  StraightUpPaperFinancialSettlement,
} = require(
  '../../../dist/application/runtime/StraightUpPaperFinancialSettlement.js',
);


const FUSION_TARGET = [
  17, 34, 6,
  27, 13, 36,
  11, 30, 8,
  23,
  10, 5, 24,
  16, 33, 1,
  20, 14, 31,
];


function providerConfiguration(
  provider,
) {
  if (
    provider ===
    'EVOLUTION'
  ) {
    return {
      provider:
        'EVOLUTION',

      minimumChipValue:
        0.50,
    };
  }

  return {
    provider:
      'PRAGMATIC',

    minimumChipValue:
      0.10,
  };
}


function fusionPlan(
  provider,
  maximumTotalStake,
) {
  return new StrategyPaperStakePlan()
    .resolve({
      strategyId:
        'fusion-reduced',

      ...providerConfiguration(
        provider,
      ),

      targetCount:
        19,

      maximumTotalStake,
    });
}


describe(
  'StraightUpPaperFinancialSettlement',
  () => {
    test(
      'Pragmatic minimum Fusion WIN produces BRL +1.70',
      () => {
        const result =
          new StraightUpPaperFinancialSettlement()
            .settle({
              strategyId:
                'fusion-reduced',

              targetNumbers:
                FUSION_TARGET,

              resultNumber:
                23,

              stakePlan:
                fusionPlan(
                  'PRAGMATIC',
                  1.90,
                ),
            });

        expect(
          result.outcome,
        ).toBe(
          'WIN',
        );

        expect(
          result.totalStake,
        ).toBe(
          1.90,
        );

        expect(
          result.grossReturn,
        ).toBe(
          3.60,
        );

        expect(
          result.pnl,
        ).toBe(
          1.70,
        );
      },
    );


    test(
      'Pragmatic minimum Fusion LOSS produces BRL -1.90',
      () => {
        const result =
          new StraightUpPaperFinancialSettlement()
            .settle({
              strategyId:
                'fusion-reduced',

              targetNumbers:
                FUSION_TARGET,

              resultNumber:
                0,

              stakePlan:
                fusionPlan(
                  'PRAGMATIC',
                  1.90,
                ),
            });

        expect(
          result.outcome,
        ).toBe(
          'LOSS',
        );

        expect(
          result.grossReturn,
        ).toBe(
          0,
        );

        expect(
          result.pnl,
        ).toBe(
          -1.90,
        );
      },
    );


    test(
      'Evolution minimum Fusion WIN produces BRL +8.50',
      () => {
        const result =
          new StraightUpPaperFinancialSettlement()
            .settle({
              strategyId:
                'fusion-reduced',

              targetNumbers:
                FUSION_TARGET,

              resultNumber:
                17,

              stakePlan:
                fusionPlan(
                  'EVOLUTION',
                  9.50,
                ),
            });

        expect(
          result.totalStake,
        ).toBe(
          9.50,
        );

        expect(
          result.grossReturn,
        ).toBe(
          18,
        );

        expect(
          result.pnl,
        ).toBe(
          8.50,
        );
      },
    );


    test(
      'Evolution minimum Fusion LOSS produces BRL -9.50',
      () => {
        const result =
          new StraightUpPaperFinancialSettlement()
            .settle({
              strategyId:
                'fusion-reduced',

              targetNumbers:
                FUSION_TARGET,

              resultNumber:
                0,

              stakePlan:
                fusionPlan(
                  'EVOLUTION',
                  9.50,
                ),
            });

        expect(
          result.pnl,
        ).toBe(
          -9.50,
        );
      },
    );


    test(
      'does not accept a financially blocked layout',
      () => {
        const blocked =
          fusionPlan(
            'EVOLUTION',
            5,
          );

        expect(
          blocked.status,
        ).toBe(
          'BLOCKED',
        );

        expect(
          () =>
            new StraightUpPaperFinancialSettlement()
              .settle({
                strategyId:
                  'fusion-reduced',

                targetNumbers:
                  FUSION_TARGET,

                resultNumber:
                  23,

                stakePlan:
                  blocked,
              }),
        ).toThrow(
          'straight_up_financial_stake_plan_not_ready',
        );
      },
    );


    test(
      'settlement preserves physical provider information',
      () => {
        const result =
          new StraightUpPaperFinancialSettlement()
            .settle({
              strategyId:
                'fusion-reduced',

              targetNumbers:
                FUSION_TARGET,

              resultNumber:
                23,

              stakePlan:
                fusionPlan(
                  'EVOLUTION',
                  9.50,
                ),
            });

        expect(
          result.provider,
        ).toBe(
          'EVOLUTION',
        );

        expect(
          result.minimumChipValue,
        ).toBe(
          0.50,
        );

        expect(
          result.stakePerTarget,
        ).toBe(
          0.50,
        );
      },
    );


    test(
      'has no bankroll mutation or execution authority',
      () => {
        const engine =
          new StraightUpPaperFinancialSettlement();

        expect(
          engine.executeBet,
        ).toBeUndefined();

        expect(
          engine.changeBankroll,
        ).toBeUndefined();
      },
    );
  },
);
