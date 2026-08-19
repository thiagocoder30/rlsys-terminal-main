const {
  PaperOperatorDecisionSemantics,
} = require(
  '../../../dist/application/runtime/PaperOperatorDecisionSemantics.js'
);


describe(
  'PaperOperatorDecisionSemantics',
  () => {
    const semantics =
      new PaperOperatorDecisionSemantics();


    test(
      's means FOLLOWED',
      () => {
        expect(
          semantics.parse('s')
            .decision,
        ).toBe('FOLLOWED');
      },
    );


    test(
      'S also means FOLLOWED',
      () => {
        expect(
          semantics.parse('S')
            .decision,
        ).toBe('FOLLOWED');
      },
    );


    test(
      'n means IGNORED',
      () => {
        expect(
          semantics.parse('n')
            .decision,
        ).toBe('IGNORED');
      },
    );


    test(
      'N also means IGNORED',
      () => {
        expect(
          semantics.parse('N')
            .decision,
        ).toBe('IGNORED');
      },
    );


    test(
      'rejects ambiguous operator input',
      () => {
        expect(
          () =>
            semantics.parse(
              'sim',
            ),
        ).toThrow(
          'paper_operator_decision_expected_s_or_n',
        );
      },
    );


    test(
      'decision remains manual only',
      () => {
        const result =
          semantics.parse(
            's',
          );

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
