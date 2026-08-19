const {
  TriplicacaoCounterfactualCalibrationMatrix,
} = require(
  '../../../dist/application/runtime/TriplicacaoCounterfactualCalibrationMatrix.js'
);

const {
  TriplicacaoCounterfactualCalibrationPresenter,
} = require(
  '../../../dist/application/runtime/TriplicacaoCounterfactualCalibrationPresenter.js'
);


function event(
  overrides = {},
) {
  return {
    liveSpinIndex:
      1,

    spin:
      20,

    sessionEvent:
      'NO_RECOMMENDATION',

    formationState:
      'WAITING_THIRD',

    firstNumber:
      11,

    secondNumber:
      20,

    trioCompleted:
      false,

    trioDiscarded:
      false,

    trioNumbers:
      null,

    actualPatternKind:
      null,

    actionStatus:
      'NO_ACTION',

    selectedPatternKind:
      'NTC',

    probabilityMode:
      'OBSERVE',

    advancedEvidenceScore:
      41,

    advancedConfidenceScore:
      0.376,

    advancedRiskScore:
      0.522,

    baseOperationalMode:
      'OBSERVE',

    baseDominantPattern:
      'NTC',

    baseDominantFrequencyScore:
      31,

    baseConfidenceScore:
      0.353,

    baseRiskScore:
      0.584,

    gateSummary: {
      total:
        8,

      passed:
        1,

      failed:
        7,

      allPassed:
        false,

      evaluations:
        [],
    },

    rationale:
      null,

    reasons:
      [],

    warnings:
      [],

    blockers:
      [],

    recommendationIssued:
      false,

    ...overrides,
  };
}


describe(
  'TriplicacaoCounterfactualCalibrationPresenter',
  () => {
    const matrix =
      new TriplicacaoCounterfactualCalibrationMatrix();

    const presenter =
      new TriplicacaoCounterfactualCalibrationPresenter();


    test(
      'renders official and dominance-only scenarios',
      () => {
        const report =
          matrix.analyze({
            events: [
              event(),
            ],
          });

        const text =
          presenter.present(
            report,
          );

        expect(
          text,
        ).toContain(
          'CALIBRAÇÃO CONTRAFACTUAL',
        );

        expect(
          text,
        ).toContain(
          'OFFICIAL [OFICIAL]',
        );

        expect(
          text,
        ).toContain(
          'D50_ONLY',
        );

        expect(
          text,
        ).toContain(
          'D45_ONLY',
        );

        expect(
          text,
        ).toContain(
          'D42_ONLY',
        );
      },
    );


    test(
      'renders observed metric distributions',
      () => {
        const report =
          matrix.analyze({
            events: [
              event({
                baseDominantFrequencyScore:
                  31,
              }),

              event({
                liveSpinIndex:
                  2,

                baseDominantFrequencyScore:
                  35,
              }),
            ],
          });

        const text =
          presenter.present(
            report,
          );

        expect(
          text,
        ).toContain(
          'DISTRIBUIÇÃO DAS MÉTRICAS',
        );

        expect(
          text,
        ).toContain(
          'Dominância base',
        );

        expect(
          text,
        ).toContain(
          'Confiança avançada',
        );

        expect(
          text,
        ).toContain(
          'Risco avançado',
        );
      },
    );


    test(
      'explicitly explains when lowering dominance alone changes nothing',
      () => {
        const report =
          matrix.analyze({
            events: [
              event(),
            ],
          });

        const text =
          presenter.present(
            report,
          );

        expect(
          text,
        ).toContain(
          'redução isolada da dominância até 42%',
        );

        expect(
          text,
        ).toContain(
          'Outros gates continuam impedindo PAPER_ONLY',
        );
      },
    );


    test(
      'presenter preserves counterfactual safety language',
      () => {
        const text =
          presenter.present(
            matrix.analyze({
              events:
                [],
            }),
          );

        expect(
          text,
        ).toContain(
          'Política oficial ...... PRESERVADA',
        );

        expect(
          text,
        ).toContain(
          'Banca ................. NÃO ALTERADA',
        );

        expect(
          text,
        ).toContain(
          'Execução automática ... NÃO',
        );
      },
    );
  },
);
