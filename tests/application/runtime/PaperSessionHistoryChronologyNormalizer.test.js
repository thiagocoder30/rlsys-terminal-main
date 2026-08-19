const {
  PaperSessionHistoryChronologyNormalizer,
} = require(
  '../../../dist/application/runtime/PaperSessionHistoryChronologyNormalizer.js'
);


describe(
  'PaperSessionHistoryChronologyNormalizer',
  () => {
    const normalizer =
      new PaperSessionHistoryChronologyNormalizer();


    test(
      'converts newest-first input into oldest-to-newest canonical history',
      () => {
        const result =
          normalizer.normalizeNewestFirst([
            36,
            17,
            8,
            2,
          ]);

        expect(
          result.rounds,
        ).toEqual([
          2,
          8,
          17,
          36,
        ]);

        expect(
          result.sourceOrder,
        ).toBe(
          'NEWEST_TO_OLDEST',
        );

        expect(
          result.canonicalOrder,
        ).toBe(
          'OLDEST_TO_NEWEST',
        );
      },
    );


    test(
      'preserves round count exactly',
      () => {
        const input =
          Array.from(
            {
              length:
                240,
            },

            (
              _,
              index,
            ) =>
              index %
              37,
          );

        const result =
          normalizer
            .normalizeNewestFirst(
              input,
            );

        expect(
          result.receivedRounds,
        ).toBe(
          240,
        );

        expect(
          result.rounds,
        ).toHaveLength(
          240,
        );
      },
    );


    test(
      'canonical newest round is original first round',
      () => {
        const result =
          normalizer.normalizeNewestFirst([
            21,
            6,
            28,
            14,
          ]);

        expect(
          result.newestRound,
        ).toBe(
          21,
        );

        expect(
          result.rounds[
            result.rounds.length -
            1
          ],
        ).toBe(
          21,
        );
      },
    );


    test(
      'canonical oldest round is original last round',
      () => {
        const result =
          normalizer.normalizeNewestFirst([
            21,
            6,
            28,
            14,
          ]);

        expect(
          result.oldestRound,
        ).toBe(
          14,
        );

        expect(
          result.rounds[0],
        ).toBe(
          14,
        );
      },
    );


    test(
      'latest window operates on real most recent external rounds',
      () => {
        /*
         * Use only legal roulette values.
         *
         * External order:
         * newest -> oldest
         *
         * The first 200 elements therefore represent the real
         * 200 most recent observations.
         */
        const externalNewestFirst =
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

        const canonical =
          normalizer
            .normalizeNewestFirst(
              externalNewestFirst,
            )
            .rounds;

        const latest200 =
          canonical.slice(
            -200,
          );

        const expectedLatest200 =
          externalNewestFirst
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
          expectedLatest200,
        );

        expect(
          latest200[
            latest200.length -
            1
          ],
        ).toBe(
          externalNewestFirst[0],
        );
      },
    );


    test(
      'new live spin can be appended after canonical newest round',
      () => {
        const canonical =
          normalizer
            .normalizeNewestFirst([
              9,
              8,
              7,
            ])
            .rounds;

        const withLive =
          [
            ...canonical,
            10,
          ];

        expect(
          withLive,
        ).toEqual([
          7,
          8,
          9,
          10,
        ]);
      },
    );


    test(
      'does not mutate input array',
      () => {
        const input =
          [
            9,
            8,
            7,
          ];

        normalizer
          .normalizeNewestFirst(
            input,
          );

        expect(
          input,
        ).toEqual([
          9,
          8,
          7,
        ]);
      },
    );


    test(
      'rejects invalid roulette number',
      () => {
        expect(
          () =>
            normalizer
              .normalizeNewestFirst([
                1,
                37,
                2,
              ]),
        ).toThrow(
          'paper_history_chronology_invalid_round',
        );
      },
    );
  },
);
