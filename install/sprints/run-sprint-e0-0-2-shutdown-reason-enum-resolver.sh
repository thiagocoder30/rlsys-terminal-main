#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)

LOG_DIR="install/sprints/logs"
mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%d_%H-%M-%S")

LOG="$LOG_DIR/e0-0-2-shutdown-reason-resolver_$TS.log"
OUTPUT="$LOG_DIR/e0-0-2-shutdown-reason-values_$TS.txt"

log() {
  echo "[$(date +"%H:%M:%S")] [INFO] $1" | tee -a "$LOG"
}

log "E0.0.2 SHUTDOWN REASON ENUM RESOLVER START"

cd "$ROOT"

FILE=$(grep -R "RuntimeShutdownReason" -n src | head -n 1 | cut -d: -f1)

log "Found definition file: $FILE"

log "Extracting union / enum block..."

sed -n '/RuntimeShutdownReason/,+120p' "$FILE" > "$OUTPUT"

log "Filtering possible values..."

grep -E "'[A-Z_]+'" "$OUTPUT" >> "$LOG" || true

echo ""
echo "=============================="
echo "PASS E0.0.2 SHUTDOWN REASON RESOLVED"
echo "OUTPUT: $OUTPUT"
echo "=============================="
