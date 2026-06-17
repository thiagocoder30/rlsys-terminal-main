#!/bin/bash

echo "[SPRINT 417] RUNTIME SPRINT IDENTITY BINDING ENGINE START"

BASE_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FLAGS_DIR="$BASE_DIR/install/sprints/flags"
LOG_DIR="$BASE_DIR/install/sprints/logs"

mkdir -p "$FLAGS_DIR"
mkdir -p "$LOG_DIR"

# -----------------------------
# SPRINT ID (deterministic input)
# -----------------------------
SPRINT_ID_INPUT="$1"

if [ -z "$SPRINT_ID_INPUT" ]; then
  SPRINT_ID_INPUT=$(date +%Y%m%d%H%M%S)
fi

echo "[417] SPRINT ID: $SPRINT_ID_INPUT"

# -----------------------------
# SAFE FILE RESOLUTION (NO MORE "latest file" BUG)
# -----------------------------
find_latest_by_pattern() {
  local pattern=$1
  ls -t "$FLAGS_DIR"/$pattern 2>/dev/null | head -n 1
}

LEDGER_FILE=$(find_latest_by_pattern "*TRUTH*.json")
RECEIPT_FILE=$(find_latest_by_pattern "receipt_*.json")

# -----------------------------
# BINDING KEY GENERATION
# -----------------------------
BIND_KEY=$(echo -n "SPRINT-$SPRINT_ID_INPUT" | sha256sum | awk '{print $1}')

echo "[417] LEDGER: $LEDGER_FILE"
echo "[417] RECEIPT: $RECEIPT_FILE"

# -----------------------------
# JSON SAFE PARSER (jq + fallback)
# -----------------------------
parse_json_safe() {
  local file=$1
  local key=$2

  if [ ! -f "$file" ]; then
    echo ""
    return
  fi

  if command -v jq >/dev/null 2>&1; then
    jq -r ".$key // empty" "$file" 2>/dev/null
  else
    grep -o "\"$key\"[[:space:]]*:[[:space:]]*[^,}]*" "$file" | head -n 1 | cut -d ':' -f2 | tr -d '" '
  fi
}

# -----------------------------
# LEDGER EXTRACTION
# -----------------------------
ledger_status=$(parse_json_safe "$LEDGER_FILE" "status")
ledger_time=$(parse_json_safe "$LEDGER_FILE" "generatedAt")

if [ -z "$ledger_status" ]; then ledger_status="UNKNOWN"; fi
if [ -z "$ledger_time" ]; then ledger_time="INVALID"; fi

# -----------------------------
# RECEIPT VALIDATION
# -----------------------------
receipt_valid=0
if [ -f "$RECEIPT_FILE" ]; then
  receipt_checksum=$(parse_json_safe "$RECEIPT_FILE" "checksum")
  actual_checksum=$(sha256sum "$LEDGER_FILE" 2>/dev/null | awk '{print $1}')

  if [ "$receipt_checksum" = "$actual_checksum" ]; then
    receipt_valid=1
  fi
fi

# -----------------------------
# SPRINT BINDING VALIDATION
# -----------------------------
binding_strength=0

if [ -n "$LEDGER_FILE" ]; then
  binding_strength=$((binding_strength + 40))
fi

if [ "$receipt_valid" -eq 1 ]; then
  binding_strength=$((binding_strength + 40))
fi

if [ "$ledger_status" != "UNKNOWN" ]; then
  binding_strength=$((binding_strength + 20))
fi

# -----------------------------
# CLASSIFICATION
# -----------------------------
if [ "$binding_strength" -ge 80 ]; then
  status="BINDING_CONFIRMED"
elif [ "$binding_strength" -ge 50 ]; then
  status="PARTIALLY_BOUND"
else
  status="UNBOUND_STATE"
fi

# -----------------------------
# OUTPUT REPORT
# -----------------------------
OUT="$FLAGS_DIR/RUNTIME_SPRINT_IDENTITY_BINDING_REPORT.json"

cat > "$OUT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "sprintId": "$SPRINT_ID_INPUT",
  "bindingKey": "$BIND_KEY",
  "inputs": {
    "ledgerFile": "$LEDGER_FILE",
    "receiptFile": "$RECEIPT_FILE"
  },
  "validation": {
    "ledgerStatus": "$ledger_status",
    "receiptValid": $receipt_valid
  },
  "binding": {
    "strength": $binding_strength,
    "status": "$status"
  }
}
EOF

echo "=============================="
echo "[SPRINT 417 RESULT]"
echo "SPRINT ID: $SPRINT_ID_INPUT"
echo "BINDING STRENGTH: $binding_strength"
echo "STATUS: $status"
echo "OUTPUT: $OUT"
echo "=============================="

echo "[SPRINT 417] COMPLETE"
