'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');


test(
  'paper runtime session script exposes canonical supervised setup commands',
  () => {
    const source =
      readFileSync(
        'scripts/paper-runtime-session.js',
        'utf8',
      );

    assert.match(
      source,
      /readline/,
    );

    assert.match(
      source,
      /configure/,
    );

    assert.match(
      source,
      /sync/,
    );

    assert.match(
      source,
      /resync/,
    );

    assert.match(
      source,
      /setupIsCapturingHistory/,
    );

    assert.match(
      source,
      /setupIsQualified/,
    );
  },
);


test(
  'paper runtime session processes canonical scripted stdin',
  () => {
    const result =
      spawnSync(
        process.execPath,
        [
          'scripts/paper-runtime-session.js',
        ],
        {
          cwd:
            path.join(
              __dirname,
              '..',
            ),

          input:
            'status\nexit\n',

          encoding:
            'utf8',

          timeout:
            60000,
        },
      );

    const output =
      `${result.stdout || ''}${result.stderr || ''}`;

    assert.equal(
      result.status,
      0,
      output,
    );

    assert.equal(
      result.signal,
      null,
      output,
    );

    assert.match(
      output,
      /RL\.SYS CORE — PAPER SESSION SETUP/,
    );

    assert.match(
      output,
      /RL\.SYS PAPER SESSION/,
    );

    assert.match(
      output,
      /Status: PENDING_CONFIGURATION/,
    );

    assert.match(
      output,
      /Sync: UNSYNCED/,
    );

    assert.match(
      output,
      /RL\.SYS paper runtime session closed\./,
    );
  },
);
