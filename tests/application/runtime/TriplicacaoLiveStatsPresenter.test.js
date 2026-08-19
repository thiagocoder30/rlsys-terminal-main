const {
  TriplicacaoLiveStatsPresenter,
} = require(
  '../../../dist/application/runtime/TriplicacaoLiveStatsPresenter.js'
);


function baseStats() {
  return {
    total:
      4,

    tc:
      1,

    ntc:
      1,

    ta:
      1,

    nta:
      1,

    zeroDiscarded:
      0,

    dominantPattern:
      'TC',

    dominantFrequencyScore:
      25,

    confidenceScore:
      0.70,

    riskScore:
      0.30,

    operationalMode:
      'OBSERVE',

    trios:
      [],
  };
}


function gateSummary() {
  return {
    total:
      8,

    passed:
      1,

    failed:
      7,

    allPassed:
      false,

    evaluations: [
      {
        id:
          'BASE_DOMINANCE',

        label:
          'Dominância base',

        comparator:
          'MINIMUM',

        observed:
          35,

        threshold:
          58,

        passed:
          false,

        margin:
          -23,
      },

      {
        id:
          'BASE_CONFIDENCE',

        label:
          'Confiança base',

        comparator:
          'MINIMUM',

        observed:
          0.166,

        threshold:
          0.70,

        passed:
          false,

        margin:
          -0.534,
      },

      {
        id:
          'BASE_RISK',

        label:
          'Risco base',

        comparator:
          'MAXIMUM',

        observed:
          0.798,

        threshold:
          0.33,

        passed:
          false,

        margin:
          -0.468,
      },

      {
        id:
          'BASE_PAPER_ONLY',

        label:
          'Base em PAPER_ONLY',

        comparator:
          'REQUIRED',

        observed:
          false,

        threshold:
          true,

        passed:
          false,

        margin:
          -1,
      },

      {
        id:
          'ADVANCED_PATTERN_SELECTED',

        label:
          'Padrão avançado selecionado',

        comparator:
          'REQUIRED',

        observed:
          true,

        threshold:
          true,

        passed:
          true,

        margin:
          1,
      },

      {
        id:
          'ADVANCED_EVIDENCE',

        label:
          'Evidência avançada',

        comparator:
          'MINIMUM',

        observed:
          31,

        threshold:
          68,

        passed:
          false,

        margin:
          -37,
      },

      {
        id:
          'ADVANCED_CONFIDENCE',

        label:
          'Confiança avançada',

        comparator:
          'MINIMUM',

        observed:
          0.241,

        threshold:
          0.72,

        passed:
          false,

        margin:
          -0.479,
      },

      {
        id:
          'ADVANCED_RISK',

        label:
          'Risco avançado',

        comparator:
          'MAXIMUM',

        observed:
          0.646,

        threshold:
          0.34,

        passed:
          false,

        margin:
          -0.306,
      },
    ],
  };
}


function event(
  overrides,
) {
  return {
    liveSpinIndex:
      1,

    spin:
      1,

    sessionEvent:
      'NO_RECOMMENDATION',

    formationState:
      'WAITING_SECOND',

    firstNumber:
      1,

    secondNumber:
      null,

    trioCompleted:
      false,

    trioDiscarded:
      false,

    trioNumbers:
      null,

    actualPatternKind:
      null,

    actionStatus:
      null,

    selectedPatternKind:
      'TC',

    probabilityMode:
      'OBSERVE',

    advancedEvidenceScore:
      31,

    advancedConfidenceScore:
      0.241,

    advancedRiskScore:
      0.646,

    baseOperationalMode:
      'OBSERVE',

    baseDominantPattern:
      'TA',

    baseDominantFrequencyScore:
      35,

    baseConfidenceScore:
      0.166,

    baseRiskScore:
      0.798,

    gateSummary:
      gateSummary(),

    rationale:
      null,

    reasons:
      [],

    warnings:
      [],

    blockers: [
      'TRIPLICACAO_ADVANCED_EVIDENCIA_INSUFICIENTE',
    ],

    recommendationIssued:
      false,

    ...overrides,
  };
}


function report() {
  const stats =
    baseStats();

  return {
    synchronizedHistorySize:
      341,

    catchUpSpinCount:
      16,

    liveSpinCount:
      33,

    totalHistorySize:
      390,

    synchronized:
      stats,

    context:
      stats,

    live:
      stats,

    liveCompletedTrios:
      11,

    liveDiscardedTrios:
      0,

    recommendationCount:
      0,

    probabilityModes: {
      insufficientData:
        0,

      observe:
        33,

      paperOnly:
        0,
    },

    actionStatuses: {
      action:
        0,

      noAction:
        22,

      zeroBlocked:
        0,

      none:
        11,
    },

    latestEvents: [
      event({
        liveSpinIndex:
          29,

        spin:
          29,

        formationState:
          'WAITING_THIRD',

        firstNumber:
          8,

        secondNumber:
          29,

        actionStatus:
          'NO_ACTION',
      }),

      event({
        liveSpinIndex:
          30,

        spin:
          22,

        formationState:
          'WAITING_FIRST',

        firstNumber:
          8,

        secondNumber:
          29,

        trioCompleted:
          true,

        trioNumbers: [
          8,
          29,
          22,
        ],

        actualPatternKind:
          'TC',

        actionStatus:
          'NO_ACTION',
      }),

      event({
        liveSpinIndex:
          31,

        spin:
          4,

        formationState:
          'WAITING_SECOND',

        firstNumber:
          4,

        secondNumber:
          null,

        actionStatus:
          null,
      }),

      event({
        liveSpinIndex:
          32,

        spin:
          31,

        formationState:
          'WAITING_THIRD',

        firstNumber:
          4,

        secondNumber:
          31,

        actionStatus:
          'NO_ACTION',
      }),

      event({
        liveSpinIndex:
          33,

        spin:
          11,

        formationState:
          'WAITING_FIRST',

        firstNumber:
          4,

        secondNumber:
          31,

        trioCompleted:
          true,

        trioNumbers: [
          4,
          31,
          11,
        ],

        actualPatternKind:
          'TC',

        actionStatus:
          'NO_ACTION',
      }),
    ],

    paperOnly:
      true,

    recommendationOnly:
      true,

    humanExecutionRequired:
      true,

    automaticBetExecutionAllowed:
      false,
  };
}


describe(
  'TriplicacaoLiveStatsPresenter',
  () => {
    const presenter =
      new TriplicacaoLiveStatsPresenter();


    test(
      'compact view exposes Sync and LIVE pattern statistics',
      () => {
        const text =
          presenter.compact(
            report(),
          );

        expect(
          text,
        ).toContain(
          'ESTATÍSTICAS TRIPLICAÇÃO',
        );

        expect(
          text,
        ).toContain(
          'TRIOS — LIVE PROSPECTIVO',
        );
      },
    );


    test(
      'detail preserves continuous LIVE chronology',
      () => {
        const text =
          presenter.detail(
            report(),
          );

        for (
          let live = 29;
          live <= 33;
          live += 1
        ) {
          expect(
            text,
          ).toContain(
            `LIVE ${live}`,
          );
        }
      },
    );


    test(
      'detail exposes base gate PASS FAIL decisions',
      () => {
        const text =
          presenter.detail(
            report(),
          );

        expect(
          text,
        ).toContain(
          'GATES — BASE',
        );

        expect(
          text,
        ).toContain(
          'FAIL | Dominância base',
        );

        expect(
          text,
        ).toContain(
          'mínimo=58,0%',
        );

        expect(
          text,
        ).toContain(
          'FAIL | Confiança base',
        );

        expect(
          text,
        ).toContain(
          'máximo=33,0%',
        );
      },
    );


    test(
      'detail exposes advanced gate PASS FAIL decisions',
      () => {
        const text =
          presenter.detail(
            report(),
          );

        expect(
          text,
        ).toContain(
          'GATES — AVANÇADO',
        );

        expect(
          text,
        ).toContain(
          'PASS | Padrão avançado selecionado',
        );

        expect(
          text,
        ).toContain(
          'FAIL | Evidência avançada',
        );

        expect(
          text,
        ).toContain(
          'mínimo=68,0%',
        );

        expect(
          text,
        ).toContain(
          'FAIL | Confiança avançada',
        );

        expect(
          text,
        ).toContain(
          'máximo=34,0%',
        );
      },
    );


    test(
      'detail exposes failure margins',
      () => {
        const text =
          presenter.detail(
            report(),
          );

        expect(
          text,
        ).toContain(
          'margem=-23,0 p.p.',
        );

        expect(
          text,
        ).toContain(
          'margem=-37,0 p.p.',
        );
      },
    );


    test(
      'detail distinguishes non applicable action',
      () => {
        const text =
          presenter.detail(
            report(),
          );

        expect(
          text,
        ).toContain(
          'LIVE 31',
        );

        expect(
          text,
        ).toContain(
          'Action status ......... NÃO APLICÁVEL',
        );
      },
    );


    test(
      'presenter remains diagnostic only',
      () => {
        const text =
          presenter.compact(
            report(),
          );

        expect(
          text,
        ).toContain(
          'Nenhuma entrada é executada pelo sistema.',
        );
      },
    );
  },
);
