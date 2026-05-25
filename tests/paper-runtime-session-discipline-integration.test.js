'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test(
  'paper runtime discipline guard blocks unsafe resume',
  () => {
    const dir =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'rlsys-session-discipline-'
        )
      );

    const ledgerPath =
      path.join(
        dir,
        'paper-ledger.json'
      );

    const disciplinePath =
      path.join(
        dir,
        'operator-discipline.json'
      );

    const result =
      spawnSync(
        process.execPath,
        ['scripts/paper-runtime-session.js'],
        {
          cwd: path.join(
            __dirname,
            '..'
          ),
          input:
            'loss 1\nloss 1\nresume\nexit\n',
          encoding: 'utf8',
          env: {
            ...process.env,
            RLSYS_PAPER_RUNTIME_LEDGER_PATH:
              ledgerPath,
            RLSYS_PAPER_RUNTIME_DISCIPLINE_PATH:
              disciplinePath
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
      /discipline block: UNSAFE_RESUME_AFTER_LOSSES/
    );

    const state =
      JSON.parse(
        fs.readFileSync(
          disciplinePath,
          'utf8'
        )
      );

    assert.equal(
      state.lock.active,
      true
    );
  }
);
