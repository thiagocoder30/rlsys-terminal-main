const {
  HeatmapDynamicLiveStatsPresenter,
} = require(
  '../../../dist/application/runtime/HeatmapDynamicLiveStatsPresenter.js',
);


function snapshot() {
  return {
    strategyId:
      'heatmap-dynamic',

    liveSpinCount:
      20,

    blockedCount:
      3,

    observeCount:
      12,

    paperReadyCount:
      5,

    blockedPercent:
      15,

    observePercent:
      60,

    paperReadyPercent:
      25,

    averageFusionPressureScore:
      56.4,

    averageRecencyPressureScore:
      51.2,

    averageDispersionScore:
      38.7,

    averageConfidenceScore:
      0.624,

    averageRiskScore:
      0.341,

    averageTargetSize:
      4.5,

    averageCoveragePercent:
      12.15,

    predominantTargetRegion:
      'HOT_NUMBER_32',

    targetRegionFrequency: [
      {
        regionId:
          'HOT_NUMBER_32',

        count:
          4,

        percent:
          40,
      },

      {
        regionId:
          'TIERS',

        count:
          3,

        percent:
          30,
      },
    ],

    blockerFrequency: [
      {
        blocker:
          'HEATMAP_DYNAMIC_PRESSURE_LOW',

        count:
          2,
      },
    ],

    counterfactualDecisionCount:
      5,

    counterfactualSettledCount:
      4,

    counterfactualPendingCount:
      1,

    counterfactualWinCount:
      2,

    counterfactualLossCount:
      2,

    counterfactualHitRate:
      50,

    counterfactualMaxLossStreak:
      2,

    latestEvents: [
      {
        liveSpinIndex:
          19,

        spin:
          17,

        decisionStatus:
          'PAPER_READY',

        analyticalMode:
          'FUSION_READY',

        signalStrength:
          'STRONG',

        fusionPressureScore:
          68,

        recencyPressureScore:
          60,

        dispersionScore:
          31,

        confidenceScore:
          0.73,

        riskScore:
          0.27,

        targetRegionId:
          'HOT_NUMBER_32',

        targetNumbers: [
          32,
        ],

        targetSize:
          1,

        coveragePercent:
          2.7,

        registeredDecisionIndex:
          5,

        settledDecisionIndex:
          null,

        settlementOutcome:
          null,

        settledBySpin:
          null,

        blockers:
          [],

        warnings:
          [],
      },

      {
        liveSpinIndex:
          20,

        spin:
          32,

        decisionStatus:
          'OBSERVE',

        analyticalMode:
          'OBSERVE',

        signalStrength:
          'WEAK',

        fusionPressureScore:
          51,

        recencyPressureScore:
          46,

        dispersionScore:
          43,

        confidenceScore:
          0.58,

        riskScore:
          0.42,

        targetRegionId:
          'TIERS',

        targetNumbers: [
          27,
          13,
          36,
        ],

        targetSize:
          3,

        coveragePercent:
          8.1,

        registeredDecisionIndex:
          null,

        settledDecisionIndex:
          4,

        settlementOutcome:
          'WIN',

        settledBySpin:
          32,

        blockers:
          [],

        warnings:
          [],
      },
    ],

    paperOnly:
      true,

    recommendationOnly:
      true,

    bankrollChanged:
      false,

    automaticExecution:
      false,
  };
}


describe(
  'HeatmapDynamicLiveStatsPresenter',
  () => {
    const presenter =
      new HeatmapDynamicLiveStatsPresenter();


    test(
      'uses canonical Heatmap Dynamic identity',
      () => {
        const text =
          presenter.compact(
            snapshot(),
          );

        expect(text).toContain(
          'RL.SYS — HEATMAP DYNAMIC / ESTATÍSTICAS',
        );

        expect(text).toContain(
          'Estratégia ............. HEATMAP DYNAMIC',
        );

        expect(text).not.toContain(
          'FUSION REDUZIDA',
        );
      },
    );


    test(
      'renders prospective distribution',
      () => {
        const text =
          presenter.compact(
            snapshot(),
          );

        expect(text).toContain(
          'BLOCKED ................ 3 (15,0%)',
        );

        expect(text).toContain(
          'OBSERVE ................ 12 (60,0%)',
        );

        expect(text).toContain(
          'PAPER_READY ............ 5 (25,0%)',
        );
      },
    );


    test(
      'renders target size and coverage',
      () => {
        const text =
          presenter.compact(
            snapshot(),
          );

        expect(text).toContain(
          'Tamanho médio alvo ..... 4,50',
        );

        expect(text).toContain(
          'Cobertura média roda ... 12,2%',
        );
      },
    );


    test(
      'renders counterfactual settlement',
      () => {
        const text =
          presenter.compact(
            snapshot(),
          );

        expect(text).toContain(
          'Hipóteses criadas ...... 5',
        );

        expect(text).toContain(
          'Liquidadas ............. 4',
        );

        expect(text).toContain(
          'Pendentes .............. 1',
        );

        expect(text).toContain(
          'WIN ..................... 2',
        );

        expect(text).toContain(
          'LOSS .................... 2',
        );

        expect(text).toContain(
          'Hit rate ................ 50,0%',
        );
      },
    );


    test(
      'detail exposes frozen hypothesis',
      () => {
        const text =
          presenter.detail(
            snapshot(),
          );

        expect(text).toContain(
          'Hipótese criada',
        );

        expect(text).toContain(
          'Decision #............ 5',
        );

        expect(text).toContain(
          'Alvo congelado ....... 32',
        );

        expect(text).toContain(
          'Cobertura ............. 2,7%',
        );
      },
    );


    test(
      'detail exposes subsequent settlement',
      () => {
        const text =
          presenter.detail(
            snapshot(),
          );

        expect(text).toContain(
          'Settlement anterior',
        );

        expect(text).toContain(
          'Decision #............ 4',
        );

        expect(text).toContain(
          'Giro liquidador ...... 32',
        );

        expect(text).toContain(
          'Resultado ............. WIN',
        );
      },
    );


    test(
      'preserves chronological event order',
      () => {
        const text =
          presenter.detail(
            snapshot(),
          );

        expect(
          text.indexOf(
            'LIVE 19',
          ),
        ).toBeLessThan(
          text.indexOf(
            'LIVE 20',
          ),
        );
      },
    );


    test(
      'preserves bankroll and execution governance',
      () => {
        const text =
          presenter.detail(
            snapshot(),
          );

        expect(text).toContain(
          'Banca .................. NÃO ALTERADA',
        );

        expect(text).toContain(
          'Execução automática ... NÃO',
        );

        expect(text).not.toContain(
          'EXECUTAR APOSTA',
        );
      },
    );
  },
);
