#!/data/data/com.termux/files/usr/bin/bash

echo "[SPRINT 412] RUNTIME CAUSAL INTEGRITY VALIDATOR ENGINE START"

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FLAGS_DIR="$ROOT_DIR/install/sprints/flags"

LEDGER="$FLAGS_DIR/RUNTIME_TRUTH_LEDGER.json"
COHERENCE="$FLAGS_DIR/STRATEGY_RUNTIME_COHERENCE_REPORT.json"
FLOW="$FLAGS_DIR/RUNTIME_EXECUTION_MAP.json"
SEMANTIC="$FLAGS_DIR/RUNTIME_SEMANTIC_NORMALIZATION_REPORT.json"
DEPENDENCY="$FLAGS_DIR/REAL_STRATEGY_DEPENDENCY_GRAPH.json"

mkdir -p "$FLAGS_DIR"

# -----------------------------
# SAFE PARSING (jq + fallback)
# -----------------------------
safe_get() {
  local file=$1
  local query=$2
  if command -v jq >/dev/null 2>&1 && [ -f "$file" ]; then
    jq -r "$query" "$file" 2>/dev/null
  else
    echo "0"
  fi
}

echo "[412] LOADING MULTI-LAYER STATE..."

HOOKED=$(safe_get "$LEDGER" '.execution.hooked | length')
ORPHANS=$(safe_get "$LEDGER" '.health.orphans | length')
BOTTLENECKS=$(safe_get "$LEDGER" '.health.bottlenecks | length')
DEAD=$(safe_get "$LEDGER" '.health.deadModules | length')

COHERENCE_SCORE=$(safe_get "$COHERENCE" '.coherenceScore')
FLOW_SCORE=$(safe_get "$FLOW" '.flowHealthScore')
SEMANTIC_SCORE=$(safe_get "$SEMANTIC" '.semantic.semanticScore')

# -----------------------------
# CAUSAL VALIDATION ENGINE
# -----------------------------

echo "[412] RUNNING CAUSAL CONSISTENCY CHECK..."

# contradiction detection
CONTRADICTIONS=0

if [ "$ORPHANS" -gt 0 ] && [ "$COHERENCE_SCORE" -gt 80 ]; then
  CONTRADICTIONS=$((CONTRADICTIONS+1))
fi

if [ "$DEAD" -gt 0 ] && [ "$SEMANTIC_SCORE" -gt 90 ]; then
  CONTRADICTIONS=$((CONTRADICTIONS+1))
fi

if [ "$BOTTLENECKS" -gt 10 ] && [ "$FLOW_SCORE" -gt 70 ]; then
  CONTRADICTIONS=$((CONTRADICTIONS+1))
fi

# causal score formula (lightweight, deterministic)
BASE=100
PENALTY=$((ORPHANS * 5 + DEAD * 10 + BOTTLENECKS * 2 + CONTRADICTIONS * 15))
CAUSAL_SCORE=$((BASE - PENALTY))

if [ "$CAUSAL_SCORE" -lt 0 ]; then
  CAUSAL_SCORE=0
fi

# -----------------------------
# STATUS CLASSIFICATION
# -----------------------------
if [ "$CAUSAL_SCORE" -ge 80 ]; then
  STATUS="CAUSALLY_STRONG"
elif [ "$CAUSAL_SCORE" -ge 50 ]; then
  STATUS="CAUSALLY_STABLE"
else
  STATUS="CAUSALLY_DEGRADED"
fi

# -----------------------------
# OUTPUT
# -----------------------------

OUTPUT_FILE="$FLAGS_DIR/RUNTIME_CAUSAL_INTEGRITY_REPORT.json"

cat > "$OUTPUT_FILE" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "inputs": {
    "hooked": $HOOKED,
    "orphans": $ORPHANS,
    "bottlenecks": $BOTTLENECKS,
    "dead": $DEAD,
    "coherence": $COHERENCE_SCORE,
    "flow": $FLOW_SCORE,
    "semantic": $SEMANTIC_SCORE
  },
  "analysis": {
    "contradictions": $CONTRADICTIONS,
    "causalScore": $CAUSAL_SCORE,
    "status": "$STATUS"
  }
}
EOF

echo "=============================="
echo "[SPRINT 412 RESULT]"
echo "CAUSAL SCORE: $CAUSAL_SCORE"
echo "STATUS: $STATUS"
echo "CONTRADICTIONS: $CONTRADICTIONS"
echo "OUTPUT: $OUTPUT_FILE"
echo "=============================="

echo "[SPRINT 412] COMPLETE"
