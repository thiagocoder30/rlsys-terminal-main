const {
  PaperRuntimeSpinInputParser,
} = require(
  '../../../dist/application/runtime/PaperRuntimeSpinInputParser.js'
);


describe(
  'Paper runtime phantom zero regression',
  () => {
    const parser =
      new PaperRuntimeSpinInputParser();


    test(
      '240 sync plus 11 catch-up spins plus ENTER remains 251',
      () => {
        let totalHistory =
          240;

        let catchUpCount =
          0;

        const catchUpInputs =
          [
            '20',
            '1',
            '18',
            '14',
            '24',
            '2',
            '23',
            '23',
            '19',
            '11',
            '26',
            '',
          ];

        for (
          const raw of
          catchUpInputs
        ) {
          const parsed =
            parser.parse(
              raw,
              {
                allowReadyCommand:
                  true,
              },
            );

          if (
            parsed.kind ===
            'SPIN'
          ) {
            totalHistory +=
              1;

            catchUpCount +=
              1;
          }
        }

        expect(
          catchUpCount,
        ).toBe(
          11,
        );

        expect(
          totalHistory,
        ).toBe(
          251,
        );
      },
    );


    test(
      '240 sync plus 11 catch-up spins plus explicit zero becomes 252',
      () => {
        let totalHistory =
          240;

        let catchUpCount =
          0;

        const catchUpInputs =
          [
            '20',
            '1',
            '18',
            '14',
            '24',
            '2',
            '23',
            '23',
            '19',
            '11',
            '26',
            '0',
          ];

        for (
          const raw of
          catchUpInputs
        ) {
          const parsed =
            parser.parse(
              raw,
              {
                allowReadyCommand:
                  true,
              },
            );

          if (
            parsed.kind ===
            'SPIN'
          ) {
            totalHistory +=
              1;

            catchUpCount +=
              1;
          }
        }

        expect(
          catchUpCount,
        ).toBe(
          12,
        );

        expect(
          totalHistory,
        ).toBe(
          252,
        );
      },
    );


    test(
      'ENTER in LIVE does not become first live spin',
      () => {
        const liveSpinCount =
          [];

        const parsed =
          parser.parse(
            '',
          );

        if (
          parsed.kind ===
          'SPIN'
        ) {
          liveSpinCount.push(
            parsed.spin,
          );
        }

        expect(
          liveSpinCount,
        ).toEqual([]);
      },
    );


    test(
      'explicit LIVE zero remains valid prospective observation',
      () => {
        const liveSpins =
          [];

        const parsed =
          parser.parse(
            '0',
          );

        if (
          parsed.kind ===
          'SPIN'
        ) {
          liveSpins.push(
            parsed.spin,
          );
        }

        expect(
          liveSpins,
        ).toEqual([
          0,
        ]);
      },
    );
  },
);
