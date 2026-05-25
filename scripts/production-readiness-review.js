'use strict';

const {
  writeProductionReadinessReview,
  formatProductionReadinessReview
} = require('./production-readiness-review-service');

function main() {
  const result =
    writeProductionReadinessReview();

  console.log(
    formatProductionReadinessReview(
      result.review
    )
  );

  console.log('');
  console.log(
    `production readiness review: ${result.outputPath}`
  );

  if (
    result.review.decision.productionMoneyAllowed === true
  ) {
    console.log(
      'production readiness: LIVE MONEY ALLOWED'
    );
    return;
  }

  console.log(
    'production readiness: LIVE MONEY BLOCKED'
  );
}

main();
