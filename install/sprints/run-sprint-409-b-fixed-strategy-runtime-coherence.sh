#!/bin/bash

echo "[SPRINT 409-B FIX] JSON-AWARE COHERENCE ENGINE START"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

LEDGER_FILE="$ROOT_DIR/install/sprints/flags/RUNTIME_TRUTH_LEDGER.json"
OUTPUT="$ROOT_DIR/install/sprints/flags/STRATEGY_RUNTIME_COHERENCE_FIXED_REPORT.json"

mkdir -p "$ROOT_DIR/install/sprints/flags"

if [ ! -f "$LEDGER_FILE" ]; then
  echo "[409-B FIX] LEDGER NOT FOUND"
  exit 1
fi

echo "[409-B FIX] PARSING JSON LEDGER..."

# SAFE PARSING (jq if available, fallback awk)
if command -v jq >/dev/null 2>&1; then

  HOOKED=$(jq '.execution.hooked | length' "$LEDGER_FILE")
  ORPHANS=$(jq '.health.orphans | length' "$LEDGER_FILE")
  DEAD=$(jq '.health.deadModules | length' "$LEDGER_FILE")
  BOTTLENECKS=$(jq '.health.bottlenecks | length' "$LEDGER_FILE")

else

  HOOKED=$(grep -o '"hooked":\s*\[' "$LEDGER_FILE" | wc -l)
  ORPHANS=$(grep -o '"orphans"' "$LEDGER_FILE" | wc -l)
  DEAD=$(grep -o '"deadModules"' "$LEDGER_FILE" | wc -l)
  BOTTLENECKS=$(grep -o '"bottlenecks"' "$LEDGER_FILE" | wc -l)

fi

echo "[409-B FIX] HOOKED=$HOOKED ORPHANS=$ORPHANS DEAD=$DEAD BOTTLENECKS=$BOTTLENECKS"

BASE=$((HOOKED * 8))
PENALTY=$((ORPHANS * 15 + DEAD * 25 + BOTTLENECKS * 3))

COHERENCE=$((BASE - PENALTY))

if [ "$COHERENCE" -gt 100 ]; then COHERENCE=100; fi
if [ "$COHERENCE" -lt 0 ]; then COHERENCE=0; fi

if [ "$COHERENCE" -gt 80 ]; then
  STATUS="STRONG"
elif [ "$COHERENCE" -gt 50 ]; then
  STATUS="MODERATE"
else
  STATUS="WEAK"
fi

cat > "$OUTPUT" <<EOF
{
  "generatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "coherenceScore": $COHERENCE,
  "status": "$STATUS",
  "inputs": {
    "hooked": $HOOKED,
    "orphans": $ORPHANS,
    "deadModules": $DEAD,
    "bottlenecks": $BOTTLENECKS
  },
  "model": "json-aware-coherence-v2"
}
EOF

echo ""
echo "=============================="
echo "[SPRINT 409-B FIX RESULT]"
echo "COHERENCE SCORE: $COHERENCE"
echo "STATUS: $STATUS"
echo "=============================="

echo "[SPRINT 409-B FIX] COMPLETE"
