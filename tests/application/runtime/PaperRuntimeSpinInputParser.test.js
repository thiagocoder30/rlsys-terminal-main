const {
  PaperRuntimeSpinInputParser,
} = require(
  '../../../dist/application/runtime/PaperRuntimeSpinInputParser.js'
);


describe(
  'PaperRuntimeSpinInputParser',
  () => {
    const parser =
      new PaperRuntimeSpinInputParser();


    test(
      'empty input is never converted to roulette zero',
      () => {
        const result =
          parser.parse(
            '',
          );

        expect(
          result,
        ).toEqual({
          kind:
            'EMPTY',
        });

        expect(
          result.spin,
        ).toBeUndefined();
      },
    );


    test(
      'whitespace-only input is empty and not roulette zero',
      () => {
        const result =
          parser.parse(
            '     ',
          );

        expect(
          result.kind,
        ).toBe(
          'EMPTY',
        );

        expect(
          result.spin,
        ).toBeUndefined();
      },
    );


    test(
      'explicit zero remains a legitimate roulette spin',
      () => {
        const result =
          parser.parse(
            '0',
          );

        expect(
          result,
        ).toEqual({
          kind:
            'SPIN',

          spin:
            0,
        });
      },
    );


    test(
      'zero surrounded by spaces remains legitimate',
      () => {
        const result =
          parser.parse(
            '  0  ',
          );

        expect(
          result,
        ).toEqual({
          kind:
            'SPIN',

          spin:
            0,
        });
      },
    );


    test(
      'accepts roulette numbers one through thirty six',
      () => {
        for (
          let spin = 1;
          spin <= 36;
          spin += 1
        ) {
          expect(
            parser.parse(
              String(
                spin,
              ),
            ),
          ).toEqual({
            kind:
              'SPIN',

            spin,
          });
        }
      },
    );


    test(
      'rejects roulette number thirty seven',
      () => {
        expect(
          parser.parse(
            '37',
          ).kind,
        ).toBe(
          'INVALID',
        );
      },
    );


    test(
      'rejects negative roulette number',
      () => {
        expect(
          parser.parse(
            '-1',
          ).kind,
        ).toBe(
          'INVALID',
        );
      },
    );


    test(
      'rejects alphabetic input',
      () => {
        expect(
          parser.parse(
            'abc',
          ).kind,
        ).toBe(
          'INVALID',
        );
      },
    );


    test(
      'rejects partially numeric input',
      () => {
        expect(
          parser.parse(
            '12abc',
          ).kind,
        ).toBe(
          'INVALID',
        );
      },
    );


    test(
      'rejects decimal input',
      () => {
        expect(
          parser.parse(
            '12.5',
          ).kind,
        ).toBe(
          'INVALID',
        );
      },
    );


    test(
      'recognizes pronto only when catch-up command is enabled',
      () => {
        expect(
          parser.parse(
            'pronto',
            {
              allowReadyCommand:
                true,
            },
          ),
        ).toEqual({
          kind:
            'COMMAND',

          command:
            'READY',
        });

        expect(
          parser.parse(
            'PRONTO',
            {
              allowReadyCommand:
                true,
            },
          ),
        ).toEqual({
          kind:
            'COMMAND',

          command:
            'READY',
        });
      },
    );


    test(
      'pronto is invalid in ordinary LIVE spin mode',
      () => {
        expect(
          parser.parse(
            'pronto',
          ).kind,
        ).toBe(
          'INVALID',
        );
      },
    );


    test(
      'empty catch-up input cannot become synthetic zero',
      () => {
        const history =
          [
            20,
            1,
            18,
          ];

        const parsed =
          parser.parse(
            '',
            {
              allowReadyCommand:
                true,
            },
          );

        if (
          parsed.kind ===
          'SPIN'
        ) {
          history.push(
            parsed.spin,
          );
        }

        expect(
          history,
        ).toEqual([
          20,
          1,
          18,
        ]);

        expect(
          history,
        ).not.toEqual([
          20,
          1,
          18,
          0,
        ]);
      },
    );


    test(
      'explicit catch-up zero is preserved as real zero',
      () => {
        const history =
          [
            20,
            1,
            18,
          ];

        const parsed =
          parser.parse(
            '0',
            {
              allowReadyCommand:
                true,
            },
          );

        if (
          parsed.kind ===
          'SPIN'
        ) {
          history.push(
            parsed.spin,
          );
        }

        expect(
          history,
        ).toEqual([
          20,
          1,
          18,
          0,
        ]);
      },
    );
  },
);
