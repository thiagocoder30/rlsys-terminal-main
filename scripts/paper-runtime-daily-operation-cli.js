'use strict';

const {
  writeDailyOperationSnapshot,
  formatDailyOperationSnapshot
} = require(
  './paper-runtime-daily-operation-service'
);

function main() {
  const result =
    writeDailyOperationSnapshot();

  console.log(
    formatDailyOperationSnapshot(
      result.snapshot
    )
  );

  console.log('');
  console.log(
    `daily operation snapshot: ${result.outputPath}`
  );

  if (
    result.snapshot.operationalReadiness.ready !== true
  ) {
    console.log(
      'daily operation: NOT READY'
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    'daily operation: READY'
  );
}

main();
