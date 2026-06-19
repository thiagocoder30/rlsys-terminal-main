#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — STATE REBUILDER ENGINE
# Sprint 435-B
# =========================================================
# Objective:
# - Rebuild runtime state from restore bundle
# - Verify continuity metadata
# - Validate sprint alignment
# - Produce restore reconstruction report
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT/install/sprints/flags"

EXPORT_BASE="/sdcard/Download/RL_SYS/ssb/export"
DATE_TAG="$(date +%F)"

BUNDLE_DIR="$EXPORT_BASE/$DATE_TAG/FULL_SSB_BUNDLE"

REPORT="$FLAGS_DIR/STATE_REBUILDER_REPORT.json"

echo "[435-B] STARTING STATE REBUILDER"

if [ ! -d "$BUNDLE_DIR" ]; then

    echo "[435-B] BUNDLE NOT FOUND"
    exit 1

fi

PROJECT_FILE="$BUNDLE_DIR/RL_SYS_PROJECT_STATE.json"
RUNTIME_FILE="$BUNDLE_DIR/RL_SYS_RUNTIME_STATE.json"
CONTINUITY_FILE="$BUNDLE_DIR/PROJECT_CONTINUITY_SNAPSHOT.json"

CURRENT_SPRINT="UNKNOWN"
RUNTIME_SPRINT="UNKNOWN"
CONTINUITY_SPRINT="UNKNOWN"

if [ -f "$PROJECT_FILE" ]; then

    CURRENT_SPRINT=$(
        grep -o '"currentSprint"[[:space:]]*:[[:space:]]*"[^"]*"' "$PROJECT_FILE" \
        | head -1 \
        | cut -d'"' -f4
    )

fi

if [ -f "$RUNTIME_FILE" ]; then

    RUNTIME_SPRINT=$(
        grep -o '"latestSprint"[[:space:]]*:[[:space:]]*"[^"]*"' "$RUNTIME_FILE" \
        | head -1 \
        | cut -d'"' -f4
    )

fi

if [ -f "$CONTINUITY_FILE" ]; then

    CONTINUITY_SPRINT=$(
        grep -o '"currentSprint"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONTINUITY_FILE" \
        | head -1 \
        | cut -d'"' -f4
    )

fi

if [ "$CURRENT_SPRINT" = "$RUNTIME_SPRINT" ] &&
   [ "$CURRENT_SPRINT" = "$CONTINUITY_SPRINT" ]; then

    STATUS="REBUILT"

else

    STATUS="DIVERGENT"

fi

cat > "$REPORT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "engine":"STATE_REBUILDER_ENGINE_V1",
  "projectSprint":"$CURRENT_SPRINT",
  "runtimeSprint":"$RUNTIME_SPRINT",
  "continuitySprint":"$CONTINUITY_SPRINT",
  "status":"$STATUS"
}
EOF

echo "[435-B] PROJECT=$CURRENT_SPRINT"
echo "[435-B] RUNTIME=$RUNTIME_SPRINT"
echo "[435-B] CONTINUITY=$CONTINUITY_SPRINT"
echo "[435-B] STATUS=$STATUS"

echo ""
echo "===================================="
echo "STATE REBUILDER"
echo "===================================="
echo "PROJECT    : $CURRENT_SPRINT"
echo "RUNTIME    : $RUNTIME_SPRINT"
echo "CONTINUITY : $CONTINUITY_SPRINT"
echo "STATUS     : $STATUS"
echo "===================================="

echo "435-B RESULT: $STATUS"
