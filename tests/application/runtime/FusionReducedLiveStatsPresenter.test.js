const {
  FusionReducedLiveStatsPresenter,
} = require(
  '../../../dist/application/runtime/FusionReducedLiveStatsPresenter.js',
);


function snapshot() {
  return {
    strategyId:
      'fusion-reduced',

    liveSpinCount:
      20,

    blockedCount:
      4,

    observeCount:
      10,

    paperReadyCount:
      6,

    blockedPercent:
      20,

    observePercent:
      50,

    paperReadyPercent:
      30,

    averageConfidenceScore:
      0.68,

    averageRiskScore:
      0.32,

    averageObservedHitRate:
      0.57,

    averageRecentHitRate:
      0.60,

    averageRateDrift:
      0.03,

    targetCenter:
      23,

    targetSize:
      19,

    coveragePercent:
      51.35,

    counterfactualDecisionCount:
      6,

    counterfactualSettledCount:
      5,

    counterfactualPendingCount:
      1,

    counterfactualWinCount:
      3,

    counterfactualLossCount:
      2,

    counterfactualHitRate:
      60,

    counterfactualMaxLossStreak:
      2,

    blockerFrequency: [
      {
        blocker:
          'FUSION_REDUCED_RECENT_RATE_BELOW_GATE',

        count:
          3,
      },
    ],

    latestEvents: [
      {
        liveSpinIndex:
          19,

        spin:
          23,

        decisionStatus:
          'PAPER_READY',

        eligible:
          true,

        confidenceScore:
          0.78,

        riskScore:
          0.22,

        observedHitRate:
          0.58,

        recentHitRate:
          0.625,

        rateDrift:
          0.045,

        sampleSize:
          100,

        recentSampleSize:
          24,

        targetSize:
          19,

        coveragePercent:
          51.35,

        hypothesisCreated:
          true,

        settlementOutcome:
          null,

        settlementSpin:
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
          17,

        decisionStatus:
          'OBSERVE',

        eligible:
          false,

        confidenceScore:
          0.55,

        riskScore:
          0.45,

        observedHitRate:
          0.56,

        recentHitRate:
          0.50,

        rateDrift:
          0.06,

        sampleSize:
          101,

        recentSampleSize:
          24,

        targetSize:
          19,

        coveragePercent:
          51.35,

        hypothesisCreated:
          false,

        settlementOutcome:
          'WIN',

        settlementSpin:
          17,

        blockers: [
          'FUSION_REDUCED_RECENT_RATE_BELOW_GATE',
        ],

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
  'FusionReducedLiveStatsPresenter',
  () => {
    const presenter =
      new FusionReducedLiveStatsPresenter();


    test(
      'renders canonical Fusion Reduced identity',
      () => {
        const text =
          presenter.compact(
            snapshot(),
          );

        expect(
          text,
        ).toContain(
          'RL.SYS — FUSION REDUZIDA / ESTATÍSTICAS',
        );

        expect(
          text,
        ).toContain(
          'Estratégia ............. FUSION REDUZIDA',
        );

        expect(
          text,
        ).not.toContain(
          'HEATMAP DYNAMIC',
        );
      },
    );


    test(
      'renders fixed doctrine and nominal coverage',
      () => {
        const text =
          presenter.compact(
            snapshot(),
          );

        expect(
          text,
        ).toContain(
          'Centro .................. 23',
        );

        expect(
          text,
        ).toContain(
          'Tamanho do alvo ........ 19',
        );

        expect(
          text,
        ).toContain(
          'Cobertura nominal ...... 51,35%',
        );

        expect(
          text,
        ).toContain(
          'Alvo .................... 23 ± 9',
        );
      },
    );


    test(
      'renders empirical evidence metrics',
      () => {
        const text =
          presenter.compact(
            snapshot(),
          );

        expect(
          text,
        ).toContain(
          'Confiança .............. 68,00%',
        );

        expect(
          text,
        ).toContain(
          'Risco .................. 32,00%',
        );

        expect(
          text,
        ).toContain(
          'Hit rate global obs. ... 57,00%',
        );

        expect(
          text,
        ).toContain(
          'Hit rate recente obs. .. 60,00%',
        );

        expect(
          text,
        ).toContain(
          'Rate drift ............. 3,00%',
        );
      },
    );


    test(
      'renders counterfactual results',
      () => {
        const text =
          presenter.compact(
            snapshot(),
          );

        expect(
          text,
        ).toContain(
          'Hipóteses criadas ...... 6',
        );

        expect(
          text,
        ).toContain(
          'Liquidadas ............. 5',
        );

        expect(
          text,
        ).toContain(
          'Pendentes .............. 1',
        );

        expect(
          text,
        ).toContain(
          'WIN ..................... 3',
        );

        expect(
          text,
        ).toContain(
          'LOSS .................... 2',
        );

        expect(
          text,
        ).toContain(
          'Hit rate ................ 60,00%',
        );
      },
    );


    test(
      'warns that hit rate must be interpreted against nominal coverage',
      () => {
        const text =
          presenter.compact(
            snapshot(),
          );

        expect(
          text,
        ).toContain(
          'taxa de acerto deve ser comparada à cobertura nominal de 19/37',
        );
      },
    );


    test(
      'detail preserves chronological LIVE events',
      () => {
        const text =
          presenter.detail(
            snapshot(),
          );

        expect(
          text,
        ).toContain(
          'LIVE inicial ........... 19',
        );

        expect(
          text,
        ).toContain(
          'LIVE final ............. 20',
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
      'detail exposes hypothesis and previous settlement',
      () => {
        const text =
          presenter.detail(
            snapshot(),
          );

        expect(
          text,
        ).toContain(
          'Hipótese criada ....... SIM',
        );

        expect(
          text,
        ).toContain(
          'Settlement ............ WIN',
        );

        expect(
          text,
        ).toContain(
          'Giro liquidador ....... 17',
        );
      },
    );


    test(
      'preserves recommendation-only governance',
      () => {
        const text =
          presenter.detail(
            snapshot(),
          );

        expect(
          text,
        ).toContain(
          'Banca .................. NÃO ALTERADA',
        );

        expect(
          text,
        ).toContain(
          'Execução automática ... NÃO',
        );

        expect(
          text,
        ).not.toContain(
          'EXECUTAR APOSTA',
        );
      },
    );
  },
);
