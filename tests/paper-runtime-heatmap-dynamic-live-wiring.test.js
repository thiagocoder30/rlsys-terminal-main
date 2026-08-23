const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');


const source =
  fs.readFileSync(
    path.join(
      process.cwd(),
      'scripts',
      'paper-runtime-session.js',
    ),
    'utf8',
  );


test(
  'paper runtime imports canonical Heatmap Dynamic LIVE components',
  () => {
    assert.match(
      source,
      /HeatmapDynamicLiveTerminalController/,
    );

    assert.match(
      source,
      /HeatmapDynamicLiveObservability/,
    );

    assert.match(
      source,
      /HeatmapDynamicLiveStatsPresenter/,
    );
  },
);


test(
  'paper runtime creates Heatmap Dynamic controller from synchronized history',
  () => {
    assert.match(
      source,
      /function createHeatmapDynamicLiveController/,
    );

    assert.match(
      source,
      /heatmapDynamicLive\s*=\s*createHeatmapDynamicLiveController/,
    );
  },
);


test(
  'Heatmap Dynamic shares temporal confirmation',
  () => {
    assert.match(
      source,
      /heatmapDynamicLive\s*\.confirmHistoryCurrent\(\s*command,\s*\)/,
    );
  },
);


test(
  'Heatmap Dynamic consumes catch-up chronology',
  () => {
    assert.match(
      source,
      /heatmapDynamicLive\s*\.recordCatchUpSpin\(\s*catchUpSpin,\s*\)/,
    );

    assert.match(
      source,
      /heatmapDynamicLive\s*\.finishCatchUp\(\)/,
    );
  },
);


test(
  'each LIVE spin is ingested by Heatmap Dynamic',
  () => {
    assert.match(
      source,
      /const heatmapDynamicResult\s*=\s*heatmapDynamicLive\s*\.ingestLiveSpin\(\s*spin,\s*\)/,
    );

    const ingest =
      source.indexOf(
        'const heatmapDynamicResult',
      );

    const parser =
      source.indexOf(
        'const liveSpinInput',
      );

    assert.notEqual(
      ingest,
      -1,
    );

    assert.notEqual(
      parser,
      -1,
    );

    assert.ok(
      ingest >
      parser,
    );
  },
);


test(
  'paper runtime exposes Heatmap Dynamic stats commands',
  () => {
    assert.match(
      source,
      /command === 'heatmap stats'/,
    );

    assert.match(
      source,
      /command === 'heatmap stats detail'/,
    );

    assert.match(
      source,
      /heatmapDynamicLive\s*\.statsSnapshot\(/,
    );
  },
);


test(
  'Heatmap Dynamic remains manual PAPER only',
  () => {
    assert.doesNotMatch(
      source,
      /heatmapDynamicLive\s*\.placeBet\(/,
    );

    assert.doesNotMatch(
      source,
      /heatmapDynamicLive\s*\.executeBet\(/,
    );

    assert.doesNotMatch(
      source,
      /heatmapDynamicLive\s*\.changeBankroll\(/,
    );
  },
);
