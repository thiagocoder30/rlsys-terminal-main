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
  'paper runtime exposes fusion stats command',
  () => {
    assert.match(
      source,
      /command === 'fusion stats'/,
    );
  },
);


test(
  'paper runtime exposes fusion stats detail command',
  () => {
    assert.match(
      source,
      /command === 'fusion stats detail'/,
    );
  },
);


test(
  'Fusion stats reads canonical Fusion Reduced controller snapshot',
  () => {
    assert.match(
      source,
      /fusionReducedLive\s*\.statsSnapshot\(/,
    );

    assert.match(
      source,
      /fusionReducedStatsPresenter\s*\.compact\(/,
    );

    assert.match(
      source,
      /fusionReducedStatsPresenter\s*\.detail\(/,
    );
  },
);


test(
  'Fusion stats commands are routed before ordinary LIVE parser',
  () => {
    const statsIndex =
      source.indexOf(
        "command === 'fusion stats'",
      );

    const parserIndex =
      source.indexOf(
        'const liveSpinInput',
      );

    assert.notEqual(
      statsIndex,
      -1,
    );

    assert.notEqual(
      parserIndex,
      -1,
    );

    assert.ok(
      statsIndex <
      parserIndex,
    );
  },
);


test(
  'Heatmap stats remain separate',
  () => {
    assert.match(
      source,
      /command === 'heatmap stats'/,
    );

    assert.match(
      source,
      /heatmapDynamicLive\s*\.statsSnapshot\(/,
    );

    assert.match(
      source,
      /heatmapDynamicStatsPresenter/,
    );
  },
);


test(
  'Triplicacao stats remain separate',
  () => {
    assert.match(
      source,
      /command === 'stats'/,
    );

    assert.match(
      source,
      /command === 'stats detail'/,
    );

    assert.match(
      source,
      /command === 'stats calibrate'/,
    );

    assert.match(
      source,
      /triplicacaoLive\s*\.statsSnapshot\(/,
    );
  },
);


test(
  'legacy dynamic Fusion stats presenter remains absent',
  () => {
    assert.doesNotMatch(
      source,
      /\bFusionLiveStatsPresenter\b/,
    );

    assert.doesNotMatch(
      source,
      /\bfusionStatsPresenter\b/,
    );
  },
);


test(
  'Fusion stats add no execution API',
  () => {
    assert.doesNotMatch(
      source,
      /fusionReducedStatsPresenter\s*\.placeBet\(/,
    );

    assert.doesNotMatch(
      source,
      /fusionReducedStatsPresenter\s*\.executeBet\(/,
    );
  },
);
