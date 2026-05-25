'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test(
  'paper runtime daily operation cli generates operational snapshot',
  () => {
    const dir =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'rlsys-daily-cli-'
        )
      );

    const outputPath =
      path.join(
        dir,
        'daily-operation.json'
      );

    const result =
      spawnSync(
        process.execPath,
        [
          'scripts/paper-runtime-daily-operation-cli.js'
        ],
        {
          cwd: path.join(
            __dirname,
            '..'
          ),
          encoding: 'utf8',
          env: {
            ...process.env,
            RLSYS_PAPER_RUNTIME_DAILY_OPERATION_PATH:
              outputPath
          }
        }
      );

    const output =
      `${result.stdout || ''}${result.stderr || ''}`;

    assert.equal(
      result.status,
      0,
      output
    );

    assert.match(
      output,
      /RL\.SYS CORE DAILY OPERATION/
    );

    assert.equal(
      fs.existsSync(outputPath),
      true
    );
  }
);
