#!/bin/bash

echo "[SPRINT 410] RUNTIME FLOW RECONCILIATION ENGINE START"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

DEP_FILE="$ROOT_DIR/install/sprints/flags/REAL_STRATEGY_DEPENDENCY_GRAPH.json"
LEDGER_FILE="$ROOT_DIR/install/sprints/flags/RUNTIME_TRUTH_LEDGER.json"

OUTPUT="$ROOT_DIR/install/sprints/flags/RUNTIME_FLOW_RECONCILIATION_REPORT.json"

mkdir -p "$ROOT_DIR/install/sprints/flags"

if [ ! -f "$DEP_FILE" ]; then
  echo "[410] DEPENDENCY GRAPH NOT FOUND"
  exit 1
fi

if [ ! -f "$LEDGER_FILE" ]; then
  echo "[410] LEDGER NOT FOUND"
  exit 1
fi

echo "[410] ANALYZING EXECUTION FLOW..."

# -----------------------------
# EXTRAÇÃO DE ESTRUTURA REAL
# -----------------------------

NODES=$(grep -o '"id"' "$DEP_FILE" | wc -l)
EDGES=$(grep -o '"from"' "$DEP_FILE" | wc -l)

ORPHANS=$(grep -o '"orphans"' "$LEDGER_FILE" | wc -l)
BOTTLENECKS=$(grep -o '"bottlenecks"' "$LEDGER_FILE" | wc -l)
DEAD=$(grep -o '"deadModules"' "$LEDGER_FILE" | wc -l)

# -----------------------------
# FLOW METRICS
# -----------------------------

if [ "$NODES" -gt 0 ]; then
  CONNECTIVITY=$(( (EDGES * 100) / (NODES * 2) ))
else
  CONNECTIVITY=0
fi

# penalização estrutural
PENALTY=$((ORPHANS * 12 + DEAD * 25 + BOTTLENECKS * 3))

FLOW_HEALTH=$((CONNECTIVITY - PENALTY))

if [ "$FLOW_HEALTH" -gt 100 ]; then FLOW_HEALTH=100; fi
if [ "$FLOW_HEALTH" -lt 0 ]; then FLOW_HEALTH=0; fi

# -----------------------------
# BALANCE INDEX
# -----------------------------

if [ "$BOTTLENECKS" -gt 0 ]; then
  EXECUTION_BALANCE=$(( (NODES * 10) / BOTTLENECKS ))
else
  EXECUTION_BALANCE=100
fi

# -----------------------------
# STATUS CLASSIFICATION
# -----------------------------

if [ "$FLOW_HEALTH" -gt 75 ]; then
  STATUS="HEALTHY"
elif [ "$FLOW_HEALTH" -gt 45 ]; then
  STATUS="STABLE"
else
  STATUS="DEGRADED"
fi

# -----------------------------
# OUTPUT
# -----------------------------

cat > "$OUTPUT" <<EOF
{
  "generatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "flowHealthScore": $FLOW_HEALTH,
  "executionBalanceIndex": $EXECUTION_BALANCE,
  "status": "$STATUS",
  "inputs": {
    "nodes": $NODES,
    "edges": $EDGES,
    "orphans": $ORPHANS,
    "deadModules": $DEAD,
    "bottlenecks": $BOTTLENECKS
  },
  "model": "runtime-flow-reconciliation-v1",
  "interpretation": "execution-flow-not-just-structure"
}
EOF

echo ""
echo "=============================="
echo "[SPRINT 410 RESULT]"
echo "FLOW HEALTH SCORE: $FLOW_HEALTH"
echo "EXECUTION BALANCE: $EXECUTION_BALANCE"
echo "STATUS: $STATUS"
echo "=============================="

echo "[SPRINT 410] COMPLETE"
