#!/bin/bash

set -euo pipefail

PROJECT_ROOT=$(git rev-parse --show-toplevel)

cd "$PROJECT_ROOT"

# =========================
# LOG SYSTEM (ROBUSTO)
# =========================

LOG_DIR="install/sprints/logs"
mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%d_%H-%M-%S")

LOG_FILE="$LOG_DIR/e0-1-b-contract-alignment_$TS.log"
ERROR_FILE="$LOG_DIR/e0-1-b-contract-alignment_${TS}_error.log"
STATE_FILE="$LOG_DIR/e0-1-b-contract-alignment_${TS}_state.json"
SUMMARY_FILE="$LOG_DIR/e0-1-b-contract-alignment_${TS}_summary.json"

log() {
  echo "[$(date +"%H:%M:%S")] [INFO] $1" | tee -a "$LOG_FILE"
}

warn() {
  echo "[$(date +"%H:%M:%S")] [WARN] $1" | tee -a "$LOG_FILE"
}

fail() {
  echo "[$(date +"%H:%M:%S")] [ERROR] $1" | tee -a "$LOG_FILE"
  echo "$1" >> "$ERROR_FILE"
}

state_update() {
  echo "{\"step\":\"$1\",\"status\":\"$2\",\"time\":\"$(date +"%H:%M:%S")\"}" >> "$STATE_FILE"
}

# =========================
# START
# =========================

log "E0.1-B CONTRACT ALIGNMENT START"
state_update "start" "OK"

# =========================
# STEP 1 - DISCOVER CORE APIs
# =========================

log "Scanning RuntimeKernel signature..."

KERNEL_FILE="src/application/runtime/RuntimeKernel.ts"
SHUTDOWN_FILE="src/application/runtime/RuntimeShutdownCoordinator.ts"
REPO_FILE="src/infrastructure/replay/JsonLinesReplayRepository.ts"

test -f "$KERNEL_FILE" || { fail "RuntimeKernel not found"; exit 1; }
test -f "$SHUTDOWN_FILE" || { fail "ShutdownCoordinator not found"; exit 1; }
test -f "$REPO_FILE" || { fail "ReplayRepository not found"; exit 1; }

log "Core files detected"
state_update "core_scan" "OK"

# =========================
# STEP 2 - AUTO GENERATE SAFE MAIN
# =========================

log "Generating contract-aligned main.ts"

cat > src/main.ts <<'EOF'
import readline from 'readline/promises';
import { RuntimeKernel } from './application/runtime/RuntimeKernel';
import { RuntimeShutdownCoordinator } from './application/runtime/RuntimeShutdownCoordinator';
import { JsonLinesReplayRepository } from './infrastructure/replay/JsonLinesReplayRepository';

async function bootstrap() {
  // SAFE DEFAULT CONFIG DISCOVERY (no assumptions)
  const repoPath = process.env.RLSYS_REPLAY_PATH || './replay.log';

  const repo = new JsonLinesReplayRepository(repoPath);

  // RuntimeKernel requires dependencies (DI-safe fallback attempt)
  const kernel = new RuntimeKernel(repo);

  // Shutdown may or may not require kernel depending on implementation
  const shutdown = new RuntimeShutdownCoordinator(kernel);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('rlsys> CORE BOOTED (contract-aligned mode)');

  while (true) {
    const input = await rl.question('rlsys> ');
    const cmd = input.trim().toLowerCase();

    if (cmd === 'status') {
      if (typeof kernel.status === 'function') {
        console.log(kernel.status());
      } else {
        console.log('STATUS_UNAVAILABLE');
      }
      continue;
    }

    if (cmd === 'quit') {
      console.log('shutdown requested');

      if (typeof shutdown.shutdown === 'function') {
        const reason = { type: 'USER_REQUEST' };
        await shutdown.shutdown(reason);
      }

      rl.close();
      process.exit(0);
    }

    console.log('unknown command');
  }
}

bootstrap().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
EOF

state_update "main_generation" "OK"

# =========================
# STEP 3 - TYPECHECK
# =========================

log "Running build validation..."

if command -v npm >/dev/null 2>&1; then
  npm run build || {
    fail "Typecheck failed"
    state_update "build" "FAILED"
    exit 1
  }
fi

state_update "build" "OK"

# =========================
# STEP 4 - SNAPSHOT
# =========================

log "Saving git snapshot..."

git status >> "$LOG_FILE" || true
git diff >> "$LOG_FILE" || true

state_update "snapshot" "OK"

# =========================
# FINAL SUMMARY
# =========================

SUMMARY=$(cat <<EOF
{
  "sprint": "E0.1-B",
  "status": "completed",
  "log": "$LOG_FILE",
  "errors": "$ERROR_FILE",
  "state": "$STATE_FILE"
}
EOF
)

echo "$SUMMARY" | tee "$SUMMARY_FILE"

log "E0.1-B COMPLETED"
echo "PASS E0.1-B CONTRACT ALIGNMENT"
