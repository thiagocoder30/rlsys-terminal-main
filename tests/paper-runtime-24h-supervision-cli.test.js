'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test(
  'paper runtime 24h supervision cli generates certification report',
  () => {
    const dir =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'rlsys-24h-cli-'
        )
      );

    const outputPath =
      path.join(
        dir,
        '24h-supervision-report.json'
      );

    const result =
      spawnSync(
        process.execPath,
        [
          'scripts/paper-runtime-24h-supervision-trial.js'
        ],
        {
          cwd: path.join(
            __dirname,
            '..'
          ),
          encoding: 'utf8',
          env: {
            ...process.env,
            RLSYS_PAPER_RUNTIME_24H_REPORT_PATH:
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
      /RL\.SYS CORE 24H SUPERVISION TRIAL/
    );

    assert.match(
      output,
      /24h supervision: CERTIFIED/
    );

    assert.equal(
      fs.existsSync(outputPath),
      true
    );
  }
);
