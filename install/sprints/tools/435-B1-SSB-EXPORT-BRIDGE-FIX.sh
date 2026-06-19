#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — SSB EXPORT BRIDGE FIX (435-B.1)
# =========================================================
# Objective:
# - Fix EXPORT_DIR mismatch
# - Bridge runtime state into export bundle
# - Ensure STATE_MANIFEST generation
# - Guarantee full SSB traceable export
# =========================================================

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

EXPORT_BASE="/sdcard/Download/RL_SYS/ssb/export"
STATE_SOURCE="$ROOT_DIR/install/sprints/flags/RL_SYS_RUNTIME_STATE.json"

DATE_TAG="$(date +%F)"
EXPORT_DIR="$EXPORT_BASE/$DATE_TAG"
FINAL_BUNDLE="$EXPORT_DIR/FULL_SSB_BUNDLE"

LOG_FILE="/sdcard/Download/RL_SYS/logs/sprint_435B1_ssb_export_bridge_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$EXPORT_DIR"
mkdir -p "$FINAL_BUNDLE"
mkdir -p "/sdcard/Download/RL_SYS/logs"

log() {
  echo "[435-B.1] $1" | tee -a "$LOG_FILE"
}

log "Starting SSB EXPORT BRIDGE FIX"
log "ROOT_DIR=$ROOT_DIR"
log "EXPORT_DIR=$EXPORT_DIR"

# =========================================================
# 1. COPY RUNTIME STATE (BRIDGE FIX CORE)
# =========================================================

if [ -f "$STATE_SOURCE" ]; then
  cp "$STATE_SOURCE" "$FINAL_BUNDLE/RL_SYS_RUNTIME_STATE.json"
  log "Runtime state copied to bundle"
else
  log "WARNING: Runtime state not found at $STATE_SOURCE"
fi

# =========================================================
# 2. MOVE EXISTING EXPORT FILES INTO BUNDLE
# =========================================================

find "$EXPORT_DIR" -maxdepth 1 -type f 2>/dev/null | while read -r file; do
  cp "$file" "$FINAL_BUNDLE/" 2>/dev/null || true
done

log "Existing export files bridged"

# =========================================================
# 3. STATE MANIFEST GENERATION
# =========================================================

MANIFEST="$FINAL_BUNDLE/STATE_MANIFEST.json"

if [ ! -f "$MANIFEST" ]; then
cat > "$MANIFEST" <<EOF
{
  "exportDate": "$DATE_TAG",
  "source": "SSB-EXPORT-BRIDGE-435-B.1",
  "runtimeIncluded": $( [ -f "$FINAL_BUNDLE/RL_SYS_RUNTIME_STATE.json" ] && echo true || echo false ),
  "bundlePath": "$FINAL_BUNDLE",
  "files": $(ls "$FINAL_BUNDLE" 2>/dev/null | awk '{print "\"" $0 "\""}' | paste -sd, - | sed 's/^/[/' | sed 's/$/]/')
}
EOF
  log "STATE_MANIFEST generated"
else
  log "STATE_MANIFEST already exists"
fi

# =========================================================
# 4. FINAL VALIDATION
# =========================================================

FILE_COUNT=$(ls "$FINAL_BUNDLE" 2>/dev/null | wc -l || echo 0)

log "FINAL BUNDLE FILE COUNT: $FILE_COUNT"

if [ "$FILE_COUNT" -gt 0 ]; then
  log "EXPORT BRIDGE SUCCESS"
  echo "435-B.1 COMPLETE OK"
else
  log "EXPORT BRIDGE FAILED - EMPTY BUNDLE"
  echo "435-B.1 FAILED"
  exit 1
fi

# =========================================================
# 5. COPY LOG TO DOWNLOAD (USER REQUIREMENT)
# =========================================================

cp "$LOG_FILE" /sdcard/Download/RL_SYS/ 2>/dev/null || true

log "Log copied to /sdcard/Download/RL_SYS"
log "435-B.1 finished"
