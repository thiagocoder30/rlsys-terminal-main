#!/data/data/com.termux/files/usr/bin/bash

echo "[SPRINT 415] RUNTIME EXECUTION RECEIPT & AUDIT LOGGER ENGINE START"

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FLAGS_DIR="$ROOT_DIR/install/sprints/flags"
LOGS_DIR="$ROOT_DIR/install/sprints/logs"

mkdir -p "$FLAGS_DIR"
mkdir -p "$LOGS_DIR"

START_TIME=$(date +%s%N)

# -----------------------------
# TARGET OUTPUTS (latest system state)
# -----------------------------

LATEST_OUTPUT=$(ls -t "$FLAGS_DIR"/*.json 2>/dev/null | head -n 1)

if [ -z "$LATEST_OUTPUT" ]; then
  echo "[415] NO OUTPUT FOUND"
  exit 1
fi

echo "[415] ANALYZING OUTPUT: $LATEST_OUTPUT"

# -----------------------------
# CHECKSUM GENERATION
# -----------------------------

if command -v sha256sum >/dev/null 2>&1; then
  CHECKSUM=$(sha256sum "$LATEST_OUTPUT" | awk '{print $1}')
else
  CHECKSUM="NO_SHA_SUPPORT"
fi

# -----------------------------
# JSON VALIDATION
# -----------------------------

if command -v jq >/dev/null 2>&1; then
  jq . "$LATEST_OUTPUT" >/dev/null 2>&1
  JSON_VALID=$?
else
  JSON_VALID=1
fi

# -----------------------------
# FILE SIZE
# -----------------------------

FILE_SIZE=$(wc -c < "$LATEST_OUTPUT" 2>/dev/null || echo 0)

# -----------------------------
# DURATION
# -----------------------------

END_TIME=$(date +%s%N)
DURATION=$(( (END_TIME - START_TIME) / 1000000 ))

# -----------------------------
# EXECUTION RECEIPT
# -----------------------------

SPRINT_ID=$(basename "$LATEST_OUTPUT" | cut -d'_' -f1 | cut -d'.' -f1)

STATUS="UNKNOWN"
[ "$JSON_VALID" -eq 0 ] && STATUS="VALID" || STATUS="INVALID"

RECEIPT_FILE="$LOGS_DIR/receipt_${SPRINT_ID}_$(date +%Y%m%d%H%M%S).json"

cat > "$RECEIPT_FILE" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "sprint": "$SPRINT_ID",
  "outputFile": "$LATEST_OUTPUT",
  "checksum": "$CHECKSUM",
  "fileSizeBytes": $FILE_SIZE,
  "jsonValid": $JSON_VALID,
  "executionTimeMs": $DURATION,
  "status": "$STATUS"
}
EOF

# -----------------------------
# GLOBAL AUDIT INDEX
# -----------------------------

AUDIT_INDEX="$LOGS_DIR/AUDIT_INDEX.json"

echo "[415] UPDATING AUDIT INDEX..."

if [ ! -f "$AUDIT_INDEX" ]; then
  echo "[]" > "$AUDIT_INDEX"
fi

TMP=$(mktemp)

jq ". + [$(cat "$RECEIPT_FILE")]" "$AUDIT_INDEX" > "$TMP" 2>/dev/null && mv "$TMP" "$AUDIT_INDEX" || cp "$RECEIPT_FILE" "$AUDIT_INDEX"

# -----------------------------
# OUTPUT
# -----------------------------

echo "=============================="
echo "[SPRINT 415 RESULT]"
echo "SPRINT: $SPRINT_ID"
echo "CHECKSUM: $CHECKSUM"
echo "JSON VALID: $JSON_VALID"
echo "SIZE: $FILE_SIZE bytes"
echo "DURATION: ${DURATION}ms"
echo "RECEIPT: $RECEIPT_FILE"
echo "=============================="

echo "[SPRINT 415] COMPLETE"
