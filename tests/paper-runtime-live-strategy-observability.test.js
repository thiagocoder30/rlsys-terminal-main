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
  'paper runtime wires Triplicacao live observability',
  () => {
    assert.match(
      source,
      /TriplicacaoLiveObservability/,
    );

    assert.match(
      source,
      /new TriplicacaoLiveObservability/,
    );
  },
);


test(
  'status is available inside paperRunning flow before live parsers',
  () => {
    assert.match(
      source,
      /command === 'status'/,
    );

    assert.match(
      source,
      /printTriplicacaoLiveStatus/,
    );
  },
);


test(
  'runtime renders formal Triplicacao observation after each live spin',
  () => {
    /*
     * The old observability HUD printed:
     *
     *   Triplicação ........ <technical summary>
     *   Motivo ............. <technical reason>
     *
     * Operator Explainability intentionally replaced that contract.
     *
     * The runtime must now:
     *
     *   1. observe the institutional result;
     *   2. delegate operator-facing language to
     *      OperatorExplainabilityPresenter;
     *   3. render triplicacaoLines().
     */
    assert.match(
      source,
      /printTriplicacaoCompactObservation/,
    );

    assert.match(
      source,
      /observability\.observe/,
    );

    assert.match(
      source,
      /explainability\s*\.triplicacaoLines\(/,
    );

    assert.match(
      source,
      /printTriplicacaoCompactObservation\(\s*triplicacaoResult,\s*triplicacaoObservability,\s*operatorExplainability,\s*\)/,
    );
  },
);


test(
  'runtime no longer exposes raw Triplicacao technical telemetry',
  () => {
    assert.doesNotMatch(
      source,
      /Triplicação \.\.\.\.\.\.\.\. \$\{observation\.summary\}/,
    );

    assert.doesNotMatch(
      source,
      /Motivo \.\.\.\.\.\.\.\.\.\.\.\.\. \$\{observation\.reason\}/,
    );
  },
);


test(
  'observability does not add execution capability',
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
