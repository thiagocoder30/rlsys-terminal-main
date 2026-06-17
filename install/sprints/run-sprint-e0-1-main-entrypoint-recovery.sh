#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)

LOG_DIR="install/sprints/logs"
mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%d_%H-%M-%S")

LOG="$LOG_DIR/e0-1-main-entrypoint-recovery_$TS.log"
STATE="$LOG_DIR/e0-1-main-entrypoint-recovery_${TS}_state.json"

log() {
  echo "[$(date +"%H:%M:%S")] [INFO] $1" | tee -a "$LOG"
}

state() {
  echo "{\"step\":\"$1\",\"status\":\"$2\",\"time\":\"$(date +"%H:%M:%S")\"}" >> "$STATE"
}

log "E0.1 MAIN ENTRYPOINT RECOVERY (REAL ARCHITECTURE FIX)"
state "start" "ok"

cd "$ROOT"

log "STEP 1 - Rebuilding main.ts with REAL module paths"

cat > src/main.ts <<'EOF'
import readline from 'readline/promises';

import { RuntimeKernel } from './application/runtime/RuntimeKernel';
import { RuntimeShutdownCoordinator } from './application/runtime/RuntimeShutdownCoordinator';
import { JsonLinesReplayRepository } from './infrastructure/replay/JsonLinesReplayRepository';

import { RuntimeStressSampler } from './application/stress/RuntimeStressSampler';
import { RuntimeHudTelemetryComposer } from './application/operator/RuntimeHudTelemetryComposer';
import { TrueEventLoopLagMonitor } from './infrastructure/runtime/TrueEventLoopLagMonitor';

import { RuntimeStateTransitionGate } from './application/runtime/RuntimeStateTransitionGate';
import { RuntimeMemoryPressureMonitor } from './domain/runtime/RuntimeMemoryPressureMonitor';
import { RuntimeStressHarness } from './domain/stress/RuntimeStressHarness';
import { OperatorHudFormatter } from './domain/operator';

async function bootstrap() {

  const repo = new JsonLinesReplayRepository('./data/replay.jsonl');

  const kernel = new RuntimeKernel(
    repo,
    new RuntimeStateTransitionGate(),
    new RuntimeMemoryPressureMonitor(),
    new RuntimeStressSampler(),
    new RuntimeStressHarness(),
    new RuntimeHudTelemetryComposer(),
    new OperatorHudFormatter(),
    new TrueEventLoopLagMonitor()
  );

  const shutdown = new RuntimeShutdownCoordinator(kernel);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('rlsys> CORE INITIALIZED');

  while (true) {
    const input = await rl.question('rlsys> ');
    const cmd = input.trim().toLowerCase();

    if (cmd === 'status' || cmd === 's') {
      console.log({
        session: kernel.getSessionId?.() ?? 'unknown'
      });
      continue;
    }

    if (cmd === 'quit' || cmd === 'exit') {
      console.log('Shutting down...');

      shutdown.shutdown('operator_exit');

      rl.close();
      process.exit(0);
    }

    console.log(`Unknown command: ${cmd}`);
  }
}

bootstrap().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
EOF

log "main.ts rebuilt using verified module map"
state "main_rebuild" "ok"

log "STEP 2 - Typecheck"

npm run build || {
  log "TYPECHECK FAILED"
  state "typecheck" "failed"
  exit 1
}

state "typecheck" "ok"

log "STEP 3 - Snapshot"
git status >> "$LOG"
git diff >> "$LOG"

log "E0.1 COMPLETE"
state "finish" "ok"

echo ""
echo "=============================="
echo "PASS E0.1 MAIN ENTRYPOINT RECOVERY (FINAL)"
echo "=============================="
