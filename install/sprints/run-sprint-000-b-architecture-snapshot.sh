#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)

BASE_DIR="$ROOT/install/sprints/flags"
HIST_DIR="$BASE_DIR/history"
LOG_DIR="$ROOT/install/sprints/logs"

mkdir -p "$BASE_DIR"
mkdir -p "$HIST_DIR"
mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%d_%H-%M-%S")

SNAPSHOT="$BASE_DIR/ARCHITECTURE_SNAPSHOT.json"
HISTORY="$HIST_DIR/ARCH_SNAPSHOT_${TS}.json"
LOG="$LOG_DIR/sprint-000-b-architecture_$TS.log"

log() {
  echo "[$(date +"%H:%M:%S")] [INFO] $1" | tee -a "$LOG"
}

log "SPRINT 000-B ARCHITECTURE SNAPSHOT START"

cd "$ROOT"

log "Scanning project structure"

APPLICATION=$(find src/application -type d 2>/dev/null | sed "s|src/application/||" || true)
DOMAIN=$(find src/domain -type d 2>/dev/null | sed "s|src/domain/||" || true)
INFRA=$(find src/infrastructure -type d 2>/dev/null | sed "s|src/infrastructure/||" || true)

log "Building snapshot JSON"

cat > "$SNAPSHOT" <<EOF
{
  "project": "RL.SYS CORE",
  "generated_at": "$TS",

  "structure": {
    "application": $(echo "$APPLICATION" | sed 's/^/"/;s/$/"/' | paste -sd "," - | sed 's/^/[/' | sed 's/$/]/'),
    "domain": $(echo "$DOMAIN" | sed 's/^/"/;s/$/"/' | paste -sd "," - | sed 's/^/[/' | sed 's/$/]/'),
    "infrastructure": $(echo "$INFRA" | sed 's/^/"/;s/$/"/' | paste -sd "," - | sed 's/^/[/' | sed 's/$/]/')
  },

  "core_modules": [
    "RuntimeKernel",
    "RuntimeShutdownCoordinator",
    "JsonLinesReplayRepository"
  ],

  "entrypoints": [
    "src/main.ts"
  ],

  "architecture_style": "HYBRID_LAYERED_RUNTIME",

  "critical_flow": [
    "CLI -> Kernel -> ShutdownCoordinator -> ReplayRepository"
  ]
}
EOF

log "Snapshot written"

cp "$SNAPSHOT" "$HISTORY"

log "VALIDATING SNAPSHOT"

node -e "
const fs = require('fs');
const s = JSON.parse(fs.readFileSync('$SNAPSHOT','utf8'));

if(!s.project || !s.structure){
  console.error('INVALID SNAPSHOT');
  process.exit(1);
}

console.log('ARCHITECTURE SNAPSHOT OK');
"

log "SPRINT 000-B COMPLETE"

echo ""
echo "=============================="
echo "PASS ARCHITECTURE SNAPSHOT GENERATED"
echo "STATE: $SNAPSHOT"
echo "=============================="
