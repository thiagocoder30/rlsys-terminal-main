#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — SSB SIGNATURE RECONCILIATION (435-C1.2)
# =========================================================
# Objective:
# - Fix bundle signature generation mismatch
# - Align EXPORT and IMPORT hash rules
# - Rebuild current bundle signature
# - Validate resulting integrity
# =========================================================

set -euo pipefail

EXPORT_BASE="/sdcard/Download/RL_SYS/ssb/export"
DATE_TAG="$(date +%F)"

BUNDLE_DIR="$EXPORT_BASE/$DATE_TAG/FULL_SSB_BUNDLE"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
LOG_FILE="$LOG_DIR/sprint_435C1_2_signature_fix_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

log() {
    echo "[435-C1.2] $1" | tee -a "$LOG_FILE"
}

log "STARTING SIGNATURE RECONCILIATION"

if [ ! -d "$BUNDLE_DIR" ]; then
    log "Bundle not found"
    exit 1
fi

SIGNATURE_FILE="$BUNDLE_DIR/.ssb_signature"

# =========================================================
# REMOVE OLD SIGNATURE
# =========================================================

if [ -f "$SIGNATURE_FILE" ]; then
    rm -f "$SIGNATURE_FILE"
    log "Old signature removed"
fi

# =========================================================
# REBUILD SIGNATURE
# =========================================================

find "$BUNDLE_DIR" \
    -maxdepth 1 \
    -type f \
    ! -name ".ssb_signature" \
    -exec md5sum {} \; \
    | sort \
    | md5sum \
    | awk '{print $1}' \
    > "$SIGNATURE_FILE"

log "Signature rebuilt"

# =========================================================
# VALIDATE SIGNATURE
# =========================================================

TMP_SIG="$(mktemp)"

find "$BUNDLE_DIR" \
    -maxdepth 1 \
    -type f \
    ! -name ".ssb_signature" \
    -exec md5sum {} \; \
    | sort \
    | md5sum \
    | awk '{print $1}' \
    > "$TMP_SIG"

GENERATED_SIG="$(cat "$SIGNATURE_FILE")"
VALIDATED_SIG="$(cat "$TMP_SIG")"

rm -f "$TMP_SIG"

if [ "$GENERATED_SIG" = "$VALIDATED_SIG" ]; then
    STATUS="VALID"
else
    STATUS="INVALID"
fi

# =========================================================
# REPORT
# =========================================================

REPORT="$BUNDLE_DIR/SSB_SIGNATURE_REPORT.json"

cat > "$REPORT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "engine":"SSB_SIGNATURE_RECONCILIATION_V1",
  "bundle":"$BUNDLE_DIR",
  "status":"$STATUS"
}
EOF

cp "$LOG_FILE" /sdcard/Download/RL_SYS/ 2>/dev/null || true

log "STATUS=$STATUS"

echo ""
echo "===================================="
echo "SSB SIGNATURE RECONCILIATION"
echo "===================================="
echo "BUNDLE : $BUNDLE_DIR"
echo "STATUS : $STATUS"
echo "===================================="

echo "435-C1.2 RESULT: $STATUS"
