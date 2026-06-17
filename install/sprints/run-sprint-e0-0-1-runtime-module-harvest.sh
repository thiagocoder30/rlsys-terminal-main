#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)

LOG_DIR="install/sprints/logs"
mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%d_%H-%M-%S")

LOG="$LOG_DIR/e0-0-1-module-harvest_$TS.log"
OUTPUT="$LOG_DIR/e0-0-1-module-map_$TS.json"

log() {
  echo "[$(date +"%H:%M:%S")] [INFO] $1" | tee -a "$LOG"
}

log "E0.0.1 RUNTIME MODULE HARVEST START"

cd "$ROOT"

find src -type f -name "*.ts" > "$LOG_DIR/all_ts_files.txt"

resolve() {
  local name=$1
  grep -R --line-number "$name" src | head -n 20
}

log "Searching RuntimeStressSampler..."
SAMPLER=$(resolve "RuntimeStressSampler")

log "Searching RuntimeHudTelemetryComposer..."
HUD=$(resolve "RuntimeHudTelemetryComposer")

log "Searching TrueEventLoopLagMonitor..."
LAG=$(resolve "TrueEventLoopLagMonitor")

cat > "$OUTPUT" <<EOF
{
  "RuntimeStressSampler": $(echo "$SAMPLER" | jq -Rs .),
  "RuntimeHudTelemetryComposer": $(echo "$HUD" | jq -Rs .),
  "TrueEventLoopLagMonitor": $(echo "$LAG" | jq -Rs .)
}
EOF

log "MODULE MAP GENERATED"

echo ""
echo "=============================="
echo "PASS E0.0.1 MODULE HARVEST"
echo "OUTPUT: $OUTPUT"
echo "=============================="
