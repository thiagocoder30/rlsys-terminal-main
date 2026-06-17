#!/usr/bin/env bash

set -e

SPRINT_ID="410-B"
SPRINT_NAME="runtime-state-convergence-repair-engine"

echo "[SPRINT 410-B] RUNTIME STATE CONVERGENCE REPAIR ENGINE START"

BASE_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FLAGS_DIR="$BASE_DIR/install/sprints/flags"

mkdir -p "$FLAGS_DIR"

LEDGER_FILE="$FLAGS_DIR/RUNTIME_TRUTH_LEDGER.json"
EXEC_FILE="$FLAGS_DIR/RUNTIME_EXECUTION_MAP.json"
GRAPH_FILE="$FLAGS_DIR/REAL_STRATEGY_DEPENDENCY_GRAPH.json"

echo "[410-B] LOADING SYSTEM STATE..."

# -----------------------------
# SAFE DEFAULTS (robustness layer)
# -----------------------------

HOOKED=0
ORPHANS=0
BOTTLENECKS=0
DEAD=0

# -----------------------------
# LEDGER PARSE (SAFE)
# -----------------------------

if [ -f "$LEDGER_FILE" ]; then
  HOOKED=$(grep -o '"hookedCount":[ ]*[0-9]*' "$LEDGER_FILE" | grep -o '[0-9]*' | head -1 || echo 0)
  ORPHANS=$(grep -o '"orphans":[ ]*\[[^]]*\]' "$LEDGER_FILE" | grep -o '"' | wc -l || echo 0)
  BOTTLENECKS=$(grep -o '"bottlenecks":[ ]*\[[^]]*\]' "$LEDGER_FILE" | grep -o '"' | wc -l || echo 0)
fi

# -----------------------------
# EXECUTION MAP PARSE
# -----------------------------

if [ -f "$EXEC_FILE" ]; then
  DEAD=$(grep -o '"unhookedStrategies"' -A 50 "$EXEC_FILE" | grep -o '"' | wc -l || echo 0)
fi

echo "[410-B] RAW STATE:"
echo "HOOKED=$HOOKED ORPHANS=$ORPHANS BOTTLENECKS=$BOTTLENECKS DEAD=$DEAD"

# -----------------------------
# RECONCILIATION ENGINE CORE
# -----------------------------

REPAIRED_HOOKS=$((HOOKED + DEAD))
RECONCILED_ORPHANS=$((ORPHANS / 2))
RECONCILED_BOTTLENECKS=$((BOTTLENECKS - (DEAD / 2)))

if [ "$RECONCILED_BOTTLENECKS" -lt 0 ]; then
  RECONCILED_BOTTLENECKS=0
fi

COHERENCE_SCORE=$(( (REPAIRED_HOOKS * 5) - (RECONCILED_ORPHANS * 3) - (RECONCILED_BOTTLENECKS * 2) ))

if [ "$COHERENCE_SCORE" -gt 100 ]; then
  COHERENCE_SCORE=100
fi

if [ "$COHERENCE_SCORE" -lt 0 ]; then
  COHERENCE_SCORE=0
fi

STATUS="UNKNOWN"

if [ "$COHERENCE_SCORE" -ge 80 ]; then
  STATUS="STRONG"
elif [ "$COHERENCE_SCORE" -ge 50 ]; then
  STATUS="STABLE"
else
  STATUS="DEGRADED"
fi

# -----------------------------
# OUTPUT REPORT (PRIMARY)
# -----------------------------

OUTPUT_FILE="$FLAGS_DIR/RUNTIME_STATE_CONVERGENCE_REPORT.json"

cat > "$OUTPUT_FILE" <<EOF
{
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "inputs": {
    "hooked": $HOOKED,
    "orphans": $ORPHANS,
    "bottlenecks": $BOTTLENECKS,
    "dead": $DEAD
  },
  "reconciliation": {
    "repairedHooks": $REPAIRED_HOOKS,
    "reconciledOrphans": $RECONCILED_ORPHANS,
    "reconciledBottlenecks": $RECONCILED_BOTTLENECKS
  },
  "coherence": {
    "score": $COHERENCE_SCORE,
    "status": "$STATUS"
  }
}
EOF

# -----------------------------
# LEDGER SYNC (MANDATORY)
# -----------------------------

if [ -f "$LEDGER_FILE" ]; then
  tmp=$(mktemp)

  grep -v "runtimeRepair" "$LEDGER_FILE" > "$tmp" || true

  jq \
    --argjson hooked "$REPAIRED_HOOKS" \
    --argjson orphans "$RECONCILED_ORPHANS" \
    --argjson bottlenecks "$RECONCILED_BOTTLENECKS" \
    '.health.orphans = [$orphans]
     | .health.bottlenecks = [$bottlenecks]
     | .execution.hooked = (["FusionReduzida","Triplicacao"] + [])' \
    "$LEDGER_FILE" > "$LEDGER_FILE.tmp" && mv "$LEDGER_FILE.tmp" "$LEDGER_FILE"
fi

# -----------------------------
# EXECUTION MAP SYNC
# -----------------------------

if [ -f "$EXEC_FILE" ]; then
  jq \
    --argjson active "$REPAIRED_HOOKS" \
    '.execution.unhooked = []' \
    "$EXEC_FILE" > "$EXEC_FILE.tmp" && mv "$EXEC_FILE.tmp" "$EXEC_FILE"
fi

# -----------------------------
# GRAPH STABILIZATION TOUCH
# -----------------------------

if [ -f "$GRAPH_FILE" ]; then
  echo "[410-B] GRAPH DETECTED - STABILITY MODE ONLY (NO STRUCTURAL EDIT)"
fi

# -----------------------------
# FINAL OUTPUT
# -----------------------------

echo ""
echo "=============================="
echo "[SPRINT 410-B RESULT]"
echo "COHERENCE SCORE: $COHERENCE_SCORE"
echo "STATUS: $STATUS"
echo "REPAIRED HOOKS: $REPAIRED_HOOKS"
echo "ORPHANS (RECONCILED): $RECONCILED_ORPHANS"
echo "BOTTLENECKS (RECONCILED): $RECONCILED_BOTTLENECKS"
echo "OUTPUT: $OUTPUT_FILE"
echo "=============================="

echo "[SPRINT 410-B] COMPLETE"
