#!/bin/bash

echo "[SPRINT 416] INSTALLATION VERIFICATION & TRUTH GATE ENGINE START"

BASE_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FLAGS_DIR="$BASE_DIR/install/sprints/flags"
LOG_DIR="$BASE_DIR/install/sprints/logs"

mkdir -p "$FLAGS_DIR"
mkdir -p "$LOG_DIR"

LEDGER_FILE=$(ls -t "$FLAGS_DIR"/*.json 2>/dev/null | head -n 1)
RECEIPT_FILE=$(ls -t "$LOG_DIR"/receipt_*.json 2>/dev/null | head -n 1)

if [ ! -f "$LEDGER_FILE" ]; then
  echo "[416] NO LEDGER FOUND"
  exit 1
fi

echo "[416] LEDGER: $LEDGER_FILE"
echo "[416] RECEIPT: $RECEIPT_FILE"

# -----------------------------
# SAFE JSON PARSER (jq + fallback)
# -----------------------------
parse_json_safe() {
  local file=$1
  local key=$2

  if command -v jq >/dev/null 2>&1; then
    jq -r ".$key // empty" "$file" 2>/dev/null
  else
    grep -o "\"$key\"[[:space:]]*:[[:space:]]*[^,}]*" "$file" | head -n 1 | cut -d ':' -f2 | tr -d '" '
  fi
}

# -----------------------------
# LEDGER VALIDATION
# -----------------------------
generatedAt=$(parse_json_safe "$LEDGER_FILE" "generatedAt")
status=$(parse_json_safe "$LEDGER_FILE" "status")
coherence=$(parse_json_safe "$LEDGER_FILE" "coherenceScore")

# fallback checks
if [ -z "$generatedAt" ]; then generatedAt="INVALID"; fi
if [ -z "$status" ]; then status="UNKNOWN"; fi
if [ -z "$coherence" ]; then coherence=0; fi

# -----------------------------
# STRUCTURAL VALIDATION
# -----------------------------
json_valid=1
if ! jq . "$LEDGER_FILE" >/dev/null 2>&1; then
  json_valid=0
fi

# -----------------------------
# RECEIPT CROSS CHECK
# -----------------------------
receipt_valid=0
if [ -f "$RECEIPT_FILE" ]; then
  receipt_checksum=$(parse_json_safe "$RECEIPT_FILE" "checksum")
  ledger_checksum=$(sha256sum "$LEDGER_FILE" | awk '{print $1}')

  if [ "$receipt_checksum" = "$ledger_checksum" ]; then
    receipt_valid=1
  fi
fi

# -----------------------------
# TRUTH GATE SCORE
# -----------------------------
score=0

if [ "$json_valid" -eq 1 ]; then score=$((score+40)); fi
if [ "$receipt_valid" -eq 1 ]; then score=$((score+40)); fi
if [ "$status" = "DATA_INTEGRITY_STRONG" ] || [ "$status" = "STRUCTURALLY_STRONG" ]; then
  score=$((score+20))
fi

# -----------------------------
# RESULT CLASSIFICATION
# -----------------------------
if [ "$score" -ge 80 ]; then
  final_status="TRUTH_CONFIRMED"
elif [ "$score" -ge 50 ]; then
  final_status="PARTIALLY_TRUSTED"
else
  final_status="UNTRUSTED_STATE"
fi

# -----------------------------
# OUTPUT REPORT
# -----------------------------
OUT="$FLAGS_DIR/RUNTIME_INSTALLATION_TRUTH_GATE_REPORT.json"

cat > "$OUT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "inputs": {
    "ledger": "$LEDGER_FILE",
    "receipt": "$RECEIPT_FILE"
  },
  "validation": {
    "jsonValid": $json_valid,
    "receiptValid": $receipt_valid,
    "ledgerStatus": "$status"
  },
  "score": {
    "trustScore": $score,
    "coherence": "$coherence"
  },
  "result": {
    "status": "$final_status"
  }
}
EOF

echo "=============================="
echo "[SPRINT 416 RESULT]"
echo "TRUST SCORE: $score"
echo "STATUS: $final_status"
echo "JSON VALID: $json_valid"
echo "RECEIPT VALID: $receipt_valid"
echo "OUTPUT: $OUT"
echo "=============================="

echo "[SPRINT 416] COMPLETE"
