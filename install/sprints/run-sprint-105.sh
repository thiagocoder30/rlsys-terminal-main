#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-105-paper-runtime-session-report"
COMMIT_MSG="feat(runtime): add paper runtime session report"
SPRINT_ID="105"
RUN_ID="$(date +%Y%m%d-%H%M%S)"

DEPENDENCY_BRANCH="sprint-104-paper-runtime-ledger-command-wiring"

mkdir -p logs /sdcard/Download 2>/dev/null || true
LOG_FILE="logs/rlsys-install-sprint-${SPRINT_ID}-${RUN_ID}.log"
DOWNLOAD_LOG_FILE="/sdcard/Download/rlsys-install-sprint-${SPRINT_ID}-${RUN_ID}.log"

exec > >(tee -a "$LOG_FILE" "$DOWNLOAD_LOG_FILE" 2>/dev/null || tee -a "$LOG_FILE") 2>&1

finish() {
  code="$?"
  echo ""
  echo "============================================================"
  [ "$code" -eq 0 ] && echo "Sprint ${SPRINT_ID} SUCESSO" || echo "Sprint ${SPRINT_ID} FALHOU"
  echo "Status: $code"
  echo "Log local: $LOG_FILE"
  echo "Log Download: $DOWNLOAD_LOG_FILE"
  echo "============================================================"
  exit "$code"
}
trap finish EXIT

echo "== RL.SYS CORE :: Sprint 105 =="
echo "== Paper Runtime Session Report =="
echo "Run ID: $RUN_ID"

[ -d .git ] || { echo "Execute na raiz do repositório"; exit 1; }

echo "== Sincronizando repositório =="
git fetch origin main "$DEPENDENCY_BRANCH" || true

echo "== Preparando main =="
git checkout main
git reset --hard origin/main

if [ ! -f scripts/paper-runtime-ledger-service.js ]; then
  echo "== Dependência Sprint 104 ausente na main; mergeando ${DEPENDENCY_BRANCH} =="
  git merge --no-ff "origin/${DEPENDENCY_BRANCH}" -m "merge: sprint 104 paper runtime ledger command wiring"
  npm run build
  npm test
  git push origin main
fi

echo "== Criando branch Sprint 105 =="
git branch -D "$BRANCH" 2>/dev/null || true
git checkout -b "$BRANCH"

mkdir -p scripts tests data/paper-runtime

cat > scripts/paper-runtime-session-report-service.js <<'EOF'
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  resolveLedgerPath,
  readLedger,
  formatLedgerSummary
} = require('./paper-runtime-ledger-service');

function resolveReportJsonPath() {
  return process.env.RLSYS_PAPER_RUNTIME_REPORT_JSON_PATH ||
    path.join(process.cwd(), 'data', 'paper-runtime', 'session-report.json');
}

function resolveReportTextPath() {
  return process.env.RLSYS_PAPER_RUNTIME_REPORT_TEXT_PATH ||
    path.join(process.cwd(), 'data', 'paper-runtime', 'session-report.txt');
}

function resolveSnapshotPath() {
  return process.env.RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH ||
    path.join(process.cwd(), 'data', 'paper-runtime', 'session-snapshot.json');
}

function readJsonSafely(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, 'utf8').trim();

    if (raw.length === 0) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function classifySessionOutcome(summary) {
  if (!summary || typeof summary.balance !== 'number') {
    return 'UNKNOWN';
  }

  if (summary.balance > 0) {
    return 'PAPER_PROFIT';
  }

  if (summary.balance < 0) {
    return 'PAPER_LOSS';
  }

  return 'PAPER_FLAT';
}

function buildPaperRuntimeSessionReport() {
  const now = new Date().toISOString();
  const ledgerPath = resolveLedgerPath();
  const snapshotPath = resolveSnapshotPath();

  const ledger = readLedger(ledgerPath);
  const snapshot = readJsonSafely(snapshotPath);

  const summary = ledger.summary || {
    wins: 0,
    losses: 0,
    balance: 0,
    peakBalance: 0,
    maxDrawdown: 0,
    totalCommands: 0
  };

  return {
    version: 1,
    generatedAt: now,
    product: 'RL.SYS CORE',
    runtime: 'paper-runtime',
    reportType: 'SESSION_REPORT',
    session: {
      snapshotPath,
      snapshotAvailable: snapshot !== null,
      sessionId: snapshot && snapshot.sessionId ? snapshot.sessionId : null,
      state: snapshot && (snapshot.state || snapshot.status || snapshot.sessionState)
        ? String(snapshot.state || snapshot.status || snapshot.sessionState)
        : 'UNKNOWN',
      recovery: snapshot && snapshot.recovery ? snapshot.recovery : null
    },
    ledger: {
      ledgerPath,
      entries: Array.isArray(ledger.entries) ? ledger.entries : [],
      summary
    },
    risk: {
      outcome: classifySessionOutcome(summary),
      maxDrawdown: summary.maxDrawdown,
      balance: summary.balance,
      requiresHumanReview: true,
      productionMoneyAllowed: false
    },
    audit: {
      generatedBy: 'PaperRuntimeSessionReportService',
      humanReadableReport: resolveReportTextPath()
    }
  };
}

function formatPaperRuntimeSessionReportText(report) {
  const summary = report.ledger.summary;

  return [
    'RL.SYS CORE — PAPER RUNTIME SESSION REPORT',
    '============================================================',
    `Generated at: ${report.generatedAt}`,
    `Runtime: ${report.runtime}`,
    `Session ID: ${report.session.sessionId || 'N/A'}`,
    `Session state: ${report.session.state}`,
    '',
    'LEDGER',
    '------------------------------------------------------------',
    formatLedgerSummary({
      entries: report.ledger.entries,
      summary
    }),
    '',
    'RISK',
    '------------------------------------------------------------',
    `Outcome: ${report.risk.outcome}`,
    `Balance: ${report.risk.balance}`,
    `Max drawdown: ${report.risk.maxDrawdown}`,
    `Requires human review: ${report.risk.requiresHumanReview}`,
    `Production money allowed: ${report.risk.productionMoneyAllowed}`,
    '',
    'OPERATIONAL NOTE',
    '------------------------------------------------------------',
    'Este relatório é paper/supervisionado. Ele não autoriza operação com dinheiro real.',
    'O objetivo do RL.SYS CORE é proteção de banca, disciplina operacional e rastreabilidade.',
    ''
  ].join('\n');
}

function writePaperRuntimeSessionReport() {
  const report = buildPaperRuntimeSessionReport();
  const jsonPath = resolveReportJsonPath();
  const textPath = resolveReportTextPath();

  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(textPath), { recursive: true });

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(textPath, `${formatPaperRuntimeSessionReportText(report)}\n`, 'utf8');

  return {
    ok: true,
    report,
    jsonPath,
    textPath
  };
}

module.exports = {
  resolveReportJsonPath,
  resolveReportTextPath,
  buildPaperRuntimeSessionReport,
  formatPaperRuntimeSessionReportText,
  writePaperRuntimeSessionReport,
  classifySessionOutcome
};
EOF

cat > scripts/paper-runtime-session-report-preload.js <<'EOF'
'use strict';

const readline = require('node:readline');
const {
  writePaperRuntimeSessionReport
} = require('./paper-runtime-session-report-service');

function printReportResult(result) {
  console.log('Paper runtime session report generated');
  console.log(`Report JSON: ${result.jsonPath}`);
  console.log(`Report TXT: ${result.textPath}`);
}

function handlePaperRuntimeSessionReportCommand(rawLine) {
  const line = String(rawLine || '').trim().toLowerCase();

  if (line !== 'report' && line !== 'finish') {
    return false;
  }

  const result = writePaperRuntimeSessionReport();
  printReportResult(result);

  return line === 'report';
}

function installPaperRuntimeSessionReportPreload() {
  if (globalThis.__rlsysPaperRuntimeReportPreloadInstalled === true) {
    return;
  }

  globalThis.__rlsysPaperRuntimeReportPreloadInstalled = true;

  const originalCreateInterface = readline.createInterface.bind(readline);

  readline.createInterface = function patchedCreateInterface(...args) {
    const rl = originalCreateInterface(...args);
    const originalOn = rl.on.bind(rl);

    rl.on = function patchedOn(eventName, listener) {
      if (eventName !== 'line') {
        return originalOn(eventName, listener);
      }

      return originalOn('line', function wrappedLineListener(line) {
        const consumed = handlePaperRuntimeSessionReportCommand(line);

        if (consumed) {
          return undefined;
        }

        return listener.call(this, line);
      });
    };

    return rl;
  };
}

installPaperRuntimeSessionReportPreload();

module.exports = {
  handlePaperRuntimeSessionReportCommand,
  installPaperRuntimeSessionReportPreload
};
EOF

python3 <<'PY'
from pathlib import Path

target = Path("scripts/paper-runtime-session.js")

if not target.exists():
    raise SystemExit("ERROR: scripts/paper-runtime-session.js não encontrado")

text = target.read_text()

if "__paperRuntimeRecoveryResult" in text:
    raise SystemExit("ERROR: resíduo quebrado antigo encontrado em paper-runtime-session.js")

preload = "require('./paper-runtime-session-report-preload');"

if preload not in text:
    lines = text.splitlines()
    insert_index = 0

    if lines and lines[0].startswith("#!"):
        insert_index = 1

    if insert_index < len(lines) and lines[insert_index].strip() in ("'use strict';", '"use strict";'):
        insert_index += 1
    else:
        lines.insert(insert_index, "'use strict';")
        insert_index += 1

    lines.insert(insert_index, preload)
    text = "\n".join(lines).rstrip() + "\n"

target.write_text(text)
PY

cat > tests/paper-runtime-session-report-service.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  appendLedgerEntry
} = require('../scripts/paper-runtime-ledger-service');

const {
  writePaperRuntimeSessionReport,
  classifySessionOutcome
} = require('../scripts/paper-runtime-session-report-service');

test('classifySessionOutcome classifies paper result defensively', () => {
  assert.equal(classifySessionOutcome({ balance: 10 }), 'PAPER_PROFIT');
  assert.equal(classifySessionOutcome({ balance: -1 }), 'PAPER_LOSS');
  assert.equal(classifySessionOutcome({ balance: 0 }), 'PAPER_FLAT');
  assert.equal(classifySessionOutcome({}), 'UNKNOWN');
});

test('writePaperRuntimeSessionReport writes json and text reports', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-report-'));
  const ledgerPath = path.join(dir, 'paper-ledger.json');
  const jsonPath = path.join(dir, 'session-report.json');
  const textPath = path.join(dir, 'session-report.txt');

  process.env.RLSYS_PAPER_RUNTIME_LEDGER_PATH = ledgerPath;
  process.env.RLSYS_PAPER_RUNTIME_REPORT_JSON_PATH = jsonPath;
  process.env.RLSYS_PAPER_RUNTIME_REPORT_TEXT_PATH = textPath;

  appendLedgerEntry('WIN', 10, ledgerPath);
  appendLedgerEntry('LOSS', 4, ledgerPath);

  const result = writePaperRuntimeSessionReport();

  delete process.env.RLSYS_PAPER_RUNTIME_LEDGER_PATH;
  delete process.env.RLSYS_PAPER_RUNTIME_REPORT_JSON_PATH;
  delete process.env.RLSYS_PAPER_RUNTIME_REPORT_TEXT_PATH;

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(jsonPath), true);
  assert.equal(fs.existsSync(textPath), true);

  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const text = fs.readFileSync(textPath, 'utf8');

  assert.equal(json.ledger.summary.balance, 6);
  assert.equal(json.risk.productionMoneyAllowed, false);
  assert.match(text, /PAPER RUNTIME SESSION REPORT/);
  assert.match(text, /Production money allowed: false/);
});
EOF

cat > tests/paper-runtime-session-report-preload.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  appendLedgerEntry
} = require('../scripts/paper-runtime-ledger-service');

const {
  handlePaperRuntimeSessionReportCommand
} = require('../scripts/paper-runtime-session-report-preload');

test('handlePaperRuntimeSessionReportCommand consumes report and allows finish to continue', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-report-command-'));
  const ledgerPath = path.join(dir, 'paper-ledger.json');
  const jsonPath = path.join(dir, 'session-report.json');
  const textPath = path.join(dir, 'session-report.txt');

  process.env.RLSYS_PAPER_RUNTIME_LEDGER_PATH = ledgerPath;
  process.env.RLSYS_PAPER_RUNTIME_REPORT_JSON_PATH = jsonPath;
  process.env.RLSYS_PAPER_RUNTIME_REPORT_TEXT_PATH = textPath;

  appendLedgerEntry('WIN', 5, ledgerPath);

  assert.equal(handlePaperRuntimeSessionReportCommand('report'), true);
  assert.equal(fs.existsSync(jsonPath), true);

  assert.equal(handlePaperRuntimeSessionReportCommand('finish'), false);
  assert.equal(fs.existsSync(textPath), true);

  delete process.env.RLSYS_PAPER_RUNTIME_LEDGER_PATH;
  delete process.env.RLSYS_PAPER_RUNTIME_REPORT_JSON_PATH;
  delete process.env.RLSYS_PAPER_RUNTIME_REPORT_TEXT_PATH;
});
EOF

cat > tests/paper-runtime-session-report-integration.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('paper runtime generates session report on finish', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-session-report-'));
  const ledgerPath = path.join(dir, 'paper-ledger.json');
  const jsonPath = path.join(dir, 'session-report.json');
  const textPath = path.join(dir, 'session-report.txt');

  const result = spawnSync(process.execPath, ['scripts/paper-runtime-session.js'], {
    cwd: path.join(__dirname, '..'),
    input: 'win 10\nloss 3\nfinish\n',
    encoding: 'utf8',
    env: {
      ...process.env,
      RLSYS_PAPER_RUNTIME_LEDGER_PATH: ledgerPath,
      RLSYS_PAPER_RUNTIME_REPORT_JSON_PATH: jsonPath,
      RLSYS_PAPER_RUNTIME_REPORT_TEXT_PATH: textPath
    }
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;

  assert.equal(result.status, 0, output);
  assert.match(output, /Paper runtime session report generated/);
  assert.equal(fs.existsSync(jsonPath), true);
  assert.equal(fs.existsSync(textPath), true);

  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  assert.equal(report.ledger.summary.balance, 7);
  assert.equal(report.risk.productionMoneyAllowed, false);
});
EOF

echo "== Validando integração =="
grep -q "paper-runtime-session-report-preload" scripts/paper-runtime-session.js
grep -q "paper-runtime-ledger-command-preload" scripts/paper-runtime-session.js
grep -q "readline" scripts/paper-runtime-session.js

echo "== Syntax check =="
node --check scripts/paper-runtime-session-report-service.js
node --check scripts/paper-runtime-session-report-preload.js
node --check scripts/paper-runtime-session.js

echo "== Smoke test report =="
TMP_DIR="$(mktemp -d)"
TMP_LEDGER="$TMP_DIR/paper-ledger.json"
TMP_REPORT_JSON="$TMP_DIR/session-report.json"
TMP_REPORT_TXT="$TMP_DIR/session-report.txt"

printf 'win 10\nloss 3\nfinish\n' | \
  RLSYS_PAPER_RUNTIME_LEDGER_PATH="$TMP_LEDGER" \
  RLSYS_PAPER_RUNTIME_REPORT_JSON_PATH="$TMP_REPORT_JSON" \
  RLSYS_PAPER_RUNTIME_REPORT_TEXT_PATH="$TMP_REPORT_TXT" \
  node scripts/paper-runtime-session.js | tee /tmp/rlsys-s105-smoke.log

grep "Paper runtime session report generated" /tmp/rlsys-s105-smoke.log
test -f "$TMP_REPORT_JSON"
test -f "$TMP_REPORT_TXT"

echo "== Build =="
npm run build

echo "== Tests na branch Sprint 105 =="
npm test

git add .
git commit -m "$COMMIT_MSG"
git push -u origin "$BRANCH"

echo "== Mergeando Sprint 105 na main com validação =="
git checkout main
git reset --hard origin/main
git merge --no-ff "$BRANCH" -m "merge: sprint 105 paper runtime session report"

npm run build
npm test

git push origin main

echo ""
echo "== Sprint 105 concluída e mergeada na main =="
echo "Branch: $BRANCH"
echo "Commit: $COMMIT_MSG"
