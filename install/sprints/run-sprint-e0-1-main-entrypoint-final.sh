#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)

LOG_DIR="install/sprints/logs"
mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%d_%H-%M-%S")

LOG="$LOG_DIR/e0-1-main-entrypoint-final_$TS.log"

log() {
  echo "[$(date +"%H:%M:%S")] [INFO] $1" | tee -a "$LOG"
}

log "E0.1 FINAL ENTRYPOINT FIX START"

cd "$ROOT"

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
    const cmd = input.trim().toUpperCase();

    if (cmd === 'STATUS' || cmd === 'S') {
      console.log({ session: kernel.getSessionId?.() ?? 'unknown' });
      continue;
    }

    if (cmd === 'QUIT' || cmd === 'EXIT') {
      console.log('Shutting down...');

      shutdown.shutdown('OPERATOR_QUIT');

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

log "ENTRYPOINT UPDATED WITH VALID SHUTDOWN CONTRACT"

npm run build || {
  log "BUILD FAILED"
  exit 1
}

log "BUILD SUCCESS"

echo ""
echo "=============================="
echo "PASS E0.1 FINAL ENTRYPOINT FIX"
echo "SYSTEM IS NOW TYPE-CORRECT"
echo "=============================="
