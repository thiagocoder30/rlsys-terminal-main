const {
  PaperSessionSetupCoordinator,
} = require(
  '../../../dist/application/runtime/PaperSessionSetupCoordinator.js'
);


function configuredCoordinator() {
  const setup =
    new PaperSessionSetupCoordinator();

  setup.configure({
    sessionId:
      'paper-latest-window-regression',

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
  });

  return setup;
}


describe(
  'PaperSession latest warmup window regression',
  () => {
    test(
      '240 newest-first external rounds produce latest 200 real rounds at canonical tail',
      () => {
        const setup =
          configuredCoordinator();

        /*
         * External/operator contract:
         *
         * NEWEST -> OLDEST
         *
         * The first 200 values are therefore the real
         * 200 most recent observations.
         *
         * We deliberately make the two temporal regions
         * unmistakable:
         *
         * newest 200 = 1
         * oldest 40  = 36
         */
        const externalNewestFirst =
          [
            ...Array(
              200,
            ).fill(
              1,
            ),

            ...Array(
              40,
            ).fill(
              36,
            ),
          ];

        const result =
          setup.sync(
            externalNewestFirst.join(
              ' ',
            ),
          );

        expect(
          result.parsed.rounds,
        ).toEqual(
          externalNewestFirst,
        );

        expect(
          result.history.rounds,
        ).toHaveLength(
          240,
        );

        /*
         * Canonical internal order:
         *
         * OLDEST -> NEWEST
         *
         * Therefore the oldest 40 values must be
         * at the beginning.
         */
        expect(
          result.history.rounds
            .slice(
              0,
              40,
            )
            .every(
              (
                value,
              ) =>
                value ===
                36,
            ),
        ).toBe(
          true,
        );

        /*
         * And slice(-200) must represent exactly
         * the real 200 most recent observations.
         */
        const latest200 =
          result.history.rounds.slice(
            -200,
          );

        expect(
          latest200,
        ).toHaveLength(
          200,
        );

        expect(
          latest200.every(
            (
              value,
            ) =>
              value ===
              1,
          ),
        ).toBe(
          true,
        );

        expect(
          latest200,
        ).not.toContain(
          36,
        );
      },
    );


    test(
      'canonical newest round remains original first external round',
      () => {
        const setup =
          configuredCoordinator();

        const externalNewestFirst =
          [
            17,
            8,
            22,
            4,
            31,
          ];

        const result =
          setup.sync(
            externalNewestFirst.join(
              ' ',
            ),
          );

        expect(
          result.history.rounds,
        ).toEqual([
          31,
          4,
          22,
          8,
          17,
        ]);

        expect(
          result.history.rounds[
            result.history.rounds.length -
            1
          ],
        ).toBe(
          17,
        );
      },
    );


    test(
      'appending next live round continues canonical chronology',
      () => {
        const setup =
          configuredCoordinator();

        const result =
          setup.sync(
            '17 8 22 4',
          );

        const nextLiveRound =
          30;

        const chronological =
          [
            ...result.history.rounds,
            nextLiveRound,
          ];

        expect(
          chronological,
        ).toEqual([
          4,
          22,
          8,
          17,
          30,
        ]);

        expect(
          chronological[
            chronological.length -
            1
          ],
        ).toBe(
          30,
        );
      },
    );
  },
);
