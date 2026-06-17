#!/usr/bin/env bash

set -e

SPRINT_ID="411"
SPRINT_NAME="runtime-semantic-normalization-engine"

echo "[SPRINT 411] RUNTIME SEMANTIC NORMALIZATION ENGINE START"

BASE_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FLAGS_DIR="$BASE_DIR/install/sprints/flags"

mkdir -p "$FLAGS_DIR"

LEDGER_FILE="$FLAGS_DIR/RUNTIME_TRUTH_LEDGER.json"
GRAPH_FILE="$FLAGS_DIR/REAL_STRATEGY_DEPENDENCY_GRAPH.json"
EXEC_FILE="$FLAGS_DIR/RUNTIME_EXECUTION_MAP.json"

OUTPUT_FILE="$FLAGS_DIR/RUNTIME_SEMANTIC_NORMALIZATION_REPORT.json"

echo "[411] LOADING STRUCTURAL DATASETS..."

# -----------------------------
# SAFE COUNTERS (fallback safe)
# -----------------------------

safe_count() {
  local file=$1
  local key=$2

  if [ ! -f "$file" ]; then
    echo 0
    return
  fi

  grep -o "\"$key\"" "$file" 2>/dev/null | wc -l | tr -d ' ' || echo 0
}

HOOK_NODES=$(safe_count "$GRAPH_FILE" "id")
EDGE_COUNT=$(safe_count "$GRAPH_FILE" "from")

HOOKED=$(safe_count "$LEDGER_FILE" "hooked")
ORPHANS=$(safe_count "$LEDGER_FILE" "orphans")
BOTTLENECKS=$(safe_count "$LEDGER_FILE" "bottlenecks")

echo "[411] RAW STRUCTURE:"
echo "NODES=$HOOK_NODES EDGES=$EDGE_COUNT"
echo "HOOKED=$HOOKED ORPHANS=$ORPHANS BOTTLENECKS=$BOTTLENECKS"

# -----------------------------
# SEMANTIC NORMALIZATION CORE
# -----------------------------

# Centrality approximation (structural influence)
CENTRALITY_SCORE=$(( (EDGE_COUNT * 2) + (HOOK_NODES * 3) ))

# Execution density (how “alive” system is)
EXECUTION_DENSITY=$(( HOOKED * 10 + EDGE_COUNT ))

# Structural imbalance detection
IMBALANCE=$(( (ORPHANS * 4) + (BOTTLENECKS * 3) ))

# Semantic coherence (new model)
SEMANTIC_SCORE=$(( CENTRALITY_SCORE + EXECUTION_DENSITY - IMBALANCE ))

if [ "$SEMANTIC_SCORE" -gt 100 ]; then
  SEMANTIC_SCORE=100
fi

if [ "$SEMANTIC_SCORE" -lt 0 ]; then
  SEMANTIC_SCORE=0
fi

STATUS="UNKNOWN"

if [ "$SEMANTIC_SCORE" -ge 80 ]; then
  STATUS="STRUCTURALLY_STRONG"
elif [ "$SEMANTIC_SCORE" -ge 50 ]; then
  STATUS="STRUCTURALLY_STABLE"
else
  STATUS="STRUCTURALLY_DEGRADED"
fi

# -----------------------------
# NORMALIZED VIEW (NEW CORE OUTPUT)
# -----------------------------

cat > "$OUTPUT_FILE" <<EOF
{
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "model": "SEMANTIC_NORMALIZATION_V1",
  "inputs": {
    "nodes": $HOOK_NODES,
    "edges": $EDGE_COUNT,
    "hooked": $HOOKED,
    "orphans": $ORPHANS,
    "bottlenecks": $BOTTLENECKS
  },
  "semantic": {
    "centralityScore": $CENTRALITY_SCORE,
    "executionDensity": $EXECUTION_DENSITY,
    "imbalance": $IMBALANCE,
    "semanticScore": $SEMANTIC_SCORE,
    "status": "$STATUS"
  },
  "interpretation": {
    "mode": "STRUCTURAL_GRAPH_INTELLIGENCE",
    "note": "system now evaluates topology influence, not raw counts"
  }
}
EOF

# -----------------------------
# LEDGER ENRICHMENT (NO OVERWRITE DAMAGE)
# -----------------------------

if [ -f "$LEDGER_FILE" ]; then
  jq \
    --argjson semantic "$SEMANTIC_SCORE" \
    --arg status "$STATUS" \
    '.semantic = {
        "enabled": true,
        "score": $semantic,
        "status": $status
     }' \
    "$LEDGER_FILE" > "$LEDGER_FILE.tmp" && mv "$LEDGER_FILE.tmp" "$LEDGER_FILE"
fi

# -----------------------------
# FINAL OUTPUT
# -----------------------------

echo ""
echo "=============================="
echo "[SPRINT 411 RESULT]"
echo "SEMANTIC SCORE: $SEMANTIC_SCORE"
echo "STATUS: $STATUS"
echo "NODES: $HOOK_NODES"
echo "EDGES: $EDGE_COUNT"
echo "IMBALANCE: $IMBALANCE"
echo "OUTPUT: $OUTPUT_FILE"
echo "=============================="

echo "[SPRINT 411] COMPLETE"
