const {
  PaperSessionSetupCoordinator,
} = require(
  '../../../dist/application/runtime/PaperSessionSetupCoordinator.js'
);


function configurationInput(
  overrides = {},
) {
  return {
    sessionId:
      'paper-chronology-test',

    bankroll:
      40,

    provider:
      'PRAGMATIC',

    riskMode:
      'AGGRESSIVE',

    allowMartingale:
      true,

    operatorId:
      'Thiago',

    ...overrides,
  };
}


function coordinator() {
  const instance =
    new PaperSessionSetupCoordinator();

  instance.configure(
    configurationInput(),
  );

  return instance;
}


describe(
  'PaperSession canonical history chronology',
  () => {
    test(
      'Sync converts newest-first operator input to oldest-to-newest internal history',
      () => {
        const setup =
          coordinator();

        const result =
          setup.sync(
            '36 17 8 2',
            1000,
          );

        expect(
          result.parsed.rounds,
        ).toEqual([
          36,
          17,
          8,
          2,
        ]);

        /*
         * Parser remains faithful to operator input.
         * Internal synchronized history becomes canonical.
         */
        expect(
          result.history.rounds,
        ).toEqual([
          2,
          8,
          17,
          36,
        ]);

        expect(
          result.history.roundCount,
        ).toBe(
          4,
        );

        expect(
          result.history.syncVersion,
        ).toBe(
          1,
        );
      },
    );


    test(
      'Resync replaces snapshot and preserves canonical chronology',
      () => {
        const setup =
          coordinator();

        setup.sync(
          '9 8 7',
          1000,
        );

        const result =
          setup.resync(
            '12 11 10 9',
            2000,
          );

        expect(
          result.history.rounds,
        ).toEqual([
          9,
          10,
          11,
          12,
        ]);

        expect(
          result.history.roundCount,
        ).toBe(
          4,
        );

        expect(
          result.history.syncVersion,
        ).toBe(
          2,
        );
      },
    );


    test(
      '240 newest-first rounds preserve all rounds internally',
      () => {
        const setup =
          coordinator();

        const external =
          Array.from(
            {
              length:
                240,
            },

            (
              _,
              index,
            ) =>
              (
                index *
                5 +
                1
              ) %
              37,
          );

        const result =
          setup.sync(
            external.join(
              ' ',
            ),
          );

        expect(
          result.parsed.rounds,
        ).toHaveLength(
          240,
        );

        expect(
          result.history.rounds,
        ).toHaveLength(
          240,
        );

        expect(
          result.history.rounds[0],
        ).toBe(
          external[
            external.length -
            1
          ],
        );

        expect(
          result.history.rounds[
            result.history.rounds.length -
            1
          ],
        ).toBe(
          external[0],
        );
      },
    );


    test(
      'canonical latest 200 correspond to real most recent 200 observations',
      () => {
        const setup =
          coordinator();

        const external =
          Array.from(
            {
              length:
                240,
            },

            (
              _,
              index,
            ) =>
              (
                index *
                7 +
                3
              ) %
              37,
          );

        const result =
          setup.sync(
            external.join(
              ' ',
            ),
          );

        const latest200 =
          result.history.rounds.slice(
            -200,
          );

        const expected =
          external
            .slice(
              0,
              200,
            )
            .reverse();

        expect(
          latest200,
        ).toHaveLength(
          200,
        );

        expect(
          latest200,
        ).toEqual(
          expected,
        );
      },
    );


    test(
      'snapshot exposes canonical internal history',
      () => {
        const setup =
          coordinator();

        setup.sync(
          '5 4 3 2 1',
        );

        const snapshot =
          setup.snapshot();

        expect(
          snapshot.history.rounds,
        ).toEqual([
          1,
          2,
          3,
          4,
          5,
        ]);

        expect(
          snapshot.history.roundCount,
        ).toBe(
          5,
        );
      },
    );
  },
);
