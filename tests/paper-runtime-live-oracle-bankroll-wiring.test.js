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
  'initial PaperLiveOracleEngine receives configured bankroll',
  () => {
    assert.match(
      source,
      /new PaperLiveOracleEngine\(\s*setupSnapshot\.history\.rounds,\s*setupSnapshot\.configuration\.bankroll,\s*\)/,
    );
  },
);


test(
  'catch-up rebuilt oracle receives configured bankroll',
  () => {
    assert.match(
      source,
      /new PaperLiveOracleEngine\(\s*triplicacaoLive\s*\.historySnapshot\(\),\s*setupSnapshot\s*\.configuration\s*\.bankroll,\s*\)/,
    );
  },
);


test(
  'runtime uses canonical setup minimum chip value',
  () => {
    assert.match(
      source,
      /configuration\.minimumChipValue/,
    );
  },
);


test(
  'runtime uses canonical setup martingale policy',
  () => {
    assert.match(
      source,
      /configuration\.allowMartingale/,
    );
  },
);


test(
  'failed live bootstrap is explicitly locked',
  () => {
    assert.match(
      source,
      /liveBootstrapBlocked/,
    );

    assert.match(
      source,
      /bloqueado> /,
    );

    assert.match(
      source,
      /RUNTIME LIVE BLOQUEADO/,
    );
  },
);


test(
  'bankroll-less live oracle constructors are absent from runtime',
  () => {
    assert.doesNotMatch(
      source,
      /new PaperLiveOracleEngine\(\s*setupSnapshot\.history\.rounds,\s*\)/,
    );

    assert.doesNotMatch(
      source,
      /new PaperLiveOracleEngine\(\s*triplicacaoLive\s*\.historySnapshot\(\),\s*\)/,
    );
  },
);
