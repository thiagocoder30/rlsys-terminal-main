'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  buildDailyOperationSnapshot
} = require('./paper-runtime-daily-operation-service');

const {
  build24hSupervisionTrial
} = require('./paper-runtime-24h-supervision-service');

const {
  resolveLedgerPath,
  readLedger
} = require('./paper-runtime-ledger-service');

const {
  resolveDisciplineStatePath,
  readDisciplineState
} = require('./paper-runtime-operator-discipline-guard');

function resolveProductionReadinessReviewPath() {
  return process.env.RLSYS_PRODUCTION_READINESS_REVIEW_PATH ||
    path.join(
      process.cwd(),
      'data',
      'paper-runtime',
      'production-readiness-review.json'
    );
}

function nowIso() {
  return new Date().toISOString();
}

function buildCheck(id, label, passed, evidence, severity) {
  return {
    id,
    label,
    passed: passed === true,
    severity: severity || 'HIGH',
    evidence: evidence || {}
  };
}

function countPassed(checks) {
  let total = 0;

  for (const check of checks) {
    if (check.passed === true) {
      total += 1;
    }
  }

  return total;
}

function computeReadinessScore(checks) {
  if (!Array.isArray(checks) || checks.length === 0) {
    return 0;
  }

  return Math.round(
    (countPassed(checks) / checks.length) * 100
  );
}

function classifyReadiness(score, hasCriticalFailure) {
  if (hasCriticalFailure) {
    return 'BLOCKED';
  }

  if (score >= 95) {
    return 'PAPER_READY';
  }

  if (score >= 80) {
    return 'NEEDS_REVIEW';
  }

  return 'BLOCKED';
}

function hasCriticalFailure(checks) {
  return checks.some((check) => {
    return check.severity === 'CRITICAL' &&
      check.passed !== true;
  });
}

function buildProductionReadinessReview() {
  const daily =
    buildDailyOperationSnapshot();

  const trial =
    build24hSupervisionTrial();

  const ledger =
    readLedger(resolveLedgerPath());

  const discipline =
    readDisciplineState(
      resolveDisciplineStatePath()
    );

  const ledgerSummary =
    ledger.summary || {
      wins: 0,
      losses: 0,
      balance: 0,
      maxDrawdown: 0,
      totalCommands: 0
    };

  const checks = [
    buildCheck(
      'runtime.daily.ready',
      'Daily operation readiness is available and ready',
      daily.operationalReadiness &&
        daily.operationalReadiness.ready === true,
      daily.operationalReadiness,
      'CRITICAL'
    ),
    buildCheck(
      'trial.certified',
      '24h supervision trial is certified',
      trial.certification &&
        trial.certification.certified === true,
      trial.certification,
      'CRITICAL'
    ),
    buildCheck(
      'ledger.integrity',
      'Ledger entries are readable and summarized',
      Array.isArray(ledger.entries) &&
        ledger.summary &&
        typeof ledgerSummary.balance === 'number',
      ledgerSummary,
      'CRITICAL'
    ),
    buildCheck(
      'discipline.unlocked',
      'Operator discipline guard is not locked',
      !(
        discipline.lock &&
        discipline.lock.active === true
      ),
      discipline.lock || {},
      'CRITICAL'
    ),
    buildCheck(
      'risk.paper.only',
      'Production money remains explicitly blocked',
      true,
      {
        productionMoneyAllowed: false,
        reason: 'Paper evidence still requires human review'
      },
      'CRITICAL'
    ),
    buildCheck(
      'audit.human.review',
      'Human review is required before live money',
      true,
      {
        requiresHumanReview: true
      },
      'HIGH'
    )
  ];

  const score =
    computeReadinessScore(checks);

  const criticalFailure =
    hasCriticalFailure(checks);

  const classification =
    classifyReadiness(
      score,
      criticalFailure
    );

  return {
    version: 1,
    generatedAt: nowIso(),
    product: 'RL.SYS CORE',
    reviewType: 'PRODUCTION_READINESS_REVIEW',
    score,
    classification,
    checks,
    evidence: {
      dailyOperation: daily,
      supervisionTrial: trial,
      ledgerSummary,
      discipline: {
        lock: discipline.lock || {
          active: false
        },
        warningCount:
          Array.isArray(discipline.warnings)
            ? discipline.warnings.length
            : 0
      }
    },
    decision: {
      productionMoneyAllowed: false,
      liveOperationAllowed: false,
      paperDailyOperationAllowed:
        classification === 'PAPER_READY' ||
        classification === 'NEEDS_REVIEW',
      requiresHumanReview: true,
      recommendation:
        classification === 'PAPER_READY'
          ? 'CONTINUE_EXTENDED_PAPER_SUPERVISION'
          : 'DO_NOT_ADVANCE'
    }
  };
}

function writeProductionReadinessReview() {
  const review =
    buildProductionReadinessReview();

  const outputPath =
    resolveProductionReadinessReviewPath();

  fs.mkdirSync(
    path.dirname(outputPath),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(review, null, 2)}\n`,
    'utf8'
  );

  return {
    ok: true,
    outputPath,
    review
  };
}

function formatProductionReadinessReview(review) {
  return [
    'RL.SYS CORE PRODUCTION READINESS REVIEW',
    '============================================================',
    `generatedAt: ${review.generatedAt}`,
    `score: ${review.score}`,
    `classification: ${review.classification}`,
    '',
    'DECISION',
    `paperDailyOperationAllowed: ${review.decision.paperDailyOperationAllowed}`,
    `liveOperationAllowed: ${review.decision.liveOperationAllowed}`,
    `productionMoneyAllowed: ${review.decision.productionMoneyAllowed}`,
    `requiresHumanReview: ${review.decision.requiresHumanReview}`,
    `recommendation: ${review.decision.recommendation}`,
    '',
    'CHECKS',
    ...review.checks.map((check) => {
      return `${check.passed ? 'PASS' : 'FAIL'} ${check.id} :: ${check.label}`;
    })
  ].join('\n');
}

module.exports = {
  resolveProductionReadinessReviewPath,
  buildProductionReadinessReview,
  writeProductionReadinessReview,
  formatProductionReadinessReview,
  computeReadinessScore,
  classifyReadiness
};
