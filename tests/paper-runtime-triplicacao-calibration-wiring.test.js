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
  'paper runtime imports calibration presenter',
  () => {
    assert.match(
      source,
      /TriplicacaoCounterfactualCalibrationPresenter/,
    );
  },
);


test(
  'paper runtime imports settlement presenter',
  () => {
    assert.match(
      source,
      /TriplicacaoCounterfactualSettlementPresenter/,
    );
  },
);


test(
  'paper runtime exposes stats calibrate command',
  () => {
    assert.match(
      source,
      /command ===\s*'stats calibrate'/,
    );
  },
);


test(
  'stats calibrate reads isolated calibration snapshot',
  () => {
    assert.match(
      source,
      /\.calibrationSnapshot\(\)/,
    );
  },
);


test(
  'stats calibrate reads joint calibration snapshot',
  () => {
    assert.match(
      source,
      /\.jointCalibrationSnapshot\(\)/,
    );
  },
);


test(
  'stats calibrate reads prospective counterfactual settlement',
  () => {
    assert.match(
      source,
      /\.counterfactualSettlementSnapshot\(\)/,
    );
  },
);


test(
  'stats calibrate renders settlement presenter',
  () => {
    assert.match(
      source,
      /triplicacaoCounterfactualSettlementPresenter/,
    );
  },
);


test(
  'stats calibrate remains before LIVE spin parser',
  () => {
    const command =
      source.indexOf(
        "'stats calibrate'",
      );

    const parser =
      source.indexOf(
        'const liveSpinInput =',
      );

    assert.notEqual(
      command,
      -1,
    );

    assert.notEqual(
      parser,
      -1,
    );

    assert.ok(
      command <
      parser,
    );
  },
);


test(
  'counterfactual settlement wiring adds no betting API',
  () => {
    assert.doesNotMatch(
      source,
      /\.placeBet\(/,
    );

    assert.doesNotMatch(
      source,
      /\.executeBet\(/,
    );

    assert.doesNotMatch(
      source,
      /\.autoBet\(/,
    );
  },
);
