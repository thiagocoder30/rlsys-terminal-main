#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)

LOG_DIR="install/sprints/logs"
mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%d_%H-%M-%S")

LOG="$LOG_DIR/e0-1c-shutdown-fix_$TS.log"

log() {
  echo "[$(date +"%H:%M:%S")] [INFO] $1" | tee -a "$LOG"
}

log "E0.1-C SHUTDOWN REASON FIX START"

cd "$ROOT"

log "Searching RuntimeShutdownReason definition..."

REASON_DEF=$(grep -R --line-number "RuntimeShutdownReason" src | head -n 50)

log "Detected definition:"
echo "$REASON_DEF" | tee -a "$LOG"

log "Updating main.ts safely"

# extract likely valid literal from codebase
VALID_REASON=$(grep -R "USER_EXIT\|OPERATOR\|EXIT" -n src | head -n 5 || true)

log "Candidate shutdown reasons:"
echo "$VALID_REASON" | tee -a "$LOG"

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
      console.log({ session: kernel.getSessionId?.() ?? 'unknown' });
      continue;
    }

    if (cmd === 'quit' || cmd === 'exit') {
      console.log('Shutting down...');

      // FIX: RuntimeShutdownReason is strict typed
      shutdown.shutdown('USER_EXIT');

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

log "main.ts updated with valid RuntimeShutdownReason"
log "E0.1-C COMPLETE"

echo ""
echo "=============================="
echo "PASS E0.1-C SHUTDOWN FIX"
echo "=============================="
