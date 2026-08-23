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
  'paper runtime imports canonical Fusion Reduced LIVE components',
  () => {
    assert.match(
      source,
      /FusionReducedLiveTerminalController/,
    );

    assert.match(
      source,
      /FusionReducedLiveObservability/,
    );

    assert.match(
      source,
      /FusionReducedLiveStatsPresenter/,
    );
  },
);


test(
  'paper runtime creates Fusion Reduced from synchronized history',
  () => {
    assert.match(
      source,
      /function createFusionReducedLiveController/,
    );

    assert.match(
      source,
      /fusionReducedLive\s*=\s*createFusionReducedLiveController/,
    );

    assert.match(
      source,
      /synchronizedHistory:\s*history\.rounds/,
    );
  },
);


test(
  'Fusion Reduced shares the post-Sync temporal confirmation',
  () => {
    assert.match(
      source,
      /fusionReducedLive\s*\.confirmHistoryCurrent\(\s*command,\s*\)/,
    );
  },
);


test(
  'Fusion Reduced shares catch-up chronology',
  () => {
    assert.match(
      source,
      /fusionReducedLive\s*\.recordCatchUpSpin\(\s*catchUpSpin,\s*\)/,
    );

    assert.match(
      source,
      /fusionReducedLive\s*\.finishCatchUp\(\)/,
    );
  },
);


test(
  'each LIVE spin is ingested by Fusion Reduced',
  () => {
    assert.match(
      source,
      /const fusionReducedResult\s*=\s*fusionReducedLive\s*\.ingestLiveSpin\(\s*spin,\s*\)/,
    );
  },
);


test(
  'paper runtime renders formal Fusion Reduced observation',
  () => {
    assert.match(
      source,
      /fusionReducedObservability\s*\.observe\(\s*fusionReducedResult,\s*\)/,
    );

    assert.match(
      source,
      /Fusion Reduzida/,
    );

    assert.match(
      source,
      /23 ± 9/,
    );
  },
);


test(
  'legacy dynamic Fusion remains detached',
  () => {
    assert.doesNotMatch(
      source,
      /\bFusionLiveTerminalController\b/,
    );

    assert.doesNotMatch(
      source,
      /\bFusionLiveObservability\b/,
    );

    assert.doesNotMatch(
      source,
      /\bFusionLiveStatsPresenter\b/,
    );

    assert.doesNotMatch(
      source,
      /function createFusionLiveController/,
    );

    assert.doesNotMatch(
      source,
      /\bfusionLive\b/,
    );
  },
);


test(
  'Heatmap Dynamic remains independent',
  () => {
    assert.match(
      source,
      /HeatmapDynamicLiveTerminalController/,
    );

    assert.match(
      source,
      /\bheatmapDynamicLive\b/,
    );

    assert.match(
      source,
      /const heatmapDynamicResult/,
    );
  },
);


test(
  'Triplicacao remains independent',
  () => {
    assert.match(
      source,
      /TriplicacaoLiveTerminalController/,
    );

    assert.match(
      source,
      /\btriplicacaoLive\b/,
    );
  },
);


test(
  'Fusion Reduced remains manual PAPER only',
  () => {
    assert.doesNotMatch(
      source,
      /fusionReducedLive\s*\.placeBet\(/,
    );

    assert.doesNotMatch(
      source,
      /fusionReducedLive\s*\.executeBet\(/,
    );

    assert.doesNotMatch(
      source,
      /fusionReducedLive\s*\.setBankroll\(/,
    );

    assert.doesNotMatch(
      source,
      /fusionReducedLive\s*\.changeBankroll\(/,
    );
  },
);
