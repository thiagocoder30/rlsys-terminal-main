#!/bin/bash

echo "[SPRINT 409] STRATEGY RUNTIME COHERENCE ENGINE START"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

LEDGER_FILE="$ROOT_DIR/install/sprints/flags/RUNTIME_TRUTH_LEDGER.json"
DEP_FILE="$ROOT_DIR/install/sprints/flags/REAL_STRATEGY_DEPENDENCY_GRAPH.json"
HOOK_FILE="$ROOT_DIR/install/sprints/flags/EXECUTION_HOOK_INJECTION_REPORT.json"

OUTPUT="$ROOT_DIR/install/sprints/flags/STRATEGY_RUNTIME_COHERENCE_REPORT.json"

mkdir -p "$ROOT_DIR/install/sprints/flags"

if [ ! -f "$LEDGER_FILE" ]; then
  echo "[409] LEDGER NOT FOUND"
  exit 1
fi

if [ ! -f "$DEP_FILE" ]; then
  echo "[409] DEPENDENCY GRAPH NOT FOUND"
  exit 1
fi

if [ ! -f "$HOOK_FILE" ]; then
  echo "[409] HOOK REPORT NOT FOUND"
  exit 1
fi

echo "[409] LOADING INPUTS..."

HOOKED_COUNT=$(grep -o "trace:start" "$HOOK_FILE" 2>/dev/null | wc -l)
ORPHANS=$(grep -o '"orphans"' "$LEDGER_FILE" | wc -l)
DEAD=$(grep -o '"deadModules"' "$LEDGER_FILE" | wc -l)

echo "[409] ANALYZING COHERENCE..."

COHERENCE_SCORE=$(( (HOOKED_COUNT * 100) / 18 ))

if [ "$COHERENCE_SCORE" -gt 80 ]; then
  STATUS="STRONG"
elif [ "$COHERENCE_SCORE" -gt 50 ]; then
  STATUS="MODERATE"
else
  STATUS="WEAK"
fi

cat > "$OUTPUT" <<EOF
{
  "generatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "coherenceScore": $COHERENCE_SCORE,
  "status": "$STATUS",
  "inputs": {
    "hookedCount": $HOOKED_COUNT,
    "orphanSignals": $ORPHANS,
    "deadSignals": $DEAD
  },
  "interpretation": {
    "risk": "runtime drift",
    "mode": "observability-only"
  }
}
EOF

echo ""
echo "=============================="
echo "[SPRINT 409 RESULT]"
echo "COHERENCE SCORE: $COHERENCE_SCORE"
echo "STATUS: $STATUS"
echo "OUTPUT: $OUTPUT"
echo "=============================="

echo "[SPRINT 409] COMPLETE"
