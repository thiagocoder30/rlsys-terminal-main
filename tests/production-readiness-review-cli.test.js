'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('production readiness review cli generates review and blocks live money', () => {
  const dir =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'rlsys-readiness-cli-'
      )
    );

  const outputPath =
    path.join(
      dir,
      'production-readiness-review.json'
    );

  const result =
    spawnSync(
      process.execPath,
      ['scripts/production-readiness-review.js'],
      {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        env: {
          ...process.env,
          RLSYS_PRODUCTION_READINESS_REVIEW_PATH:
            outputPath
        }
      }
    );

  const output =
    `${result.stdout || ''}${result.stderr || ''}`;

  assert.equal(result.status, 0, output);
  assert.match(output, /RL\.SYS CORE PRODUCTION READINESS REVIEW/);
  assert.match(output, /production readiness: LIVE MONEY BLOCKED/);
  assert.equal(fs.existsSync(outputPath), true);
});
