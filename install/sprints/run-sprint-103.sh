#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-103-paper-runtime-snapshot-recovery"
COMMIT_MSG="feat(runtime): add paper runtime snapshot recovery"
SPRINT_ID="103"
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

echo "== RL.SYS CORE :: Sprint 103 final repair =="

[ -d .git ] || { echo "Execute na raiz do repositório"; exit 1; }

git fetch origin main
git checkout main
git reset --hard origin/main

git branch -D "$BRANCH" 2>/dev/null || true
git checkout -b "$BRANCH"

mkdir -p scripts tests data/paper-runtime

rm -f scripts/paper-runtime-session-core.js
rm -f tests/paper-runtime-session-wrapper-recovery.test.js

git checkout origin/main -- scripts/paper-runtime-session.js

grep -q "readline" scripts/paper-runtime-session.js || {
  echo "ERRO: runtime original não contém readline; abortando para não quebrar contrato legado"
  exit 1
}

cat > scripts/paper-runtime-snapshot-recovery.js <<'EOF'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ACTIVE_STATES = new Set(['RUNNING', 'PAUSED', 'READY', 'STARTED']);
const FINAL_STATES = new Set(['FINISHED', 'COMPLETED', 'CLOSED', 'FINALIZED']);

function normalizeState(value) {
  if (typeof value !== 'string') return 'UNKNOWN';
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : 'UNKNOWN';
}

function resolveSnapshotPath() {
  const envPath =
    process.env.RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH ||
    process.env.PAPER_RUNTIME_SNAPSHOT_PATH ||
    process.env.PAPER_RUNTIME_SESSION_SNAPSHOT_PATH;

  if (envPath && envPath.trim().length > 0) return envPath;

  return path.join(process.cwd(), 'data', 'paper-runtime', 'session-snapshot.json');
}

function readSnapshot(snapshotPath) {
  try {
    if (!fs.existsSync(snapshotPath)) {
      return { ok: false, reason: 'SNAPSHOT_NOT_FOUND', snapshot: null };
    }

    const raw = fs.readFileSync(snapshotPath, 'utf8').trim();

    if (raw.length === 0) {
      return { ok: false, reason: 'SNAPSHOT_EMPTY', snapshot: null };
    }

    const parsed = JSON.parse(raw);

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, reason: 'SNAPSHOT_INVALID_SHAPE', snapshot: null };
    }

    return { ok: true, reason: 'SNAPSHOT_LOADED', snapshot: parsed };
  } catch (error) {
    return {
      ok: false,
      reason: 'SNAPSHOT_CORRUPTED',
      errorMessage: error instanceof Error ? error.message : String(error),
      snapshot: null
    };
  }
}

function detectState(snapshot) {
  return normalizeState(
    snapshot.state ||
    snapshot.status ||
    snapshot.sessionState ||
    snapshot.runtimeState ||
    snapshot.phase
  );
}

function isGraceful(snapshot) {
  if (typeof snapshot.gracefulShutdown === 'boolean') return snapshot.gracefulShutdown;
  if (typeof snapshot.safeShutdown === 'boolean') return snapshot.safeShutdown;
  if (typeof snapshot.shutdownGraceful === 'boolean') return snapshot.shutdownGraceful;
  if (typeof snapshot.cleanShutdown === 'boolean') return snapshot.cleanShutdown;
  return false;
}

function classify(state, graceful) {
  if (!ACTIVE_STATES.has(state)) return 'NO_RECOVERY';
  if (state === 'RUNNING' && graceful === false) return 'ABRUPT_RUNNING';
  if (state === 'PAUSED' && graceful === false) return 'ABRUPT_PAUSED';
  if (graceful === false) return 'ABRUPT_ACTIVE';
  if (state === 'RUNNING') return 'GRACEFUL_RUNNING';
  if (state === 'PAUSED') return 'GRACEFUL_PAUSED';
  return 'RECOVERABLE_ACTIVE';
}

function recoverPaperRuntimeSnapshot() {
  const snapshotPath = resolveSnapshotPath();
  const loaded = readSnapshot(snapshotPath);

  if (!loaded.ok) {
    return {
      recovered: false,
      action: 'BOOT_FRESH',
      decision: 'NO_SNAPSHOT',
      reason: loaded.reason,
      snapshotPath
    };
  }

  const snapshot = loaded.snapshot;
  const state = detectState(snapshot);
  const graceful = isGraceful(snapshot);

  if (FINAL_STATES.has(state)) {
    return {
      recovered: false,
      action: 'BOOT_FRESH',
      decision: 'FINALIZED_SESSION',
      reason: 'SNAPSHOT_ALREADY_FINALIZED',
      detectedState: state,
      snapshotPath
    };
  }

  if (!ACTIVE_STATES.has(state)) {
    return {
      recovered: false,
      action: 'BOOT_FRESH',
      decision: 'NO_RECOVERY',
      reason: 'SNAPSHOT_NOT_RECOVERABLE',
      detectedState: state,
      snapshotPath
    };
  }

  const decision = classify(state, graceful);
  const now = new Date().toISOString();

  const recoveredSnapshot = {
    ...snapshot,
    state: 'PAUSED',
    status: 'PAUSED',
    sessionState: 'PAUSED',
    gracefulShutdown: false,
    updatedAt: now,
    recovery: {
      recovered: true,
      recoveredAt: now,
      originalState: state,
      restoredState: 'PAUSED',
      decision,
      requiresHumanConfirmation: true,
      reason: 'SAFE_RECOVERY_FROM_PREVIOUS_SESSION'
    }
  };

  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, `${JSON.stringify(recoveredSnapshot, null, 2)}\n`, 'utf8');

  return {
    recovered: true,
    action: 'RESTORE_AS_PAUSED',
    decision,
    detectedState: state,
    restoredState: 'PAUSED',
    requiresHumanConfirmation: true,
    snapshotPath
  };
}

function runPaperRuntimeSnapshotRecovery() {
  const result = recoverPaperRuntimeSnapshot();

  if (result.recovered === true) {
    console.log(`Recovery decision: ${result.decision}`);
    console.log(`Recovery action: ${result.action}`);
    console.log(`Recovery restored state: ${result.restoredState}`);
    console.log('Recovery requires human confirmation: true');
  }

  return result;
}

module.exports = {
  recoverPaperRuntimeSnapshot,
  runPaperRuntimeSnapshotRecovery,
  normalizeState,
  classify
};
EOF

cat >> scripts/paper-runtime-session.js <<'EOF'

/**
 * Sprint 103 — Paper Runtime Snapshot Recovery
 *
 * Appended at EOF intentionally to preserve the legacy interactive runtime source,
 * including readline-based contracts already covered by existing tests.
 */
try {
  const { runPaperRuntimeSnapshotRecovery } = require('./paper-runtime-snapshot-recovery');
  runPaperRuntimeSnapshotRecovery();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`RL.SYS paper runtime recovery bootstrap failed: ${message}`);
  process.exitCode = 1;
}
EOF

cat > tests/paper-runtime-snapshot-recovery.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { recoverPaperRuntimeSnapshot, classify } = require('../scripts/paper-runtime-snapshot-recovery');

function snapshotPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-s103-'));
  return path.join(dir, 'session-snapshot.json');
}

test('classifies abrupt running recovery', () => {
  assert.equal(classify('RUNNING', false), 'ABRUPT_RUNNING');
});

test('recovers running snapshot as paused', () => {
  const file = snapshotPath();

  fs.writeFileSync(file, JSON.stringify({
    sessionId: 's103',
    state: 'RUNNING',
    gracefulShutdown: false
  }));

  process.env.RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH = file;
  const result = recoverPaperRuntimeSnapshot();
  delete process.env.RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH;

  const restored = JSON.parse(fs.readFileSync(file, 'utf8'));

  assert.equal(result.recovered, true);
  assert.equal(result.decision, 'ABRUPT_RUNNING');
  assert.equal(result.action, 'RESTORE_AS_PAUSED');
  assert.equal(restored.state, 'PAUSED');
  assert.equal(restored.recovery.requiresHumanConfirmation, true);
});
EOF

cat > tests/paper-runtime-session-script-recovery.test.js <<'EOF'
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('paper runtime session reports recovery decision for interrupted running snapshot', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-s103-session-'));
  const snapshot = path.join(dir, 'session-snapshot.json');

  fs.writeFileSync(snapshot, JSON.stringify({
    sessionId: 'session-recovery-test',
    state: 'RUNNING',
    gracefulShutdown: false
  }));

  const result = spawnSync(process.execPath, ['scripts/paper-runtime-session.js'], {
    cwd: path.join(__dirname, '..'),
    input: 'exit\n',
    encoding: 'utf8',
    env: {
      ...process.env,
      RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH: snapshot
    }
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;

  assert.equal(result.status, 0, output);
  assert.match(output, /Recovery decision: ABRUPT_RUNNING/);
  assert.match(output, /Recovery action: RESTORE_AS_PAUSED/);
  assert.match(output, /RL\.SYS PAPER RUNTIME SESSION/);
});
EOF

if grep -q "__paperRuntimeRecoveryResult" scripts/paper-runtime-session.js; then
  echo "ERRO: resíduo antigo encontrado"
  exit 1
fi

grep -q "readline" scripts/paper-runtime-session.js
node --check scripts/paper-runtime-session.js
node --check scripts/paper-runtime-snapshot-recovery.js

TMP_DIR="$(mktemp -d)"
TMP_SNAPSHOT="$TMP_DIR/session-snapshot.json"
printf '{"sessionId":"smoke","state":"RUNNING","gracefulShutdown":false}\n' > "$TMP_SNAPSHOT"

printf 'exit\n' | RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH="$TMP_SNAPSHOT" node scripts/paper-runtime-session.js | tee /tmp/rlsys-s103-smoke.log

grep "Recovery decision: ABRUPT_RUNNING" /tmp/rlsys-s103-smoke.log
grep "Recovery action: RESTORE_AS_PAUSED" /tmp/rlsys-s103-smoke.log
grep "RL.SYS PAPER RUNTIME SESSION" /tmp/rlsys-s103-smoke.log

npm run build
npm test

git add .
git commit -m "$COMMIT_MSG"
git push -u origin "$BRANCH"

echo "== Sprint 103 concluída =="
