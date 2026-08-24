'use strict';

const test =
  require(
    'node:test',
  );

const assert =
  require(
    'node:assert/strict',
  );

const fs =
  require(
    'node:fs',
  );

const path =
  require(
    'node:path',
  );


const runtimePath =
  path.join(
    __dirname,
    '..',
    'scripts',
    'paper-runtime-session.js',
  );


function source() {
  return fs.readFileSync(
    runtimePath,
    'utf8',
  );
}


test(
  'paper runtime imports canonical historical SHADOW session components',
  () => {
    const text =
      source();

    assert.match(
      text,
      /PaperHistoricalShadowSessionEngine/,
    );

    assert.match(
      text,
      /PaperHistoricalShadowPresenter/,
    );
  },
);


test(
  'historical SHADOW consumes canonical synchronized history',
  () => {
    const text =
      source();

    assert.match(
      text,
      /history:\s*history\.rounds/,
    );

    assert.match(
      text,
      /initialBankroll:\s*configuration\.bankroll/,
    );

    assert.match(
      text,
      /configuration\.riskMode/,
    );

    assert.match(
      text,
      /configuration\.provider/,
    );

    assert.match(
      text,
      /resolvePaperMinimumStake\s*\(\s*configuration\s*,?\s*\)/,
    );

    assert.match(
      text,
      /resolvePaperMartingaleEnabled\s*\(\s*configuration\s*,?\s*\)/,
    );
  },
);


test(
  'historical SHADOW runs before prospective LIVE controllers initialize',
  () => {
    const text =
      source();

    const shadow =
      text.indexOf(
        'historicalShadowSnapshot =',
      );

    const oracle =
      text.indexOf(
        'liveOracle =',
        shadow,
      );

    const triplicacao =
      text.indexOf(
        'triplicacaoLive =',
        shadow,
      );

    const heatmap =
      text.indexOf(
        'heatmapDynamicLive =',
        shadow,
      );

    const fusion =
      text.indexOf(
        'fusionReducedLive =',
        shadow,
      );

    assert.notEqual(
      shadow,
      -1,
    );

    assert.ok(
      oracle >
      shadow,
    );

    assert.ok(
      triplicacao >
      shadow,
    );

    assert.ok(
      heatmap >
      shadow,
    );

    assert.ok(
      fusion >
      shadow,
    );
  },
);


test(
  'SHADOW report renders before temporal confirmation',
  () => {
    const text =
      source();

    const render =
      text.indexOf(
        'historicalShadowPresenter',
      );

    /*
     * Skip the presenter construction and locate the runtime render.
     */
    const runtimeRender =
      text.indexOf(
        '.render(',
        render,
      );

    const temporalConfirmation =
      text.indexOf(
        'printTriplicacaoHistoryConfirmation();',
        runtimeRender,
      );

    assert.notEqual(
      runtimeRender,
      -1,
    );

    assert.notEqual(
      temporalConfirmation,
      -1,
    );

    assert.ok(
      runtimeRender <
      temporalConfirmation,
    );
  },
);


test(
  'SHADOW executes before catch-up or LIVE spin ingestion',
  () => {
    const text =
      source();

    const shadow =
      text.indexOf(
        'historicalShadowSnapshot =',
      );

    const catchUp =
      text.indexOf(
        '.recordCatchUpSpin(',
      );

    const liveSpin =
      text.indexOf(
        '.ingestLiveSpin(',
      );

    assert.notEqual(
      shadow,
      -1,
    );

    assert.ok(
      catchUp >
      shadow,
    );

    assert.ok(
      liveSpin >
      shadow,
    );
  },
);


test(
  'historical SHADOW wiring exposes no execution primitive',
  () => {
    const text =
      source();

    const factoryStart =
      text.indexOf(
        'function createHistoricalShadowSessionSnapshot(',
      );

    const factoryEnd =
      text.indexOf(
        'function createAutomaticLaunchCoordinator(',
        factoryStart,
      );

    assert.notEqual(
      factoryStart,
      -1,
    );

    assert.notEqual(
      factoryEnd,
      -1,
    );

    const factory =
      text.slice(
        factoryStart,
        factoryEnd,
      );

    assert.doesNotMatch(
      factory,
      /\bplaceBet\s*\(/,
    );

    assert.doesNotMatch(
      factory,
      /\bexecuteBet\s*\(/,
    );

    assert.doesNotMatch(
      factory,
      /\bsendBet\s*\(/,
    );

    assert.doesNotMatch(
      factory,
      /\bsubmitBet\s*\(/,
    );
  },
);


test(
  'historical SHADOW does not replace any canonical prospective strategy',
  () => {
    const text =
      source();

    assert.match(
      text,
      /createTriplicacaoLiveController/,
    );

    assert.match(
      text,
      /createHeatmapDynamicLiveController/,
    );

    assert.match(
      text,
      /createFusionReducedLiveController/,
    );

    assert.match(
      text,
      /PaperLiveOracleEngine/,
    );
  },
);
