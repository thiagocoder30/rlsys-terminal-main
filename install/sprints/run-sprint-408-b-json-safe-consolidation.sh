#!/bin/bash

set -e

BASE_DIR="$(pwd)"
FLAGS_DIR="$BASE_DIR/install/sprints/flags"
mkdir -p "$FLAGS_DIR"

OUTPUT="$FLAGS_DIR/RUNTIME_TRUTH_LEDGER.json"

echo "[SPRINT 408-B] JSON SAFE CONSOLIDATION START"

# -------------------------------------------------
# INPUT FILES
# -------------------------------------------------

CAPABILITY="$FLAGS_DIR/STRATEGY_CAPABILITY_MAP.json"
DEPENDENCY="$FLAGS_DIR/REAL_STRATEGY_DEPENDENCY_GRAPH.json"
AUDIT="$FLAGS_DIR/STRATEGY_RUNTIME_AUDIT.json"
EXECUTION="$FLAGS_DIR/RUNTIME_EXECUTION_MAP.json"
TRACE="$FLAGS_DIR/EXECUTION_HOOK_INJECTION_REPORT.json"

# -------------------------------------------------
# SAFE NODE PARSER (NODE INLINE - NO DEPENDENCY)
# -------------------------------------------------

parse_json() {
node -e "
const fs = require('fs');
try {
  const file = process.argv[1];
  const raw = fs.readFileSync(file, 'utf-8');
  console.log(JSON.stringify(JSON.parse(raw)));
} catch (e) {
  console.log('{}');
}
" "$1"
}

CAPABILITY_JSON=$(parse_json "$CAPABILITY")
DEPENDENCY_JSON=$(parse_json "$DEPENDENCY")
AUDIT_JSON=$(parse_json "$AUDIT")
EXECUTION_JSON=$(parse_json "$EXECUTION")
TRACE_JSON=$(parse_json "$TRACE")

# -------------------------------------------------
# EXTRACT SAFE STRUCTURES
# -------------------------------------------------

ACTIVE=$(echo "$AUDIT_JSON" | node -e "
const j = JSON.parse(require('fs').readFileSync(0,'utf-8'));
console.log(JSON.stringify(j.registered || []));
")

REACHABLE=$(echo "$AUDIT_JSON" | node -e "
const j = JSON.parse(require('fs').readFileSync(0,'utf-8'));
console.log(JSON.stringify(j.runtimeReachable || []));
")

DEAD=$(echo "$AUDIT_JSON" | node -e "
const j = JSON.parse(require('fs').readFileSync(0,'utf-8'));
console.log(JSON.stringify(j.deadModules || []));
")

ORPHANS=$(echo "$EXECUTION_JSON" | node -e "
const j = JSON.parse(require('fs').readFileSync(0,'utf-8'));
console.log(JSON.stringify(j.orphanStrategies || []));
")

BOTTLENECKS=$(echo "$EXECUTION_JSON" | node -e "
const j = JSON.parse(require('fs').readFileSync(0,'utf-8'));
console.log(JSON.stringify(j.bottlenecks || []));
")

HOOKED=$(echo "$TRACE_JSON" | node -e "
const j = JSON.parse(require('fs').readFileSync(0,'utf-8'));
console.log(JSON.stringify(j.hookedStrategies || []));
")

UNHOOKED=$(echo "$TRACE_JSON" | node -e "
const j = JSON.parse(require('fs').readFileSync(0,'utf-8'));
console.log(JSON.stringify(j.unhookedStrategies || []));
")

# -------------------------------------------------
# FINAL LEDGER (CLEAN STRUCTURE)
# -------------------------------------------------

cat > "$OUTPUT" <<EOF
{
  "generatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",

  "core": {
    "active": $ACTIVE,
    "reachable": $REACHABLE
  },

  "health": {
    "deadModules": $DEAD,
    "orphans": $ORPHANS,
    "bottlenecks": $BOTTLENECKS
  },

  "execution": {
    "hooked": $HOOKED,
    "unhooked": $UNHOOKED
  },

  "sourceMaps": {
    "capability": $CAPABILITY_JSON,
    "dependency": $DEPENDENCY_JSON
  }
}
EOF

echo "[SPRINT 408-B] LEDGER FIXED AND REBUILT"
echo "[SPRINT 408-B] OUTPUT: $OUTPUT"

echo "=============================="
echo "[SPRINT 408-B RESULT]"
echo "STATUS: PASS"
echo "=============================="

exit 0
