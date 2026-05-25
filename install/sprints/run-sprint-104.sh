#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-104-paper-runtime-ledger-command-wiring"
COMMIT_MSG="feat(runtime): wire paper runtime ledger commands"
SPRINT_ID="104"
RUN_ID="$(date +%Y%m%d-%H%M%S)"

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

echo "== RL.SYS CORE :: Sprint 104 =="
echo "== Paper Runtime Ledger Command Wiring =="

[ -d .git ] || { echo "Execute na raiz do repositório"; exit 1; }

git fetch origin main
git checkout main
git reset --hard origin/main

git branch -D "$BRANCH" 2>/dev/null || true
git checkout -b "$BRANCH"

mkdir -p scripts tests data/paper-runtime

cat > scripts/paper-runtime-ledger-service.js <<'EOF'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolveLedgerPath() {
  const envPath = process.env.RLSYS_PAPER_RUNTIME_LEDGER_PATH || process.env.PAPER_RUNTIME_LEDGER_PATH;

  if (envPath && envPath.trim().length > 0) {
    return envPath;
  }

  return path.join(process.cwd(), 'data', 'paper-runtime', 'paper-ledger.json');
}

function createEmptyLedger() {
  const now = new Date().toISOString();

  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    entries: [],
    summary: {
      wins: 0,
      losses: 0,
      balance: 0,
      peakBalance: 0,
      maxDrawdown: 0,
      totalCommands: 0
    }
  };
}

function readLedger(ledgerPath = resolveLedgerPath()) {
  try {
    if (!fs.existsSync(ledgerPath)) {
      return createEmptyLedger();
    }

    const raw = fs.readFileSync(ledgerPath, 'utf8').trim();

    if (raw.length === 0) {
      return createEmptyLedger();
    }

    const parsed = JSON.parse(raw);

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return createEmptyLedger();
    }

    if (!Array.isArray(parsed.entries)) {
      return createEmptyLedger();
    }

    return parsed;
  } catch {
    return createEmptyLedger();
  }
}

function writeLedger(ledger, ledgerPath = resolveLedgerPath()) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

function parseAmount(value) {
  if (value === undefined || value === null || String(value).trim().length === 0) {
    return 1;
  }

  const parsed = Number(String(value).replace(',', '.'));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function recalculateSummary(entries) {
  let balance = 0;
  let peakBalance = 0;
  let maxDrawdown = 0;
  let wins = 0;
  let losses = 0;

  for (const entry of entries) {
    if (entry.type === 'WIN') {
      balance += entry.amount;
      wins += 1;
    }

    if (entry.type === 'LOSS') {
      balance -= entry.amount;
      losses += 1;
    }

    if (balance > peakBalance) {
      peakBalance = balance;
    }

    const drawdown = peakBalance - balance;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return {
    wins,
    losses,
    balance,
    peakBalance,
    maxDrawdown,
    totalCommands: entries.length
  };
}

function appendLedgerEntry(type, amount, ledgerPath = resolveLedgerPath()) {
  const normalizedType = String(type).toUpperCase();

  if (normalizedType !== 'WIN' && normalizedType !== 'LOSS') {
    return {
      ok: false,
      reason: 'INVALID_LEDGER_ENTRY_TYPE'
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      reason: 'INVALID_LEDGER_AMOUNT'
    };
  }

  const ledger = readLedger(ledgerPath);
  const now = new Date().toISOString();

  ledger.entries.push({
    id: `${now}-${ledger.entries.length + 1}`,
    type: normalizedType,
    amount,
    createdAt: now
  });

  ledger.updatedAt = now;
  ledger.summary = recalculateSummary(ledger.entries);

  writeLedger(ledger, ledgerPath);

  return {
    ok: true,
    ledger
  };
}

function formatLedgerSummary(ledger) {
  const summary = ledger.summary || recalculateSummary(ledger.entries || []);

  return [
    'RL.SYS PAPER LEDGER',
    `wins: ${summary.wins}`,
    `losses: ${summary.losses}`,
    `balance: ${summary.balance}`,
    `peakBalance: ${summary.peakBalance}`,
    `maxDrawdown: ${summary.maxDrawdown}`,
    `totalCommands: ${summary.totalCommands}`
  ].join('\n');
}

module.exports = {
  resolveLedgerPath,
  createEmptyLedger,
  readLedger,
  writeLedger,
  parseAmount,
  recalculateSummary,
  appendLedgerEntry,
  formatLedgerSummary
};
EOF

cat > scripts/paper-runtime-ledger-command-preload.js <<'EOF'
'use strict';

const readline = require('node:readline');
const {
  resolveLedgerPath,
  readLedger,
  parseAmount,
  appendLedgerEntry,
  formatLedgerSummary
} = require('./paper-runtime-ledger-service');

function handlePaperRuntimeLedgerCommand(rawLine) {
  const line = String(rawLine || '').trim();

  if (line.length === 0) {
    return false;
  }

  const [command, amountToken] = line.split(/\s+/);
  const normalized = command.toLowerCase();

  if (normalized === 'win' || normalized === 'loss') {
    const amount = parseAmount(amountToken);

    if (amount === null) {
      console.log('Ledger rejected: invalid amount');
      return true;
    }

    const result = appendLedgerEntry(normalized === 'win' ? 'WIN' : 'LOSS', amount);

    if (!result.ok) {
      console.log(`Ledger rejected: ${result.reason}`);
      return true;
    }

    console.log(`Ledger recorded: ${normalized.toUpperCase()} ${amount}`);
    console.log(formatLedgerSummary(result.ledger));
    return true;
  }

  if (normalized === 'ledger' || normalized === 'bankroll') {
    const ledger = readLedger(resolveLedgerPath());
    console.log(formatLedgerSummary(ledger));
    return true;
  }

  return false;
}

function installPaperRuntimeLedgerCommandPreload() {
  if (globalThis.__rlsysPaperRuntimeLedgerPreloadInstalled === true) {
    return;
  }

  globalThis.__rlsysPaperRuntimeLedgerPreloadInstalled = true;

  const originalCreateInterface = readline.createInterface.bind(readline);

  readline.createInterface = function patchedCreateInterface(...args) {
    const rl = originalCreateInterface(...args);
    const originalOn = rl.on.bind(rl);

    rl.on = function patchedOn(eventName, listener) {
      if (eventName !== 'line') {
        return originalOn(eventName, listener);
      }

      return originalOn('line', function wrappedLineListener(line) {
        if (handlePaperRuntimeLedgerCommand(line)) {
          return undefined;
        }

        return listener.call(this, line);
      });
    };

    return rl;
  };
}

installPaperRuntimeLedgerCommandPreload();

module.exports = {
  handlePaperRuntimeLedgerCommand,
  installPaperRuntimeLedgerCommandPreload
};
EOF

python3 <<'PY'
from pathlib import Path

target = Path("scripts/paper-runtime-session.js")

if not target.exists():
    raise SystemExit("ERROR: scripts/paper-runtime-session.js não encontrado")

text = target.read_text()

if "__paperRuntimeRecoveryResult" in text:
    raise SystemExit("ERROR: resíduo quebrado da Sprint 103 encontrado")

preload = "require('./paper-runtime-ledger-command-preload');"

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

cat > tests/paper-runtime-ledger-service.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  appendLedgerEntry,
  readLedger,
  parseAmount,
  formatLedgerSummary
} = require('../scripts/paper-runtime-ledger-service');

function tempLedgerPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-ledger-'));
  return path.join(dir, 'paper-ledger.json');
}

test('parseAmount accepts positive numeric values and defaults to one', () => {
  assert.equal(parseAmount(undefined), 1);
  assert.equal(parseAmount('10'), 10);
  assert.equal(parseAmount('2,5'), 2.5);
  assert.equal(parseAmount('-1'), null);
  assert.equal(parseAmount('abc'), null);
});

test('appendLedgerEntry records wins losses balance and drawdown', () => {
  const ledgerPath = tempLedgerPath();

  assert.equal(appendLedgerEntry('WIN', 10, ledgerPath).ok, true);
  assert.equal(appendLedgerEntry('LOSS', 4, ledgerPath).ok, true);
  assert.equal(appendLedgerEntry('LOSS', 9, ledgerPath).ok, true);

  const ledger = readLedger(ledgerPath);

  assert.equal(ledger.summary.wins, 1);
  assert.equal(ledger.summary.losses, 2);
  assert.equal(ledger.summary.balance, -3);
  assert.equal(ledger.summary.peakBalance, 10);
  assert.equal(ledger.summary.maxDrawdown, 13);
  assert.equal(ledger.summary.totalCommands, 3);

  assert.match(formatLedgerSummary(ledger), /RL\.SYS PAPER LEDGER/);
});
EOF

cat > tests/paper-runtime-ledger-command-preload.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { handlePaperRuntimeLedgerCommand } = require('../scripts/paper-runtime-ledger-command-preload');

test('handlePaperRuntimeLedgerCommand handles win loss ledger and bankroll commands', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-ledger-command-'));
  const ledgerPath = path.join(dir, 'paper-ledger.json');

  process.env.RLSYS_PAPER_RUNTIME_LEDGER_PATH = ledgerPath;

  assert.equal(handlePaperRuntimeLedgerCommand('win 5'), true);
  assert.equal(handlePaperRuntimeLedgerCommand('loss 2'), true);
  assert.equal(handlePaperRuntimeLedgerCommand('ledger'), true);
  assert.equal(handlePaperRuntimeLedgerCommand('bankroll'), true);
  assert.equal(handlePaperRuntimeLedgerCommand('status'), false);

  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));

  delete process.env.RLSYS_PAPER_RUNTIME_LEDGER_PATH;

  assert.equal(ledger.summary.wins, 1);
  assert.equal(ledger.summary.losses, 1);
  assert.equal(ledger.summary.balance, 3);
});
EOF

cat > tests/paper-runtime-session-ledger-command.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('paper runtime session wires win loss ledger and bankroll commands', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-session-ledger-'));
  const ledgerPath = path.join(dir, 'paper-ledger.json');

  const result = spawnSync(process.execPath, ['scripts/paper-runtime-session.js'], {
    cwd: path.join(__dirname, '..'),
    input: 'win 10\nloss 3\nledger\nbankroll\nexit\n',
    encoding: 'utf8',
    env: {
      ...process.env,
      RLSYS_PAPER_RUNTIME_LEDGER_PATH: ledgerPath
    }
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;

  assert.equal(result.status, 0, output);
  assert.match(output, /Ledger recorded: WIN 10/);
  assert.match(output, /Ledger recorded: LOSS 3/);
  assert.match(output, /RL\.SYS PAPER LEDGER/);
  assert.match(output, /balance: 7/);

  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));

  assert.equal(ledger.summary.wins, 1);
  assert.equal(ledger.summary.losses, 1);
  assert.equal(ledger.summary.balance, 7);
});
EOF

echo "== Validando preload =="
grep -q "paper-runtime-ledger-command-preload" scripts/paper-runtime-session.js
grep -q "readline" scripts/paper-runtime-session.js

echo "== Syntax check =="
node --check scripts/paper-runtime-ledger-service.js
node --check scripts/paper-runtime-ledger-command-preload.js
node --check scripts/paper-runtime-session.js

echo "== Smoke test ledger =="
TMP_DIR="$(mktemp -d)"
TMP_LEDGER="$TMP_DIR/paper-ledger.json"

printf 'win 10\nloss 3\nledger\nexit\n' | RLSYS_PAPER_RUNTIME_LEDGER_PATH="$TMP_LEDGER" node scripts/paper-runtime-session.js | tee /tmp/rlsys-s104-smoke.log

grep "Ledger recorded: WIN 10" /tmp/rlsys-s104-smoke.log
grep "Ledger recorded: LOSS 3" /tmp/rlsys-s104-smoke.log
grep "balance: 7" /tmp/rlsys-s104-smoke.log

echo "== Build =="
npm run build

echo "== Tests =="
npm test

git add .
git commit -m "$COMMIT_MSG"
git push -u origin "$BRANCH"

echo ""
echo "== Sprint 104 concluída com sucesso =="
echo "Branch: $BRANCH"
echo "Commit: $COMMIT_MSG"
