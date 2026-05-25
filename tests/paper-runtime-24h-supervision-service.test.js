'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  build24hSupervisionTrial,
  write24hSupervisionTrialReport
} = require(
  '../scripts/paper-runtime-24h-supervision-service'
);

test(
  'build24hSupervisionTrial returns certification structure',
  () => {
    const report =
      build24hSupervisionTrial();

    assert.equal(
      report.product,
      'RL.SYS CORE'
    );

    assert.equal(
      report.runtime,
      'PAPER_RUNTIME_24H_SUPERVISION'
    );

    assert.equal(
      Array.isArray(report.cycles),
      true
    );

    assert.equal(
      typeof report.certification.certified,
      'boolean'
    );
  }
);

test(
  'write24hSupervisionTrialReport writes supervision report',
  () => {
    const dir =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'rlsys-24h-trial-'
        )
      );

    const outputPath =
      path.join(
        dir,
        '24h-supervision-report.json'
      );

    process.env.RLSYS_PAPER_RUNTIME_24H_REPORT_PATH =
      outputPath;

    const result =
      write24hSupervisionTrialReport();

    delete process.env.RLSYS_PAPER_RUNTIME_24H_REPORT_PATH;

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      fs.existsSync(outputPath),
      true
    );

    const report =
      JSON.parse(
        fs.readFileSync(
          outputPath,
          'utf8'
        )
      );

    assert.equal(
      report.cycles.length,
      12
    );
  }
);
