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
  'paper runtime imports canonical spin input parser',
  () => {
    assert.match(
      source,
      /PaperRuntimeSpinInputParser/,
    );

    assert.match(
      source,
      /new PaperRuntimeSpinInputParser/,
    );
  },
);


test(
  'catch-up input uses canonical parser',
  () => {
    assert.match(
      source,
      /catchUpInput/,
    );

    assert.match(
      source,
      /allowReadyCommand:\s*true/,
    );

    assert.match(
      source,
      /catchUpInput\.kind ===\s*'EMPTY'/,
    );

    assert.match(
      source,
      /catchUpInput\.kind ===\s*'COMMAND'/,
    );

    assert.match(
      source,
      /catchUpInput\.kind ===\s*'INVALID'/,
    );
  },
);


test(
  'LIVE spin input uses canonical parser',
  () => {
    assert.match(
      source,
      /liveSpinInput/,
    );

    assert.match(
      source,
      /liveSpinInput\.kind ===\s*'EMPTY'/,
    );

    assert.match(
      source,
      /liveSpinInput\.kind !==\s*'SPIN'/,
    );

    assert.match(
      source,
      /liveSpinInput\.spin/,
    );
  },
);


test(
  'legacy catch-up Number command conversion is absent',
  () => {
    assert.doesNotMatch(
      source,
      /const catchUpSpin\s*=\s*Number\(\s*command,\s*\)/,
    );
  },
);


test(
  'legacy LIVE Number command conversion is absent',
  () => {
    assert.doesNotMatch(
      source,
      /const spin\s*=\s*Number\(\s*command,\s*\)/,
    );
  },
);


test(
  'explicit zero is not filtered from runtime',
  () => {
    /*
     * Zero validation belongs to PaperRuntimeSpinInputParser.
     * The runtime consumes SPIN results without excluding spin === 0.
     */
    assert.doesNotMatch(
      source,
      /spin\s*===\s*0[\s\S]{0,120}return/,
    );

    assert.doesNotMatch(
      source,
      /catchUpSpin\s*===\s*0[\s\S]{0,120}return/,
    );
  },
);


test(
  'blank runtime input produces no history mutation call',
  () => {
    const catchUpEmptyPosition =
      source.indexOf(
        "catchUpInput.kind ===\n            'EMPTY'",
      );

    const catchUpRecordPosition =
      source.indexOf(
        '.recordCatchUpSpin(',
        catchUpEmptyPosition,
      );

    assert.notEqual(
      catchUpEmptyPosition,
      -1,
    );

    assert.notEqual(
      catchUpRecordPosition,
      -1,
    );

    assert.ok(
      catchUpEmptyPosition <
      catchUpRecordPosition,
    );


    const liveEmptyPosition =
      source.indexOf(
        "liveSpinInput.kind ===\n          'EMPTY'",
      );

    const liveIngestPosition =
      source.indexOf(
        '.ingestLiveSpin(',
        liveEmptyPosition,
      );

    assert.notEqual(
      liveEmptyPosition,
      -1,
    );

    assert.notEqual(
      liveIngestPosition,
      -1,
    );

    assert.ok(
      liveEmptyPosition <
      liveIngestPosition,
    );
  },
);


test(
  'runtime remains recommendation-only with no automatic execution path',
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
