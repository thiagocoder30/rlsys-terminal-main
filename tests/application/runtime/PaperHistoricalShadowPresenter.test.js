const {
  PaperHistoricalShadowPresenter,
} = require(
  '../../../dist/application/runtime/PaperHistoricalShadowPresenter.js',
);


function replay(
  strategyId,
  overrides = {},
) {
  return {
    strategyId,

    provider:
      'PRAGMATIC',

    minimumChipValue:
      0.10,

    riskMode:
      'moderate',

    totalSpins:
      300,

    minimumHistorySize:
      60,

    warmupSpins:
      60,

    decisionPointCount:
      240,

    evaluatedDecisionPointCount:
      240,

    capitalBlockedDecisionPointCount:
      0,

    noSignalDecisionPointCount:
      220,

    financiallyBlockedDecisionCount:
      2,

    tradeCount:
      18,

    winCount:
      11,

    lossCount:
      6,

    voidCount:
      1,

    decisiveTradeCount:
      17,

    hitRate:
      11 / 17,

    totalStake:
      18,

    grossReturn:
      23.40,

    totalPnl:
      5.40,

    roiPercent:
      30,

    averagePnlPerTrade:
      0.30,

    initialBankroll:
      150,

    currentBankroll:
      155.40,

    peakBankroll:
      158,

    bankrollReturnPercent:
      3.6,

    maxLossStreak:
      2,

    maxDrawdownAmount:
      4.20,

    maxDrawdownPercent:
      2.6582,

    capitalDecision:
      'ALLOW',

    capitalStop:
      false,

    capitalStopReason:
      null,

    capitalStopDecisionSpinIndex:
      null,

    trades:
      [],

    historicalShadow:
      true,

    lookAheadAllowed:
      false,

    paperOnly:
      true,

    recommendationOnly:
      true,

    humanExecutionRequired:
      true,

    bankrollChangedInSimulationOnly:
      true,

    realBankrollChanged:
      false,

    automaticExecution:
      false,

    ...overrides,
  };
}


function session(
  overrides = {},
) {
  const triplicacao =
    replay(
      'triplicacao',
    );

  const fusionReduced =
    replay(
      'fusion-reduced',
      {
        totalPnl:
          -1.20,

        currentBankroll:
          148.80,

        roiPercent:
          -5.45,
      },
    );

  const heatmapDynamic =
    replay(
      'heatmap-dynamic',
      {
        tradeCount:
          0,

        winCount:
          0,

        lossCount:
          0,

        voidCount:
          0,

        decisiveTradeCount:
          0,

        hitRate:
          null,

        totalStake:
          0,

        grossReturn:
          0,

        totalPnl:
          0,

        roiPercent:
          null,

        averagePnlPerTrade:
          null,

        currentBankroll:
          150,
      },
    );

  return {
    totalSpins:
      300,

    initialBankroll:
      150,

    provider:
      'PRAGMATIC',

    riskMode:
      'moderate',

    minimumChipValue:
      0.10,

    martingaleEnabled:
      false,

    triplicacao,

    fusionReduced,

    heatmapDynamic,

    summaries:
      [],

    historicalShadow:
      true,

    retrospectiveOnly:
      true,

    lookAheadAllowed:
      false,

    realBankrollChanged:
      false,

    automaticExecution:
      false,

    humanExecutionRequired:
      true,

    ...overrides,
  };
}


describe(
  'PaperHistoricalShadowPresenter',
  () => {
    test(
      'renders institutional session header',
      () => {
        const output =
          new PaperHistoricalShadowPresenter()
            .render(
              session(),
            );

        expect(
          output,
        ).toContain(
          'RL.SYS — SHADOW HISTÓRICO DO SYNC',
        );

        expect(
          output,
        ).toContain(
          'Histórico ............. 300 giros',
        );

        expect(
          output,
        ).toContain(
          'Banca inicial ......... R$ 150,00',
        );

        expect(
          output,
        ).toContain(
          'Provedor ............... PRAGMATIC',
        );

        expect(
          output,
        ).toContain(
          'Perfil ................. MODERATE',
        );
      },
    );


    test(
      'renders all three canonical strategies',
      () => {
        const output =
          new PaperHistoricalShadowPresenter()
            .render(
              session(),
            );

        expect(
          output,
        ).toContain(
          'TRIPLICAÇÃO',
        );

        expect(
          output,
        ).toContain(
          'FUSION REDUZIDA',
        );

        expect(
          output,
        ).toContain(
          'HEATMAP DYNAMIC',
        );
      },
    );


    test(
      'renders BRL PnL ROI and drawdown',
      () => {
        const output =
          new PaperHistoricalShadowPresenter()
            .render(
              session(),
            );

        expect(
          output,
        ).toContain(
          'P&L .................... +R$ 5,40',
        );

        expect(
          output,
        ).toContain(
          'P&L .................... R$ -1,20',
        );

        expect(
          output,
        ).toContain(
          'ROI .................... 30,00%',
        );

        expect(
          output,
        ).toContain(
          'Drawdown máximo ........ R$ 4,20',
        );
      },
    );


    test(
      'renders N/A when no decisive trade exists',
      () => {
        const output =
          new PaperHistoricalShadowPresenter()
            .render(
              session(),
            );

        expect(
          output,
        ).toContain(
          'Hit rate ............... N/A',
        );

        expect(
          output,
        ).toContain(
          'ROI .................... N/A',
        );
      },
    );


    test(
      'renders capital preservation state',
      () => {
        const output =
          new PaperHistoricalShadowPresenter()
            .render(
              session(),
            );

        expect(
          output,
        ).toContain(
          'Capital STOP ........... NÃO',
        );

        expect(
          output,
        ).toContain(
          'Motivo STOP ............ N/A',
        );
      },
    );


    test(
      'renders retrospective governance explicitly',
      () => {
        const output =
          new PaperHistoricalShadowPresenter()
            .render(
              session(),
            );

        expect(
          output,
        ).toContain(
          'Natureza ............... RETROSPECTIVA',
        );

        expect(
          output,
        ).toContain(
          'Look-ahead .............. BLOQUEADO',
        );

        expect(
          output,
        ).toContain(
          'Banca real alterada ..... NÃO',
        );

        expect(
          output,
        ).toContain(
          'Execução automática ..... NÃO',
        );

        expect(
          output,
        ).toContain(
          'Ele NÃO autoriza entrada prospectiva.',
        );
      },
    );


    test(
      'does not expose betting or execution APIs',
      () => {
        const presenter =
          new PaperHistoricalShadowPresenter();

        expect(
          presenter.placeBet,
        ).toBeUndefined();

        expect(
          presenter.executeBet,
        ).toBeUndefined();
      },
    );
  },
);
