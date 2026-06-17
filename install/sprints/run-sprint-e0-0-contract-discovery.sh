#!/bin/bash

set -euo pipefail

PROJECT_ROOT=$(git rev-parse --show-toplevel)

LOG_DIR="install/sprints/logs"
mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%d_%H-%M-%S")

LOG_FILE="$LOG_DIR/e0-0-contract-discovery_$TS.log"
OUTPUT_FILE="$LOG_DIR/e0-0-contract-map_$TS.json"

log() {
  echo "[$(date +"%H:%M:%S")] [INFO] $1" | tee -a "$LOG_FILE"
}

log "E0.0 CONTRACT DISCOVERY START"

cd "$PROJECT_ROOT"

log "Extracting RuntimeKernel constructor signature"
KERNEL_SIG=$(grep -n "class RuntimeKernel" -A 80 src/application/runtime/RuntimeKernel.ts || true)

log "Extracting RuntimeShutdownCoordinator methods"
SHUTDOWN_SIG=$(grep -n "class RuntimeShutdownCoordinator" -A 120 src/application/runtime/RuntimeShutdownCoordinator.ts || true)

log "Extracting JsonLinesReplayRepository constructor"
REPO_SIG=$(grep -n "class JsonLinesReplayRepository" -A 80 src/infrastructure/replay/JsonLinesReplayRepository.ts || true)

cat > "$OUTPUT_FILE" <<EOF
{
  "runtimeKernel": $(echo "$KERNEL_SIG" | sed 's/"/\\"/g' | awk '{printf "\"%s\\n\"", $0}'),
  "runtimeShutdownCoordinator": $(echo "$SHUTDOWN_SIG" | sed 's/"/\\"/g' | awk '{printf "\"%s\\n\"", $0}'),
  "jsonLinesReplayRepository": $(echo "$REPO_SIG" | sed 's/"/\\"/g' | awk '{printf "\"%s\\n\"", $0}')
}
EOF

log "Contract map generated at $OUTPUT_FILE"

echo ""
echo "=============================="
echo "PASS E0.0 CONTRACT DISCOVERY"
echo "OUTPUT: $OUTPUT_FILE"
echo "=============================="
