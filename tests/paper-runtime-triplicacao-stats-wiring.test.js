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
  'paper runtime imports Triplicacao stats presenter',
  () => {
    assert.match(
      source,
      /TriplicacaoLiveStatsPresenter/,
    );
  },
);


test(
  'paper runtime exposes stats command',
  () => {
    assert.match(
      source,
      /command ===\s*'stats'/,
    );
  },
);


test(
  'paper runtime exposes stats detail command',
  () => {
    assert.match(
      source,
      /command ===\s*'stats detail'/,
    );
  },
);


test(
  'stats reads controller snapshot',
  () => {
    assert.match(
      source,
      /\.statsSnapshot\(/,
    );

    assert.match(
      source,
      /\.compact\(/,
    );

    assert.match(
      source,
      /\.detail\(/,
    );
  },
);


test(
  'stats commands are routed before ordinary LIVE spin parser',
  () => {
    const stats =
      source.indexOf(
        "'stats'",
      );

    const liveParser =
      source.indexOf(
        'const liveSpinInput',
      );

    assert.notEqual(
      stats,
      -1,
    );

    assert.notEqual(
      liveParser,
      -1,
    );

    assert.ok(
      stats <
      liveParser,
    );
  },
);


test(
  'stats wiring adds no automatic bet API',
  () => {
    assert.doesNotMatch(
      source,
      /\.placeBet\(/,
    );

    assert.doesNotMatch(
      source,
      /\.autoBet\(/,
    );
  },
);
