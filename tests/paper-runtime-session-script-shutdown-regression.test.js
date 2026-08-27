'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');


function runPaperRuntime(
  input,
  options = {},
) {
  const dir =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'rlsys-paper-shutdown-',
      ),
    );

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

        input,

        encoding:
          'utf8',

        timeout:
          60000,

        env: {
          ...process.env,

          RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH:
            options.snapshotPath ??
            path.join(
              dir,
              'session-snapshot.json',
            ),

          RLSYS_PAPER_RUNTIME_LEDGER_PATH:
            path.join(
              dir,
              'paper-ledger.json',
            ),

          RLSYS_PAPER_RUNTIME_DISCIPLINE_PATH:
            path.join(
              dir,
              'operator-discipline.json',
            ),
        },
      },
    );

  return {
    dir,
    result,

    output:
      `${result.stdout || ''}${result.stderr || ''}`,
  };
}


test(
  'paper runtime scripted stdin exits deterministically',
  () => {
    const {
      result,
      output,
    } =
      runPaperRuntime(
        'status\nexit\n',
      );

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


test(
  'paper runtime ignores incompatible snapshot instead of crashing',
  () => {
    const dir =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'rlsys-paper-bad-snapshot-',
        ),
      );

    const snapshotPath =
      path.join(
        dir,
        'session-snapshot.json',
      );

    fs.writeFileSync(
      snapshotPath,
      JSON.stringify({
        schemaVersion:
          'legacy-invalid',

        sessionState:
          'RUNNING',
      }),
    );

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

          env: {
            ...process.env,

            RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH:
              snapshotPath,

            RLSYS_PAPER_RUNTIME_LEDGER_PATH:
              path.join(
                dir,
                'paper-ledger.json',
              ),

            RLSYS_PAPER_RUNTIME_DISCIPLINE_PATH:
              path.join(
                dir,
                'operator-discipline.json',
              ),
          },
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
      /Previous snapshot ignored:/,
    );

    assert.match(
      output,
      /RL\.SYS PAPER STATUS/,
    );

    assert.match(
      output,
      /RL\.SYS paper runtime session closed\./,
    );
  },
);
