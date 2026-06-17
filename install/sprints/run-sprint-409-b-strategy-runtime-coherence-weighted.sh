#!/bin/bash

echo "[SPRINT 409-B] WEIGHTED COHERENCE ENGINE START"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

LEDGER_FILE="$ROOT_DIR/install/sprints/flags/RUNTIME_TRUTH_LEDGER.json"

OUTPUT="$ROOT_DIR/install/sprints/flags/STRATEGY_RUNTIME_COHERENCE_WEIGHTED_REPORT.json"

mkdir -p "$ROOT_DIR/install/sprints/flags"

echo "[409-B] LOADING LEDGER..."

HOOKED=$(grep -o '"hooked"' "$LEDGER_FILE" | wc -l)
ORPHANS=$(grep -o '"orphans"' "$LEDGER_FILE" | wc -l)
DEAD=$(grep -o '"deadModules"' "$LEDGER_FILE" | wc -l)
BOTTLENECKS=$(grep -o '"bottlenecks"' "$LEDGER_FILE" | wc -l)

BASE_SCORE=$((HOOKED * 6))

PENALTY=$((ORPHANS * 10 + DEAD * 20 + BOTTLENECKS * 2))

COHERENCE_SCORE=$((BASE_SCORE - PENALTY))

if [ "$COHERENCE_SCORE" -gt 100 ]; then
  COHERENCE_SCORE=100
fi

if [ "$COHERENCE_SCORE" -lt 0 ]; then
  COHERENCE_SCORE=0
fi

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
    "hooked": $HOOKED,
    "orphans": $ORPHANS,
    "deadModules": $DEAD,
    "bottlenecks": $BOTTLENECKS
  },
  "model": "weighted-coherence-v1"
}
EOF

echo ""
echo "=============================="
echo "[SPRINT 409-B RESULT]"
echo "COHERENCE SCORE: $COHERENCE_SCORE"
echo "STATUS: $STATUS"
echo "=============================="

echo "[SPRINT 409-B] COMPLETE"
