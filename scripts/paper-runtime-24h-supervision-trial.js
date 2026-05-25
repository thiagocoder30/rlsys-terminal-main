'use strict';

const {
  write24hSupervisionTrialReport,
  format24hSupervisionTrial
} = require(
  './paper-runtime-24h-supervision-service'
);

function main() {
  const result =
    write24hSupervisionTrialReport();

  console.log(
    format24hSupervisionTrial(
      result.report
    )
  );

  console.log('');
  console.log(
    `24h supervision report: ${result.outputPath}`
  );

  if (
    result.report.certification.certified !== true
  ) {
    console.log(
      '24h supervision: NOT CERTIFIED'
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    '24h supervision: CERTIFIED'
  );
}

main();
