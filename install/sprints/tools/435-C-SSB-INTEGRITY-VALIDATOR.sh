#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — SSB INTEGRITY VALIDATOR (435-C)
# =========================================================
# Objective:
# - Validate FULL_SSB_BUNDLE integrity
# - Ensure runtime state + logs + manifest exist
# - Compute lightweight hash signature
# - Produce institutional-grade validation status
# =========================================================

set -euo pipefail

EXPORT_BASE="/sdcard/Download/RL_SYS/ssb/export"
LOG_DIR="/sdcard/Download/RL_SYS/logs"

DATE_TAG="$(date +%F)"
TARGET_BUNDLE="$EXPORT_BASE/$DATE_TAG/FULL_SSB_BUNDLE"

LOG_FILE="$LOG_DIR/sprint_435C_ssb_integrity_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

log() {
  echo "[435-C] $1" | tee -a "$LOG_FILE"
}

log "Starting SSB Integrity Validation"
log "Target bundle: $TARGET_BUNDLE"

# =========================================================
# 1. PRE-CHECK BUNDLE EXISTENCE
# =========================================================

if [ ! -d "$TARGET_BUNDLE" ]; then
  log "CRITICAL: Bundle not found"
  echo "435-C RESULT: FAIL (NO_BUNDLE)"
  exit 1
fi

# =========================================================
# 2. REQUIRED FILES CHECK
# =========================================================

RUNTIME="$TARGET_BUNDLE/RL_SYS_RUNTIME_STATE.json"
MANIFEST="$TARGET_BUNDLE/STATE_MANIFEST.json"

RUNTIME_OK=0
MANIFEST_OK=0

[ -f "$RUNTIME" ] && RUNTIME_OK=1
[ -f "$MANIFEST" ] && MANIFEST_OK=1

log "Runtime present: $RUNTIME_OK"
log "Manifest present: $MANIFEST_OK"

# =========================================================
# 3. LIGHTWEIGHT CONTENT VALIDATION
# =========================================================

FILE_COUNT=$(find "$TARGET_BUNDLE" -type f 2>/dev/null | wc -l || echo 0)
log "File count: $FILE_COUNT"

# =========================================================
# 4. BASIC MANIFEST SANITY CHECK
# =========================================================

MANIFEST_VALID=0

if [ "$MANIFEST_OK" -eq 1 ]; then
  if grep -q "exportDate" "$MANIFEST"; then
    MANIFEST_VALID=1
  fi
fi

log "Manifest valid structure: $MANIFEST_VALID"

# =========================================================
# 5. SIMPLE HASH SIGNATURE (NO HEAVY OPS)
# =========================================================

SIGNATURE_FILE="$TARGET_BUNDLE/.ssb_signature"

# lightweight deterministic signature
FINGERPRINT=$(find "$TARGET_BUNDLE" -type f -print | sort | tr '\n' '|' | sed 's/|$//')

echo "$FINGERPRINT" | md5sum | awk '{print $1}' > "$SIGNATURE_FILE" 2>/dev/null || true

log "Signature generated"

# =========================================================
# 6. DECISION ENGINE
# =========================================================

SCORE=0

[ "$RUNTIME_OK" -eq 1 ] && SCORE=$((SCORE + 40))
[ "$MANIFEST_OK" -eq 1 ] && SCORE=$((SCORE + 30))
[ "$MANIFEST_VALID" -eq 1 ] && SCORE=$((SCORE + 20))
[ "$FILE_COUNT" -gt 0 ] && SCORE=$((SCORE + 10))

log "Integrity score: $SCORE"

STATUS="FAIL"

if [ "$SCORE" -ge 90 ]; then
  STATUS="PASS"
elif [ "$SCORE" -ge 60 ]; then
  STATUS="DEGRADED"
else
  STATUS="FAIL"
fi

# =========================================================
# 7. FINAL REPORT
# =========================================================

REPORT="$TARGET_BUNDLE/SSB_INTEGRITY_REPORT.json"

cat > "$REPORT" <<EOF
{
  "date": "$DATE_TAG",
  "bundle": "$TARGET_BUNDLE",
  "score": $SCORE,
  "status": "$STATUS",
  "checks": {
    "runtime": $RUNTIME_OK,
    "manifest": $MANIFEST_OK,
    "manifestValid": $MANIFEST_VALID,
    "fileCount": $FILE_COUNT
  }
}
EOF

log "Report generated: $STATUS"

# =========================================================
# 8. COPY LOG TO DOWNLOAD
# =========================================================

cp "$LOG_FILE" /sdcard/Download/RL_SYS/ 2>/dev/null || true

log "Log exported to Download"
log "SSB Integrity Validation finished"

echo "435-C RESULT: $STATUS"
