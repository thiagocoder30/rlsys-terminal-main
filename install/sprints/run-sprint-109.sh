#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-109-production-readiness-review"
COMMIT_MSG="feat(runtime): add production readiness review"

SPRINT_ID="109"
RUN_ID="$(date +%Y%m%d-%H%M%S)"

mkdir -p logs /sdcard/Download 2>/dev/null || true

LOG_FILE="logs/rlsys-install-sprint-${SPRINT_ID}-${RUN_ID}.log"
DOWNLOAD_LOG_FILE="/sdcard/Download/rlsys-install-sprint-${SPRINT_ID}-${RUN_ID}.log"

exec > >(tee -a "$LOG_FILE" "$DOWNLOAD_LOG_FILE" 2>/dev/null || tee -a "$LOG_FILE") 2>&1

finish() {
  code="$?"

  echo ""
  echo "============================================================"

  if [ "$code" -eq 0 ]; then
    echo "Sprint ${SPRINT_ID} SUCESSO"
  else
    echo "Sprint ${SPRINT_ID} FALHOU"
  fi

  echo "Status: $code"
  echo "Log local: $LOG_FILE"
  echo "Log Download: $DOWNLOAD_LOG_FILE"
  echo "============================================================"

  exit "$code"
}

trap finish EXIT

echo "== RL.SYS CORE :: Sprint 109 =="
echo "== Production Readiness Review =="

[ -d .git ] || {
  echo "Execute na raiz do repositório"
  exit 1
}

git fetch origin main
git checkout main
git reset --hard origin/main

echo "== Validando dependências =="

REQUIRED_FILES=(
  "scripts/paper-runtime-ledger-service.js"
  "scripts/paper-runtime-operator-discipline-guard.js"
  "scripts/paper-runtime-daily-operation-service.js"
  "scripts/paper-runtime-24h-supervision-service.js"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "ERRO: dependência ausente -> $file"
    exit 1
  fi
done

git branch -D "$BRANCH" 2>/dev/null || true
git checkout -b "$BRANCH"

mkdir -p scripts tests data/paper-runtime

cat > scripts/production-readiness-review-service.js <<'EOF'
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
EOF

cat > scripts/production-readiness-review.js <<'EOF'
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
EOF

cat > tests/production-readiness-review-service.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  computeReadinessScore,
  classifyReadiness,
  writeProductionReadinessReview
} = require('../scripts/production-readiness-review-service');

test('computeReadinessScore computes integer percentage', () => {
  assert.equal(
    computeReadinessScore([
      { passed: true },
      { passed: true },
      { passed: false },
      { passed: true }
    ]),
    75
  );
});

test('classifyReadiness blocks critical failures', () => {
  assert.equal(
    classifyReadiness(100, true),
    'BLOCKED'
  );

  assert.equal(
    classifyReadiness(95, false),
    'PAPER_READY'
  );

  assert.equal(
    classifyReadiness(80, false),
    'NEEDS_REVIEW'
  );
});

test('writeProductionReadinessReview writes defensive review', () => {
  const dir =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'rlsys-readiness-'
      )
    );

  const outputPath =
    path.join(
      dir,
      'production-readiness-review.json'
    );

  process.env.RLSYS_PRODUCTION_READINESS_REVIEW_PATH =
    outputPath;

  const result =
    writeProductionReadinessReview();

  delete process.env.RLSYS_PRODUCTION_READINESS_REVIEW_PATH;

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(result.review.decision.productionMoneyAllowed, false);
  assert.equal(result.review.decision.liveOperationAllowed, false);
  assert.equal(result.review.decision.requiresHumanReview, true);
});
EOF

cat > tests/production-readiness-review-cli.test.js <<'EOF'
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
EOF

echo "== Atualizando package.json =="

node <<'EOF'
const fs = require('node:fs');

const packageJson =
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  );

packageJson.scripts =
  packageJson.scripts || {};

packageJson.scripts['paper:readiness'] =
  'node scripts/production-readiness-review.js';

fs.writeFileSync(
  'package.json',
  `${JSON.stringify(packageJson, null, 2)}\n`,
  'utf8'
);
EOF

echo "== Syntax check =="

node --check scripts/production-readiness-review-service.js
node --check scripts/production-readiness-review.js

echo "== Smoke test =="

TMP_DIR="$(mktemp -d)"
TMP_REVIEW="$TMP_DIR/production-readiness-review.json"

RLSYS_PRODUCTION_READINESS_REVIEW_PATH="$TMP_REVIEW" \
node scripts/production-readiness-review.js \
| tee /tmp/rlsys-s109-smoke.log

grep "RL.SYS CORE PRODUCTION READINESS REVIEW" /tmp/rlsys-s109-smoke.log
grep "production readiness: LIVE MONEY BLOCKED" /tmp/rlsys-s109-smoke.log
test -f "$TMP_REVIEW"

echo "== Build =="

npm run build

echo "== Tests =="

npm test

git add .
git commit -m "$COMMIT_MSG"

git push -u origin "$BRANCH"

echo "== Mergeando Sprint 109 na main =="

git checkout main
git reset --hard origin/main

git merge --no-ff "$BRANCH" \
  -m "merge: sprint 109 production readiness review"

npm run build
npm test

git push origin main

echo ""
echo "== Sprint 109 concluída e mergeada na main =="
