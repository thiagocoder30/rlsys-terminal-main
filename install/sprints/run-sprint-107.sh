#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-107-paper-runtime-daily-operation-mode"
COMMIT_MSG="feat(runtime): add paper runtime daily operation mode"

SPRINT_ID="107"
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

echo "== RL.SYS CORE :: Sprint 107 =="
echo "== Paper Runtime Daily Operation Mode =="

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
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "ERRO: dependência ausente -> $file"
    exit 1
  fi
done

echo "== Criando branch da Sprint =="

git branch -D "$BRANCH" 2>/dev/null || true
git checkout -b "$BRANCH"

mkdir -p scripts tests data/paper-runtime

cat > scripts/paper-runtime-daily-operation-service.js <<'EOF'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  resolveLedgerPath,
  readLedger
} = require('./paper-runtime-ledger-service');

const {
  resolveDisciplineStatePath,
  readDisciplineState
} = require('./paper-runtime-operator-discipline-guard');

function resolveDailyOperationPath() {
  return process.env.RLSYS_PAPER_RUNTIME_DAILY_OPERATION_PATH ||
    path.join(
      process.cwd(),
      'data',
      'paper-runtime',
      'daily-operation.json'
    );
}

function nowIso() {
  return new Date().toISOString();
}

function readJsonSafely(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(
      filePath,
      'utf8'
    ).trim();

    if (raw.length === 0) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function validateRuntimeEnvironment() {
  return {
    ok: true,
    nodeVersion: process.version,
    cwd: process.cwd(),
    timestamp: nowIso()
  };
}

function validateLedgerState() {
  const ledgerPath = resolveLedgerPath();
  const ledger = readLedger(ledgerPath);

  return {
    ok: true,
    ledgerPath,
    summary: ledger.summary || {
      wins: 0,
      losses: 0,
      balance: 0,
      maxDrawdown: 0
    }
  };
}

function validateDisciplineState() {
  const disciplinePath =
    resolveDisciplineStatePath();

  const discipline =
    readDisciplineState(disciplinePath);

  return {
    ok: true,
    disciplinePath,
    lock:
      discipline.lock || {
        active: false
      },
    warnings:
      Array.isArray(
        discipline.warnings
      )
        ? discipline.warnings.slice(-10)
        : []
  };
}

function buildDailyOperationSnapshot() {
  const runtime =
    validateRuntimeEnvironment();

  const ledger =
    validateLedgerState();

  const discipline =
    validateDisciplineState();

  const snapshot = {
    version: 1,
    generatedAt: nowIso(),
    product: 'RL.SYS CORE',
    mode: 'PAPER_RUNTIME_DAILY_OPERATION',
    runtime,
    ledger,
    discipline,
    operationalReadiness: {
      ready:
        runtime.ok &&
        ledger.ok &&
        discipline.ok &&
        !discipline.lock.active,
      blockedByDiscipline:
        discipline.lock.active === true
    }
  };

  return snapshot;
}

function writeDailyOperationSnapshot() {
  const snapshot =
    buildDailyOperationSnapshot();

  const outputPath =
    resolveDailyOperationPath();

  fs.mkdirSync(
    path.dirname(outputPath),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    'utf8'
  );

  return {
    ok: true,
    outputPath,
    snapshot
  };
}

function formatDailyOperationSnapshot(snapshot) {
  return [
    'RL.SYS CORE DAILY OPERATION',
    '============================================================',
    `generatedAt: ${snapshot.generatedAt}`,
    `ready: ${snapshot.operationalReadiness.ready}`,
    `blockedByDiscipline: ${snapshot.operationalReadiness.blockedByDiscipline}`,
    '',
    'LEDGER',
    `balance: ${snapshot.ledger.summary.balance}`,
    `wins: ${snapshot.ledger.summary.wins}`,
    `losses: ${snapshot.ledger.summary.losses}`,
    `maxDrawdown: ${snapshot.ledger.summary.maxDrawdown}`,
    '',
    'DISCIPLINE',
    `lockActive: ${snapshot.discipline.lock.active}`,
    `warnings: ${snapshot.discipline.warnings.length}`
  ].join('\n');
}

module.exports = {
  resolveDailyOperationPath,
  validateRuntimeEnvironment,
  validateLedgerState,
  validateDisciplineState,
  buildDailyOperationSnapshot,
  writeDailyOperationSnapshot,
  formatDailyOperationSnapshot
};
EOF

cat > scripts/paper-runtime-daily-operation-cli.js <<'EOF'
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
EOF

cat > tests/paper-runtime-daily-operation-service.test.js <<'EOF'
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
EOF

cat > tests/paper-runtime-daily-operation-cli.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test(
  'paper runtime daily operation cli generates operational snapshot',
  () => {
    const dir =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'rlsys-daily-cli-'
        )
      );

    const outputPath =
      path.join(
        dir,
        'daily-operation.json'
      );

    const result =
      spawnSync(
        process.execPath,
        [
          'scripts/paper-runtime-daily-operation-cli.js'
        ],
        {
          cwd: path.join(
            __dirname,
            '..'
          ),
          encoding: 'utf8',
          env: {
            ...process.env,
            RLSYS_PAPER_RUNTIME_DAILY_OPERATION_PATH:
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
      /RL\.SYS CORE DAILY OPERATION/
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

packageJson.scripts['paper:daily'] =
  'node scripts/paper-runtime-daily-operation-cli.js';

fs.writeFileSync(
  'package.json',
  `${JSON.stringify(packageJson, null, 2)}\n`,
  'utf8'
);
EOF

echo "== Syntax check =="

node --check \
  scripts/paper-runtime-daily-operation-service.js

node --check \
  scripts/paper-runtime-daily-operation-cli.js

echo "== Smoke test =="

TMP_DIR="$(mktemp -d)"

TMP_DAILY="$TMP_DIR/daily-operation.json"

RLSYS_PAPER_RUNTIME_DAILY_OPERATION_PATH="$TMP_DAILY" \
node scripts/paper-runtime-daily-operation-cli.js \
| tee /tmp/rlsys-s107-smoke.log

grep \
  "RL.SYS CORE DAILY OPERATION" \
  /tmp/rlsys-s107-smoke.log

grep \
  "daily operation: READY" \
  /tmp/rlsys-s107-smoke.log

test -f "$TMP_DAILY"

echo "== Build =="

npm run build

echo "== Tests =="

npm test

git add .

git commit -m "$COMMIT_MSG"

git push -u origin "$BRANCH"

echo "== Mergeando Sprint 107 na main =="

git checkout main
git reset --hard origin/main

git merge --no-ff "$BRANCH" \
  -m "merge: sprint 107 paper runtime daily operation mode"

npm run build
npm test

git push origin main

echo ""
echo "== Sprint 107 concluída e mergeada na main =="
