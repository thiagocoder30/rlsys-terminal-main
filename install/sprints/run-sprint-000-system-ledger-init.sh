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

STATE="$BASE_DIR/STATE_OF_RL_SYS.json"
HISTORY="$HIST_DIR/STATE_${TS}.json"
TMP_NODE="$LOG_DIR/ledger_check_$TS.js"
LOG="$LOG_DIR/sprint-000-system-ledger_$TS.log"

log() {
  echo "[$(date +"%H:%M:%S")] [INFO] $1" | tee -a "$LOG"
}

log "SPRINT 000 SYSTEM LEDGER INIT v2 START"

cd "$ROOT"

log "Writing system state"

cat > "$STATE" <<EOF
{
  "system": "RL.SYS CORE",
  "version": "E0.1-FINAL",
  "phase": "FASE 0 COMPLETE",
  "completed_sprints": [
    "E0.0.1",
    "E0.0.2",
    "E0.0.3",
    "E0.0.4",
    "E0.1"
  ],
  "next_phase": "FASE 1"
}
EOF

log "Snapshot created"

cp "$STATE" "$HISTORY"

log "Writing validator"

cat > "$TMP_NODE" <<'EOF'
const fs = require('fs');

const statePath = process.argv[2];

if (!statePath) {
  console.error("STATE PATH MISSING");
  process.exit(1);
}

const raw = fs.readFileSync(statePath, 'utf8');

let state;

try {
  state = JSON.parse(raw);
} catch (e) {
  console.error("INVALID JSON STATE FILE");
  process.exit(1);
}

if (!state.system) {
  console.error("INVALID STATE STRUCTURE");
  process.exit(1);
}

console.log("SYSTEM LEDGER OK");
EOF

log "Validating state"

node "$TMP_NODE" "$STATE"

rm -f "$TMP_NODE"

log "SPRINT 000 COMPLETE"

echo ""
echo "=============================="
echo "PASS SYSTEM LEDGER INITIALIZED v2"
echo "STATE: $STATE"
echo "=============================="
