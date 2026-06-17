#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)

LOG_DIR="install/sprints/logs"
mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%d_%H-%M-%S")

LOG="$LOG_DIR/e0-0-3-shutdown-reason-ast_$TS.log"
OUTPUT="$LOG_DIR/e0-0-3-shutdown-reason-values_$TS.json"

log() {
  echo "[$(date +"%H:%M:%S")] [INFO] $1" | tee -a "$LOG"
}

log "E0.0.3 STRICT TYPE ENUM EXTRACTOR START"

cd "$ROOT"

FILE=$(grep -R "RuntimeShutdownReason" -n src | head -n 1 | cut -d: -f1)

log "Type definition file: $FILE"

node <<'EOF' > "$OUTPUT"
const fs = require('fs');

const file = process.argv[1] || 'src/application/runtime/RuntimeShutdownCoordinator.ts';

const content = fs.readFileSync(file, 'utf8');

// extract union types like: 'A' | 'B'
const unionMatch = content.match(/RuntimeShutdownReason\s*=\s*([^;]+)/s);

let values = [];

if (unionMatch) {
  values = unionMatch[1]
    .split('|')
    .map(v => v.trim().replace(/['"`]/g, ''))
    .filter(v => v.length > 0);
}

// fallback enum extraction
const enumMatch = content.match(/enum\s+RuntimeShutdownReason\s*{([\s\S]*?)}/);

if (enumMatch) {
  values = enumMatch[1]
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.includes('='))
    .map(l => l.split('=')[0].trim());
}

fs.writeFileSync(0, JSON.stringify({
  file,
  values
}, null, 2));
EOF

log "Extraction complete"

echo ""
echo "=============================="
echo "PASS E0.0.3 SHUTDOWN ENUM EXTRACTED"
echo "OUTPUT: $OUTPUT"
echo "=============================="
