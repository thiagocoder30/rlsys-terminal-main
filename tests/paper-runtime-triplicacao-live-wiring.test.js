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
  'paper runtime wires Triplicacao live controller',
  () => {
    assert.match(
      source,
      /TriplicacaoLiveTerminalController/,
    );

    assert.match(
      source,
      /createTriplicacaoLiveController/,
    );

    assert.match(
      source,
      /ingestLiveSpin/,
    );
  },
);


test(
  'paper runtime exposes post-Sync temporal boundary',
  () => {
    assert.match(
      source,
      /histórico> /,
    );

    assert.match(
      source,
      /catch-up> /,
    );

    assert.match(
      source,
      /recordCatchUpSpin/,
    );

    assert.match(
      source,
      /finishCatchUp/,
    );
  },
);


test(
  'paper runtime uses one-character operator decision',
  () => {
    assert.match(
      source,
      /decisão> /,
    );

    assert.match(
      source,
      /recordOperatorDecision/,
    );

    assert.match(
      source,
      /command !== 's'/,
    );

    assert.match(
      source,
      /command !== 'n'/,
    );
  },
);


test(
  'generic oracle no longer invents operational target',
  () => {
    assert.match(
      source,
      /CONTEXTO ANALÍTICO FAVORÁVEL/,
    );

    assert.match(
      source,
      /estratégia prospectiva/,
    );

    assert.doesNotMatch(
      source,
      /Estratégia\/contexto \. Triplicação \+ Heatmap/,
    );
  },
);


test(
  'Triplicacao HUD exposes target stake and recovery',
  () => {
    assert.match(
      source,
      /OPORTUNIDADE TRIPLICAÇÃO/,
    );

    assert.match(
      source,
      /Entrada sugerida/,
    );

    assert.match(
      source,
      /Stake base/,
    );

    assert.match(
      source,
      /Recovery/,
    );

    assert.match(
      source,
      /Stake sugerida/,
    );
  },
);


test(
  'paper runtime preserves manual-only execution invariant',
  () => {
    assert.match(
      source,
      /O RL\.Sys apenas orienta/,
    );

    assert.match(
      source,
      /Não existe execução automática/,
    );

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
