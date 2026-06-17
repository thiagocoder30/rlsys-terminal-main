#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)

LOG_DIR="install/sprints/logs"
mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%d_%H-%M-%S")

LOG="$LOG_DIR/e0-0-3-shutdown-reason-extractor_$TS.log"
OUTPUT="$LOG_DIR/e0-0-3-shutdown-reason-values_$TS.json"
TMP_NODE="$LOG_DIR/e0-0-3-extractor_$TS.js"

log() {
  echo "[$(date +"%H:%M:%S")] [INFO] $1" | tee -a "$LOG"
}

log "E0.0.3 SHUTDOWN REASON EXTRACTOR START"

cd "$ROOT"

FILE=$(grep -R "RuntimeShutdownReason" -n src | head -n 1 | cut -d: -f1)

log "Type file detected: $FILE"

cat > "$TMP_NODE" <<EOF
const fs = require('fs');

const file = "$FILE";
const content = fs.readFileSync(file, 'utf8');

let values = [];

// union type extraction
const unionMatch = content.match(/RuntimeShutdownReason\\s*=\\s*([^;]+)/s);
if (unionMatch) {
  values = unionMatch[1]
    .split('|')
    .map(v => v.trim().replace(/['"\`]/g, ''))
    .filter(Boolean);
}

// enum extraction fallback
const enumMatch = content.match(/enum\\s+RuntimeShutdownReason\\s*{([\\s\\S]*?)}/);
if (enumMatch) {
  values = enumMatch[1]
    .split('\\n')
    .map(l => l.trim())
    .filter(l => l.includes('='))
    .map(l => l.split('=')[0].trim());
}

const out = {
  file,
  values
};

fs.writeFileSync("$OUTPUT", JSON.stringify(out, null, 2));
console.log("OK");
EOF

log "Executing isolated Node extractor"

node "$TMP_NODE" || {
  log "NODE EXEC FAILED"
  exit 1
}

rm -f "$TMP_NODE"

log "Extraction complete"

echo ""
echo "=============================="
echo "PASS E0.0.3 SHUTDOWN ENUM EXTRACTED"
echo "OUTPUT: $OUTPUT"
echo "=============================="
