#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)

LOG_DIR="install/sprints/logs"
mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%d_%H-%M-%S")

LOG="$LOG_DIR/e0-0-4-type-graph_$TS.log"
REF_FILE="$LOG_DIR/e0-0-4-refs_$TS.txt"
NODE_FILE="$LOG_DIR/e0-0-4-resolver_$TS.js"
OUTPUT="$LOG_DIR/e0-0-4-type-graph_$TS.json"

log() {
  echo "[$(date +"%H:%M:%S")] [INFO] $1" | tee -a "$LOG"
}

log "E0.0.4 TYPE GRAPH RESOLVER START"

cd "$ROOT"

TARGET="RuntimeShutdownReason"

log "Collecting references..."
grep -R --line-number "$TARGET" src > "$REF_FILE" || true

log "Building resolver script..."

cat > "$NODE_FILE" <<EOF
const fs = require('fs');

const refs = fs.readFileSync("$REF_FILE", 'utf8')
  .split('\n')
  .filter(Boolean);

const files = new Set();

for (const r of refs) {
  const file = r.split(':')[0];
  if (file) files.add(file);
}

const result = [];

for (const f of files) {
  try {
    const content = fs.readFileSync(f, 'utf8');

    if (content.includes('RuntimeShutdownReason')) {
      result.push({
        file: f,
        snippet: content.slice(0, 300)
      });
    }
  } catch (e) {}
}

fs.writeFileSync(
  "$OUTPUT",
  JSON.stringify({
    target: "RuntimeShutdownReason",
    locations: result
  }, null, 2)
);

console.log("OK");
EOF

log "Executing resolver"

node "$NODE_FILE"

rm -f "$NODE_FILE"

log "DONE"

echo ""
echo "=============================="
echo "PASS E0.0.4 TYPE GRAPH RESOLVED"
echo "OUTPUT: $OUTPUT"
echo "=============================="
