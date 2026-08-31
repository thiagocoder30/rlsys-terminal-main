const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');


test(
  'main entrypoint composes enterprise CliApplication',
  () => {

    const source =
      readFileSync(
        'src/main.ts',
        'utf8',
      );


    assert.match(
      source,
      /createCliApplication/,
    );


    assert.match(
      source,
      /cli\.execute/,
    );


    assert.match(
      source,
      /cli\.getBanner/,
    );

  },
);


test(
  'main entrypoint delegates normal operator commands to CliApplication',
  () => {

    const source =
      readFileSync(
        'src/main.ts',
        'utf8',
      );


    assert.match(
      source,
      /routedInput/,
    );


    assert.match(
      source,
      /await cli\.execute/,
    );


    assert.match(
      source,
      /STATUS_ALIASES/,
    );

  },
);


test(
  'main entrypoint preserves RuntimeShutdownCoordinator as shutdown authority',
  () => {

    const source =
      readFileSync(
        'src/main.ts',
        'utf8',
      );


    assert.match(
      source,
      /RuntimeShutdownCoordinator/,
    );


    assert.match(
      source,
      /shutdown\.shutdown/,
    );


    assert.match(
      source,
      /OPERATOR_QUIT/,
    );


    assert.match(
      source,
      /QUIT_ALIASES/,
    );

  },
);


test(
  'main entrypoint remains terminal-only composition root',
  () => {

    const source =
      readFileSync(
        'src/main.ts',
        'utf8',
      );


    assert.match(
      source,
      /node:readline\/promises/,
    );


    assert.match(
      source,
      /rlsys>/,
    );


    assert.doesNotMatch(
      source,
      /websocket/i,
    );


    assert.doesNotMatch(
      source,
      /react/i,
    );

  },
);
