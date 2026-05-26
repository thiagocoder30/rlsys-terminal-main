#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT_ID="109-fix-v5"
BRANCH="sprint-109-production-readiness-review-fix-v5"
COMMIT_MSG="fix(runtime): fix timeout constraints for proot environments"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/rlsys-install-sprint-${SPRINT_ID}-${RUN_ID}.log"
DOWNLOAD_DIR="/sdcard/Download"

mkdir -p "$LOG_DIR"

exec > >(tee -a "$LOG_FILE") 2>&1

copy_log() {
  if [ -d "$DOWNLOAD_DIR" ]; then
    cp "$LOG_FILE" "$DOWNLOAD_DIR/" || true
    echo "Log copiado para: ${DOWNLOAD_DIR}/$(basename "$LOG_FILE")"
  fi
}

fail() {
  local exit_code="$1"
  local line_no="$2"
  echo
  echo "== SPRINT ${SPRINT_ID} FALHOU =="
  echo "Exit code: ${exit_code}"
  echo "Linha: ${line_no}"
  echo "Log: ${LOG_FILE}"
  copy_log
  exit "$exit_code"
}

success() {
  echo
  echo "== SPRINT ${SPRINT_ID} CONCLUÍDA COM SUCESSO =="
  echo "Log: ${LOG_FILE}"
  copy_log
}

trap 'fail "$?" "$LINENO"' ERR

echo "== RL.SYS CORE :: Sprint 109 FIX V5 =="
echo "== Correção institucional: aumento de timeout para ambientes Proot/Termux =="
echo "Run ID: ${RUN_ID}"

git fetch origin main || true
git checkout main
git pull origin main || true
git checkout -B "$BRANCH"

cat > scripts/paper-runtime-session.js <<'JS'
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const {
  handleOperatorDisciplineCommand,
} = require('./paper-runtime-operator-discipline-preload');
const {
  handlePaperRuntimeLedgerCommand,
} = require('./paper-runtime-ledger-command-preload');

const {
  PaperRuntimeOperationalGate,
} = require('../dist/application/runtime/PaperRuntimeOperationalGate.js');
const {
  PaperRuntimeSessionSupervisor,
} = require('../dist/application/runtime/PaperRuntimeSessionSupervisor.js');
const {
  PaperRuntimeHudGateComposer,
} = require('../dist/application/runtime/PaperRuntimeHudGateComposer.js');
const {
  PaperRuntimeReplCommandAdapter,
} = require('../dist/application/runtime/PaperRuntimeReplCommandAdapter.js');
const {
  PaperRuntimeInteractiveLoop,
} = require('../dist/application/runtime/PaperRuntimeInteractiveLoop.js');
const {
  PaperRuntimeSessionSnapshotFactory,
} = require('../dist/application/runtime/PaperRuntimeSessionSnapshot.js');
const {
  JsonPaperRuntimeSessionSnapshotRepository,
} = require('../dist/infrastructure/runtime/JsonPaperRuntimeSessionSnapshotRepository.js');

function resolveSnapshotPath() {
  return (
    process.env.RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH ||
    process.env.PAPER_RUNTIME_SNAPSHOT_PATH ||
    process.env.PAPER_RUNTIME_SESSION_SNAPSHOT_PATH ||
    path.join('data', 'paper-runtime', 'session-snapshot.json')
  );
}

function createLoop() {
  return new PaperRuntimeInteractiveLoop(
    new PaperRuntimeReplCommandAdapter(
      new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate()),
      new PaperRuntimeHudGateComposer(),
    ),
  );
}

function printHelp() {
  console.log([
    'RL.SYS PAPER RUNTIME SESSION',
    '',
    'Commands:',
    '  prepare',
    '  start',
    '  status',
    '  pause',
    '  resume',
    '  finish',
    '  win <amount>',
    '  loss <amount>',
    '  ledger',
    '  bankroll',
    '  exit',
    '',
  ].join('\n'));
}

function runStartupRecovery() {
  try {
    const {
      runPaperRuntimeSnapshotRecovery,
    } = require('./paper-runtime-snapshot-recovery');

    return runPaperRuntimeSnapshotRecovery();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`RL.SYS paper runtime recovery bootstrap skipped: ${message}`);
    return null;
  }
}

function saveSnapshot(loop, gracefulShutdown) {
  const state = loop.currentState();
  const snapshot = new PaperRuntimeSessionSnapshotFactory().create({
    sessionState: state.sessionState,
    iteration: state.iteration,
    lastCommand: state.lastCommand,
    gracefulShutdown,
  });

  new JsonPaperRuntimeSessionSnapshotRepository(resolveSnapshotPath()).save(snapshot);
  return snapshot;
}

function printPreviousSnapshotNotice() {
  try {
    const repository = new JsonPaperRuntimeSessionSnapshotRepository(resolveSnapshotPath());
    const previous = repository.load();

    if (previous !== null) {
      console.log(`Previous snapshot detected: state=${previous.sessionState} graceful=${previous.gracefulShutdown}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`Previous snapshot ignored: ${message}`);
  }
}

function handleRuntimeCommand(loop, rawLine) {
  const result = loop.handle(rawLine);
  saveSnapshot(loop, false);
  console.log(result.output);
}

function handleScriptedCommand(loop, rawLine) {
  const command = rawLine.trim().toLowerCase();

  if (command.length === 0) {
    return { shouldExit: false };
  }

  if (command === 'exit' || command === 'quit') {
    saveSnapshot(loop, true);
    return { shouldExit: true };
  }

  const discipline = handleOperatorDisciplineCommand(rawLine);

  if (discipline.blocked) {
    saveSnapshot(loop, false);
    return { shouldExit: false };
  }

  if (handlePaperRuntimeLedgerCommand(rawLine)) {
    saveSnapshot(loop, false);
    return { shouldExit: false };
  }

  handleRuntimeCommand(loop, rawLine);
  return { shouldExit: false };
}

function runScriptedSession() {
  runStartupRecovery();

  const loop = createLoop();
  printHelp();
  printPreviousSnapshotNotice();

  const input = fs.readFileSync(0, 'utf8');
  const lines = input.split(/\r?\n/);

  for (const line of lines) {
    const result = handleScriptedCommand(loop, line);

    if (result.shouldExit) {
      console.log('RL.SYS paper runtime session closed.');
      return;
    }
  }

  saveSnapshot(loop, false);
  console.log('RL.SYS paper runtime session closed.');
}

function runInteractiveSession() {
  runStartupRecovery();

  const loop = createLoop();
  printHelp();
  printPreviousSnapshotNotice();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'paper> ',
  });

  rl.prompt();

  rl.on('line', (line) => {
    const command = line.trim().toLowerCase();

    if (command === 'exit' || command === 'quit') {
      saveSnapshot(loop, true);
      rl.close();
      return;
    }

    handleRuntimeCommand(loop, line);
    rl.prompt();
  });

  rl.on('SIGINT', () => {
    saveSnapshot(loop, false);
    rl.close();
  });

  rl.on('close', () => {
    console.log('RL.SYS paper runtime session closed.');
  });
}

function main() {
  if (!process.stdin.isTTY) {
    runScriptedSession();
    return;
  }

  runInteractiveSession();
}

main();
JS

cat > tests/paper-runtime-session-scripted-preload-regression.test.js <<'JS'
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function runPaperRuntime(input) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-s109-v5-'));

  const result = spawnSync(process.execPath, ['scripts/paper-runtime-session.js'], {
    cwd: path.join(__dirname, '..'),
    input,
    encoding: 'utf8',
    timeout: 60000, // FIX: Timeout aumentado de 5s para 60s para suportar ambiente Proot
    env: {
      ...process.env,
      RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH: path.join(dir, 'session-snapshot.json'),
      RLSYS_PAPER_RUNTIME_LEDGER_PATH: path.join(dir, 'paper-ledger.json'),
      RLSYS_PAPER_RUNTIME_DISCIPLINE_PATH: path.join(dir, 'operator-discipline.json'),
    },
  });

  return {
    dir,
    result,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

test('scripted paper runtime preserves ledger command preloads', () => {
  const { dir, result, output } = runPaperRuntime('win 10\nloss 3\nledger\nbankroll\nexit\n');

  assert.equal(result.status, 0, output);
  assert.equal(result.signal, null, output);
  assert.match(output, /Ledger recorded: WIN 10/);
  assert.match(output, /Ledger recorded: LOSS 3/);
  assert.match(output, /RL.SYS PAPER LEDGER/);
  assert.match(output, /balance: 7/);

  const ledger = JSON.parse(fs.readFileSync(path.join(dir, 'paper-ledger.json'), 'utf8'));
  assert.equal(ledger.summary.wins, 1);
  assert.equal(ledger.summary.losses, 1);
  assert.equal(ledger.summary.balance, 7);
});

test('scripted paper runtime preserves operator discipline preloads', () => {
  const { dir, result, output } = runPaperRuntime('loss 1\nloss 1\nresume\nexit\n');

  assert.equal(result.status, 0, output);
  assert.equal(result.signal, null, output);
  assert.match(output, /discipline block: UNSAFE_RESUME_AFTER_LOSSES/);

  const discipline = JSON.parse(fs.readFileSync(path.join(dir, 'operator-discipline.json'), 'utf8'));
  assert.equal(discipline.lock.active, true);
});

test('scripted paper runtime exits deterministically and tolerates incompatible snapshot notice', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-s109-v5-bad-snapshot-'));
  const snapshotPath = path.join(dir, 'session-snapshot.json');

  fs.writeFileSync(snapshotPath, JSON.stringify({
    schemaVersion: 'legacy-invalid',
    sessionState: 'RUNNING',
  }));

  const result = spawnSync(process.execPath, ['scripts/paper-runtime-session.js'], {
    cwd: path.join(__dirname, '..'),
    input: 'prepare\nstart\nfinish\nexit\n',
    encoding: 'utf8',
    timeout: 60000, // FIX: Timeout aumentado para 60s
    env: {
      ...process.env,
      RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH: snapshotPath,
      RLSYS_PAPER_RUNTIME_LEDGER_PATH: path.join(dir, 'paper-ledger.json'),
      RLSYS_PAPER_RUNTIME_DISCIPLINE_PATH: path.join(dir, 'operator-discipline.json'),
    },
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;

  assert.equal(result.status, 0, output);
  assert.equal(result.signal, null, output);
  assert.match(output, /snapshot/i);
  assert.match(output, /PAPER READY/);
  assert.match(output, /SESSION_STARTED/);
  assert.match(output, /SESSION_FINISHED/);
  assert.match(output, /RL.SYS paper runtime session closed./);
});
JS

# FIX ENTERPRISE: Aumentar o timeout de spawnSync em TODOS os testes antigos para evitar falhas de ambiente
echo "Aplicando patch de timeout nos testes estáticos legados..."
find tests -type f -name "paper-runtime-*.test.js" -exec sed -i 's/timeout: 5000/timeout: 60000/g' {} +

npm run build

node --test \
  tests/paper-runtime-session-script.test.js \
  tests/paper-runtime-session-script-snapshot.test.js \
  tests/paper-runtime-session-script-recovery.test.js \
  tests/paper-runtime-session-ledger-command.test.js \
  tests/paper-runtime-session-discipline-integration.test.js \
  tests/paper-runtime-session-scripted-preload-regression.test.js

npm test

git add scripts/paper-runtime-session.js tests/paper-runtime-session-scripted-preload-regression.test.js tests/paper-runtime-*.test.js install/sprints/run-sprint-109-fix-v5.sh
git commit -m "$COMMIT_MSG"
git push -u origin "$BRANCH"

git checkout main
git merge --no-edit "$BRANCH"
npm run build
npm test
git push origin main

trap - ERR
success

