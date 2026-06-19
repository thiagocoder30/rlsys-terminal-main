#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — SSB AUTO RECOVERY ENGINE (436-A)
# =========================================================
# Objective:
# - Auto-repair DEGRADED or FAIL SSB bundles
# - Rebuild missing runtime state injection
# - Recreate STATE_MANIFEST if needed
# - Re-run integrity validation after recovery
# - Non-destructive, deterministic repair flow
# =========================================================

set -euo pipefail

EXPORT_BASE="/sdcard/Download/RL_SYS/ssb/export"
LOG_DIR="/sdcard/Download/RL_SYS/logs"

DATE_TAG="$(date +%F)"
TARGET_BUNDLE="$EXPORT_BASE/$DATE_TAG/FULL_SSB_BUNDLE"

LOG_FILE="$LOG_DIR/sprint_436A_ssb_auto_recovery_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

log() {
  echo "[436-A] $1" | tee -a "$LOG_FILE"
}

log "Starting SSB Auto Recovery Engine"
log "Target bundle: $TARGET_BUNDLE"

# =========================================================
# 1. SAFETY CHECK
# =========================================================

if [ ! -d "$TARGET_BUNDLE" ]; then
  log "Bundle not found - cannot recover"
  echo "436-A RESULT: FAIL (NO_BUNDLE)"
  exit 1
fi

# =========================================================
# 2. LOAD STATE
# =========================================================

RUNTIME_SOURCE="/sdcard/Download/RL_SYS/RL_SYS_RUNTIME_STATE.json"
RUNTIME_TARGET="$TARGET_BUNDLE/RL_SYS_RUNTIME_STATE.json"
MANIFEST="$TARGET_BUNDLE/STATE_MANIFEST.json"

RECOVERY_ACTIONS=0

log "Checking runtime state source: $RUNTIME_SOURCE"

# =========================================================
# 3. RECOVER RUNTIME STATE
# =========================================================

if [ ! -f "$RUNTIME_TARGET" ]; then
  if [ -f "$RUNTIME_SOURCE" ]; then
    cp "$RUNTIME_SOURCE" "$RUNTIME_TARGET"
    log "Recovered runtime state into bundle"
    RECOVERY_ACTIONS=$((RECOVERY_ACTIONS + 1))
  else
    log "WARNING: Runtime state missing globally"
  fi
fi

# =========================================================
# 4. RECOVER MANIFEST
# =========================================================

if [ ! -f "$MANIFEST" ]; then
  log "Rebuilding STATE_MANIFEST"

  FILE_LIST=$(find "$TARGET_BUNDLE" -type f -maxdepth 1 2>/dev/null | awk -F/ '{print $NF}' | paste -sd "," -)

  cat > "$MANIFEST" <<EOF
{
  "recovered": true,
  "date": "$DATE_TAG",
  "bundle": "$TARGET_BUNDLE",
  "source": "SSB-AUTO-RECOVERY-436-A",
  "files": "$FILE_LIST"
}
EOF

  RECOVERY_ACTIONS=$((RECOVERY_ACTIONS + 1))
fi

# =========================================================
# 5. REPAIR VALIDATION ARTIFACTS
# =========================================================

if [ ! -f "$TARGET_BUNDLE/.ssb_signature" ]; then
  log "Rebuilding signature placeholder"
  find "$TARGET_BUNDLE" -type f | sort | tr '\n' '|' | md5sum | awk '{print $1}' > "$TARGET_BUNDLE/.ssb_signature" 2>/dev/null || true
  RECOVERY_ACTIONS=$((RECOVERY_ACTIONS + 1))
fi

# =========================================================
# 6. POST-RECOVERY RECHECK
# =========================================================

FILE_COUNT=$(find "$TARGET_BUNDLE" -type f 2>/dev/null | wc -l || echo 0)

if [ -f "$TARGET_BUNDLE/RL_SYS_RUNTIME_STATE.json" ] && [ -f "$TARGET_BUNDLE/STATE_MANIFEST.json" ]; then
  STATUS="RECOVERED"
elif [ "$FILE_COUNT" -gt 0 ]; then
  STATUS="PARTIAL_RECOVERY"
else
  STATUS="FAILED_RECOVERY"
fi

# =========================================================
# 7. RECOVERY REPORT
# =========================================================

REPORT="$TARGET_BUNDLE/SSB_RECOVERY_REPORT.json"

cat > "$REPORT" <<EOF
{
  "date": "$DATE_TAG",
  "bundle": "$TARGET_BUNDLE",
  "status": "$STATUS",
  "recoveryActions": $RECOVERY_ACTIONS,
  "fileCount": $FILE_COUNT
}
EOF

log "Recovery status: $STATUS"
log "Actions executed: $RECOVERY_ACTIONS"

# =========================================================
# 8. EXPORT LOG
# =========================================================

cp "$LOG_FILE" /sdcard/Download/RL_SYS/ 2>/dev/null || true

log "Recovery log exported"
log "SSB Auto Recovery finished"

echo "436-A RESULT: $STATUS"
