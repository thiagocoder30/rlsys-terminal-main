const {
  PaperHistoricalShadowSessionEngine,
} = require(
  '../../../dist/application/runtime/PaperHistoricalShadowSessionEngine.js',
);


function deterministicHistory(
  size = 120,
) {
  const wheel = [
    0, 32, 15, 19, 4, 21, 2, 25, 17,
    34, 6, 27, 13, 36, 11, 30, 8, 23,
    10, 5, 24, 16, 33, 1, 20, 14, 31,
    9, 22, 18, 29, 7, 28, 12, 35, 3,
    26,
  ];

  return Array.from(
    {
      length:
        size,
    },
    (
      _,
      index,
    ) =>
      wheel[
        index %
        wheel.length
      ],
  );
}


function pragmatic(
  overrides = {},
) {
  return {
    history:
      deterministicHistory(),

    initialBankroll:
      150,

    riskMode:
      'moderate',

    provider:
      'PRAGMATIC',

    minimumChipValue:
      0.10,

    martingaleEnabled:
      false,

    ...overrides,
  };
}


describe(
  'PaperHistoricalShadowSessionEngine',
  () => {
    test(
      'runs all three canonical strategies from one synchronized history',
      () => {
        const result =
          new PaperHistoricalShadowSessionEngine()
            .run(
              pragmatic(),
            );

        expect(
          result.totalSpins,
        ).toBe(
          120,
        );

        expect(
          result.triplicacao
            .strategyId,
        ).toBe(
          'triplicacao',
        );

        expect(
          result.fusionReduced
            .strategyId,
        ).toBe(
          'fusion-reduced',
        );

        expect(
          result.heatmapDynamic
            .strategyId,
        ).toBe(
          'heatmap-dynamic',
        );

        expect(
          result.summaries,
        ).toHaveLength(
          3,
        );
      },
    );


    test(
      'each strategy starts with the same independent bankroll',
      () => {
        const result =
          new PaperHistoricalShadowSessionEngine()
            .run(
              pragmatic(),
            );

        for (
          const replay of [
            result.triplicacao,
            result.fusionReduced,
            result.heatmapDynamic,
          ]
        ) {
          expect(
            replay.initialBankroll,
          ).toBe(
            150,
          );
        }
      },
    );


    test(
      'one strategy bankroll never becomes another strategy initial bankroll',
      () => {
        const result =
          new PaperHistoricalShadowSessionEngine()
            .run(
              pragmatic(),
            );

        /*
         * Whatever each strategy did internally, the other
         * strategies always start again from the session's
         * original PAPER bankroll.
         */
        expect(
          result.fusionReduced
            .initialBankroll,
        ).toBe(
          result.initialBankroll,
        );

        expect(
          result.heatmapDynamic
            .initialBankroll,
        ).toBe(
          result.initialBankroll,
        );

        expect(
          result.triplicacao
            .initialBankroll,
        ).toBe(
          result.initialBankroll,
        );
      },
    );


    test(
      'preserves canonical provider chip and risk context',
      () => {
        const result =
          new PaperHistoricalShadowSessionEngine()
            .run(
              pragmatic(),
            );

        expect(
          result.provider,
        ).toBe(
          'PRAGMATIC',
        );

        expect(
          result.minimumChipValue,
        ).toBe(
          0.10,
        );

        expect(
          result.riskMode,
        ).toBe(
          'moderate',
        );

        for (
          const replay of [
            result.triplicacao,
            result.fusionReduced,
            result.heatmapDynamic,
          ]
        ) {
          expect(
            replay.provider,
          ).toBe(
            'PRAGMATIC',
          );

          expect(
            replay.minimumChipValue,
          ).toBe(
            0.10,
          );

          expect(
            replay.riskMode,
          ).toBe(
            'moderate',
          );
        }
      },
    );


    test(
      'supports Evolution physical minimum chip',
      () => {
        const result =
          new PaperHistoricalShadowSessionEngine()
            .run({
              ...pragmatic(),

              provider:
                'EVOLUTION',

              minimumChipValue:
                0.50,
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
          result.fusionReduced
            .minimumChipValue,
        ).toBe(
          0.50,
        );

        expect(
          result.heatmapDynamic
            .minimumChipValue,
        ).toBe(
          0.50,
        );

        expect(
          result.triplicacao
            .minimumChipValue,
        ).toBe(
          0.50,
        );
      },
    );


    test(
      'Triplicacao martingale configuration remains explicit',
      () => {
        const result =
          new PaperHistoricalShadowSessionEngine()
            .run(
              pragmatic({
                martingaleEnabled:
                  true,
              }),
            );

        expect(
          result.martingaleEnabled,
        ).toBe(
          true,
        );
      },
    );


    test(
      'session report is retrospective and cannot authorize execution',
      () => {
        const engine =
          new PaperHistoricalShadowSessionEngine();

        const result =
          engine.run(
            pragmatic(),
          );

        expect(
          result.historicalShadow,
        ).toBe(
          true,
        );

        expect(
          result.retrospectiveOnly,
        ).toBe(
          true,
        );

        expect(
          result.lookAheadAllowed,
        ).toBe(
          false,
        );

        expect(
          result.realBankrollChanged,
        ).toBe(
          false,
        );

        expect(
          result.automaticExecution,
        ).toBe(
          false,
        );

        expect(
          result.humanExecutionRequired,
        ).toBe(
          true,
        );

        expect(
          engine.executeBet,
        ).toBeUndefined();

        expect(
          engine.placeBet,
        ).toBeUndefined();
      },
    );


    test(
      'every underlying replay preserves SHADOW invariants',
      () => {
        const result =
          new PaperHistoricalShadowSessionEngine()
            .run(
              pragmatic(),
            );

        for (
          const replay of [
            result.triplicacao,
            result.fusionReduced,
            result.heatmapDynamic,
          ]
        ) {
          expect(
            replay.historicalShadow,
          ).toBe(
            true,
          );

          expect(
            replay.lookAheadAllowed,
          ).toBe(
            false,
          );

          expect(
            replay.paperOnly,
          ).toBe(
            true,
          );

          expect(
            replay.recommendationOnly,
          ).toBe(
            true,
          );

          expect(
            replay.realBankrollChanged,
          ).toBe(
            false,
          );

          expect(
            replay.automaticExecution,
          ).toBe(
            false,
          );
        }
      },
    );


    test(
      'rejects invalid roulette history before running strategies',
      () => {
        expect(
          () =>
            new PaperHistoricalShadowSessionEngine()
              .run(
                pragmatic({
                  history: [
                    1,
                    2,
                    37,
                  ],
                }),
              ),
        ).toThrow(
          'paper_historical_shadow_invalid_spin',
        );
      },
    );
  },
);
