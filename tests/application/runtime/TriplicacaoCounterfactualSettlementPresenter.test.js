const {
  TriplicacaoCounterfactualSettlementPresenter,
} = require(
  '../../../dist/application/runtime/TriplicacaoCounterfactualSettlementPresenter.js'
);


function scenario(
  overrides = {},
) {
  return {
    policyId:
      'P50_BALANCED',

    policyLabel:
      'Calibração conjunta mediana',

    official:
      false,

    decisionApplicableEvents:
      20,

    eligibleEvents:
      8,

    actionableEvents:
      5,

    notActionableEvents:
      3,

    settledEvents:
      5,

    pendingEvents:
      0,

    dataGapEvents:
      0,

    wins:
      3,

    losses:
      2,

    voids:
      0,

    decisiveEvents:
      5,

    hitRate:
      0.6,

    voidRate:
      0,

    maxLossStreak:
      2,

    records: [
      {
        policyId:
          'P50_BALANCED',

        decisionLiveIndex:
          11,

        settlementLiveIndex:
          12,

        firstNumber:
          1,

        secondNumber:
          3,

        thirdNumber:
          5,

        selectedPatternKind:
          'TC',

        actionStatus:
          'ACTION',

        targetColor:
          'RED',

        actualPatternKind:
          'TC',

        result:
          'WIN',

        counterfactualOnly:
          true,

        recommendationOnly:
          true,

        bankrollMutationAllowed:
          false,

        automaticBetExecutionAllowed:
          false,
      },
    ],

    ...overrides,
  };
}


function report(
  overrides = {},
) {
  return {
    totalLiveEvents:
      31,

    decisionApplicableEvents:
      10,

    scenarios: [
      scenario({
        policyId:
          'OFFICIAL',

        policyLabel:
          'Institucional atual',

        official:
          true,

        eligibleEvents:
          0,

        actionableEvents:
          0,

        notActionableEvents:
          0,

        settledEvents:
          0,

        wins:
          0,

        losses:
          0,

        decisiveEvents:
          0,

        hitRate:
          null,

        voidRate:
          null,

        records:
          [],
      }),

      scenario(),
    ],

    officialPolicyPreserved:
      true,

    counterfactualOnly:
      true,

    recommendationOnly:
      true,

    bankrollMutationAllowed:
      false,

    automaticBetExecutionAllowed:
      false,

    ...overrides,
  };
}


describe(
  'TriplicacaoCounterfactualSettlementPresenter',
  () => {
    const presenter =
      new TriplicacaoCounterfactualSettlementPresenter();


    test(
      'renders eligibility actionability and settlement separately',
      () => {
        const text =
          presenter.present(
            report(),
          );

        expect(
          text,
        ).toContain(
          'SETTLEMENT CONTRAFACTUAL',
        );

        expect(
          text,
        ).toContain(
          'Elegíveis ............. 8',
        );

        expect(
          text,
        ).toContain(
          'Acionáveis ............ 5',
        );

        expect(
          text,
        ).toContain(
          'Não acionáveis ........ 3',
        );

        expect(
          text,
        ).toContain(
          'WIN .................... 3',
        );

        expect(
          text,
        ).toContain(
          'LOSS ................... 2',
        );

        expect(
          text,
        ).toContain(
          'Hit rate ............... 60,0%',
        );
      },
    );


    test(
      'renders chronological decision and settlement indices',
      () => {
        const text =
          presenter.detail(
            report(),
          );

        expect(
          text,
        ).toContain(
          'Decisão LIVE .......... 11',
        );

        expect(
          text,
        ).toContain(
          'Settlement LIVE ....... 12',
        );

        expect(
          text,
        ).toContain(
          'Resultado .............. WIN',
        );
      },
    );


    test(
      'does not claim statistical conclusion from tiny sample',
      () => {
        const text =
          presenter.present(
            report(),
          );

        expect(
          text,
        ).toContain(
          'amostra ainda é exploratória',
        );

        expect(
          text,
        ).toContain(
          'não justifica alteração da política oficial',
        );
      },
    );


    test(
      'preserves counterfactual safety language',
      () => {
        const text =
          presenter.present(
            report(),
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
          'Martingale ............ NÃO SIMULADO',
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
