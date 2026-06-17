#!/bin/bash

echo "[SPRINT 418] RUNTIME EXECUTION CONTRACT ENFORCEMENT ENGINE START"

BASE_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FLAGS_DIR="$BASE_DIR/install/sprints/flags"
LOG_DIR="$BASE_DIR/install/sprints/logs"

mkdir -p "$FLAGS_DIR"
mkdir -p "$LOG_DIR"

SPRINT_ID="$1"

if [ -z "$SPRINT_ID" ]; then
  echo "[418] ERROR: SPRINT_ID is required"
  exit 1
fi

echo "[418] SPRINT_ID: $SPRINT_ID"

# -----------------------------
# CONTRACT DEFINITIONS
# -----------------------------
REQUIRED_LEDGER_PATTERN="RUNTIME*TRUTH*"
REQUIRED_RECEIPT_PREFIX="receipt_RUNTIME_${SPRINT_ID}"

# -----------------------------
# FILE DISCOVERY (STRICT MODE)
# -----------------------------
LEDGER_FILE="$FLAGS_DIR/RUNTIME_INSTALLATION_TRUTH_GATE_REPORT.json"
RECEIPT_FILE="$LOG_DIR/${REQUIRED_RECEIPT_PREFIX}.json"

echo "[418] EXPECTED LEDGER: $LEDGER_FILE"
echo "[418] EXPECTED RECEIPT: $RECEIPT_FILE"

# -----------------------------
# VALIDATION HELPERS
# -----------------------------
file_exists() {
  [ -f "$1" ]
}

json_valid() {
  if command -v jq >/dev/null 2>&1; then
    jq empty "$1" >/dev/null 2>&1
    return $?
  else
    grep -q "{" "$1"
    return $?
  fi
}

# -----------------------------
# CONTRACT CHECK
# -----------------------------
contract_score=0
violations=()

if file_exists "$LEDGER_FILE"; then
  contract_score=$((contract_score + 40))
else
  violations+=("MISSING_LEDGER")
fi

if file_exists "$RECEIPT_FILE"; then
  contract_score=$((contract_score + 40))
else
  violations+=("MISSING_RECEIPT")
fi

if file_exists "$LEDGER_FILE" && json_valid "$LEDGER_FILE"; then
  contract_score=$((contract_score + 20))
else
  violations+=("INVALID_LEDGER_JSON")
fi

# -----------------------------
# STATUS CLASSIFICATION
# -----------------------------
if [ "$contract_score" -ge 80 ]; then
  status="CONTRACT_ENFORCED"
elif [ "$contract_score" -ge 40 ]; then
  status="PARTIAL_CONTRACT_VIOLATION"
else
  status="CONTRACT_BROKEN"
fi

# -----------------------------
# OUTPUT REPORT
# -----------------------------
OUT_FILE="$FLAGS_DIR/RUNTIME_EXECUTION_CONTRACT_ENFORCEMENT_REPORT.json"

cat > "$OUT_FILE" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "sprintId": "$SPRINT_ID",
  "contract": {
    "score": $contract_score,
    "status": "$status"
  },
  "expected": {
    "ledger": "$LEDGER_FILE",
    "receipt": "$RECEIPT_FILE"
  },
  "violations": $(printf '%s\n' "${violations[@]}" | jq -R . | jq -s .)
}
EOF

echo "=============================="
echo "[SPRINT 418 RESULT]"
echo "SPRINT ID: $SPRINT_ID"
echo "CONTRACT SCORE: $contract_score"
echo "STATUS: $status"
echo "OUTPUT: $OUT_FILE"
echo "=============================="

echo "[SPRINT 418] COMPLETE"
