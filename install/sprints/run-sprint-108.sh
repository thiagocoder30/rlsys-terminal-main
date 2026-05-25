#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-108-paper-runtime-24h-supervision-trial"
COMMIT_MSG="feat(runtime): add paper runtime 24h supervision trial"

SPRINT_ID="108"
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

echo "== RL.SYS CORE :: Sprint 108 =="
echo "== Paper Runtime 24h Supervision Trial =="

[ -d .git ] || {
  echo "Execute na raiz do repositório"
  exit 1
}

echo "== Sincronizando repositório =="

git fetch origin main

git checkout main
git reset --hard origin/main

echo "== Validando dependências =="

REQUIRED_FILES=(
  "scripts/paper-runtime-ledger-service.js"
  "scripts/paper-runtime-operator-discipline-guard.js"
  "scripts/paper-runtime-daily-operation-service.js"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "ERRO: dependência ausente -> $file"
    exit 1
  fi
done

echo "== Criando branch Sprint 108 =="

git branch -D "$BRANCH" 2>/dev/null || true
git checkout -b "$BRANCH"

mkdir -p scripts tests data/paper-runtime

cat > scripts/paper-runtime-24h-supervision-service.js <<'EOF'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  buildDailyOperationSnapshot
} = require('./paper-runtime-daily-operation-service');

const {
  resolveLedgerPath,
  readLedger,
  appendLedgerEntry
} = require('./paper-runtime-ledger-service');

const {
  resolveDisciplineStatePath,
  readDisciplineState
} = require('./paper-runtime-operator-discipline-guard');

function resolveTrialReportPath() {
  return process.env.RLSYS_PAPER_RUNTIME_24H_REPORT_PATH ||
    path.join(
      process.cwd(),
      'data',
      'paper-runtime',
      '24h-supervision-report.json'
    );
}

function nowIso() {
  return new Date().toISOString();
}

function simulateOperationalCycle(index) {
  const operation =
    index % 2 === 0
      ? 'WIN'
      : 'LOSS';

  const amount =
    operation === 'WIN'
      ? 2
      : 1;

  appendLedgerEntry(
    operation,
    amount,
    resolveLedgerPath()
  );

  return {
    cycle: index,
    operation,
    amount,
    timestamp: nowIso()
  };
}

function validateRuntimeConsistency() {
  const daily =
    buildDailyOperationSnapshot();

  const ledger =
    readLedger(
      resolveLedgerPath()
    );

  const discipline =
    readDisciplineState(
      resolveDisciplineStatePath()
    );

  return {
    runtimeReady:
      daily.operationalReadiness.ready === true,

    disciplineLocked:
      discipline.lock &&
      discipline.lock.active === true,

    ledgerIntegrity:
      Array.isArray(
        ledger.entries
      ),

    totalEntries:
      Array.isArray(
        ledger.entries
      )
        ? ledger.entries.length
        : 0,

    balance:
      ledger.summary
        ? ledger.summary.balance
        : 0
  };
}

function build24hSupervisionTrial() {
  const cycles = [];

  for (
    let index = 0;
    index < 12;
    index += 1
  ) {
    cycles.push(
      simulateOperationalCycle(index)
    );
  }

  const consistency =
    validateRuntimeConsistency();

  const certified =
    consistency.runtimeReady === true &&
    consistency.ledgerIntegrity === true &&
    consistency.disciplineLocked === false;

  return {
    version: 1,
    generatedAt: nowIso(),
    product: 'RL.SYS CORE',
    runtime: 'PAPER_RUNTIME_24H_SUPERVISION',
    cycles,
    consistency,
    certification: {
      certified,
      recommendation:
        certified
          ? 'READY_FOR_EXTENDED_PAPER_SUPERVISION'
          : 'NOT_READY',
      requiresHumanReview: true,
      productionMoneyAllowed: false
    }
  };
}

function write24hSupervisionTrialReport() {
  const report =
    build24hSupervisionTrial();

  const outputPath =
    resolveTrialReportPath();

  fs.mkdirSync(
    path.dirname(outputPath),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  return {
    ok: true,
    outputPath,
    report
  };
}

function format24hSupervisionTrial(report) {
  return [
    'RL.SYS CORE 24H SUPERVISION TRIAL',
    '============================================================',
    `generatedAt: ${report.generatedAt}`,
    `cycles: ${report.cycles.length}`,
    `runtimeReady: ${report.consistency.runtimeReady}`,
    `ledgerIntegrity: ${report.consistency.ledgerIntegrity}`,
    `disciplineLocked: ${report.consistency.disciplineLocked}`,
    `balance: ${report.consistency.balance}`,
    '',
    'CERTIFICATION',
    `certified: ${report.certification.certified}`,
    `recommendation: ${report.certification.recommendation}`,
    `requiresHumanReview: ${report.certification.requiresHumanReview}`,
    `productionMoneyAllowed: ${report.certification.productionMoneyAllowed}`
  ].join('\n');
}

module.exports = {
  resolveTrialReportPath,
  simulateOperationalCycle,
  validateRuntimeConsistency,
  build24hSupervisionTrial,
  write24hSupervisionTrialReport,
  format24hSupervisionTrial
};
EOF

cat > scripts/paper-runtime-24h-supervision-trial.js <<'EOF'
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
EOF

cat > tests/paper-runtime-24h-supervision-service.test.js <<'EOF'
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
EOF

cat > tests/paper-runtime-24h-supervision-cli.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test(
  'paper runtime 24h supervision cli generates certification report',
  () => {
    const dir =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'rlsys-24h-cli-'
        )
      );

    const outputPath =
      path.join(
        dir,
        '24h-supervision-report.json'
      );

    const result =
      spawnSync(
        process.execPath,
        [
          'scripts/paper-runtime-24h-supervision-trial.js'
        ],
        {
          cwd: path.join(
            __dirname,
            '..'
          ),
          encoding: 'utf8',
          env: {
            ...process.env,
            RLSYS_PAPER_RUNTIME_24H_REPORT_PATH:
              outputPath
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
      /RL\.SYS CORE 24H SUPERVISION TRIAL/
    );

    assert.match(
      output,
      /24h supervision: CERTIFIED/
    );

    assert.equal(
      fs.existsSync(outputPath),
      true
    );
  }
);
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

packageJson.scripts['paper:trial'] =
  'node scripts/paper-runtime-24h-supervision-trial.js';

fs.writeFileSync(
  'package.json',
  `${JSON.stringify(packageJson, null, 2)}\n`,
  'utf8'
);
EOF

echo "== Syntax check =="

node --check \
  scripts/paper-runtime-24h-supervision-service.js

node --check \
  scripts/paper-runtime-24h-supervision-trial.js

echo "== Smoke test =="

TMP_DIR="$(mktemp -d)"

TMP_REPORT="$TMP_DIR/24h-supervision-report.json"

RLSYS_PAPER_RUNTIME_24H_REPORT_PATH="$TMP_REPORT" \
node scripts/paper-runtime-24h-supervision-trial.js \
| tee /tmp/rlsys-s108-smoke.log

grep \
  "RL.SYS CORE 24H SUPERVISION TRIAL" \
  /tmp/rlsys-s108-smoke.log

grep \
  "24h supervision: CERTIFIED" \
  /tmp/rlsys-s108-smoke.log

test -f "$TMP_REPORT"

echo "== Build =="

npm run build

echo "== Tests =="

npm test

git add .

git commit -m "$COMMIT_MSG"

git push -u origin "$BRANCH"

echo "== Mergeando Sprint 108 na main =="

git checkout main
git reset --hard origin/main

git merge --no-ff "$BRANCH" \
  -m "merge: sprint 108 paper runtime 24h supervision trial"

npm run build
npm test

git push origin main

echo ""
echo "== Sprint 108 concluída e mergeada na main =="
