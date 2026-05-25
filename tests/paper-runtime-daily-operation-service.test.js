'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  appendLedgerEntry
} = require(
  '../scripts/paper-runtime-ledger-service'
);

const {
  writeDailyOperationSnapshot,
  buildDailyOperationSnapshot
} = require(
  '../scripts/paper-runtime-daily-operation-service'
);

test(
  'buildDailyOperationSnapshot returns operational readiness snapshot',
  () => {
    const snapshot =
      buildDailyOperationSnapshot();

    assert.equal(
      snapshot.product,
      'RL.SYS CORE'
    );

    assert.equal(
      snapshot.mode,
      'PAPER_RUNTIME_DAILY_OPERATION'
    );

    assert.equal(
      typeof snapshot.operationalReadiness.ready,
      'boolean'
    );
  }
);

test(
  'writeDailyOperationSnapshot writes operational file',
  () => {
    const dir =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'rlsys-daily-operation-'
        )
      );

    const ledgerPath =
      path.join(
        dir,
        'paper-ledger.json'
      );

    const outputPath =
      path.join(
        dir,
        'daily-operation.json'
      );

    process.env.RLSYS_PAPER_RUNTIME_LEDGER_PATH =
      ledgerPath;

    process.env.RLSYS_PAPER_RUNTIME_DAILY_OPERATION_PATH =
      outputPath;

    appendLedgerEntry(
      'WIN',
      10,
      ledgerPath
    );

    const result =
      writeDailyOperationSnapshot();

    delete process.env.RLSYS_PAPER_RUNTIME_LEDGER_PATH;

    delete process.env.RLSYS_PAPER_RUNTIME_DAILY_OPERATION_PATH;

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      fs.existsSync(outputPath),
      true
    );

    const snapshot =
      JSON.parse(
        fs.readFileSync(
          outputPath,
          'utf8'
        )
      );

    assert.equal(
      snapshot.ledger.summary.balance,
      10
    );
  }
);
