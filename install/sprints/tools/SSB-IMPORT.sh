#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — SSB IMPORT V2
# =========================================================
# Objective:
# - Restore RL.SYS context from export bundle
# - Read continuity snapshot
# - Read manifest
# - Validate bundle signature
# - Detect active sprint
# - Detect active phase
# - Detect state divergence
# - Generate restore report
# =========================================================

set -euo pipefail

if [ $# -lt 1 ]; then
    echo ""
    echo "Usage:"
    echo "bash install/sprints/tools/SSB-IMPORT.sh <EXPORT_FILE>"
    echo ""
    exit 1
fi

IMPORT_FILE="$1"

if [ ! -f "$IMPORT_FILE" ]; then
    echo "ERROR: Export file not found"
    exit 1
fi

EXPORT_DIR="$(dirname "$IMPORT_FILE")"
BUNDLE_DIR="$EXPORT_DIR/FULL_SSB_BUNDLE"

echo "[SSB-IMPORT] LOADING $IMPORT_FILE"

# =========================================================
# BUNDLE CHECK
# =========================================================

if [ ! -d "$BUNDLE_DIR" ]; then
    echo ""
    echo "===================================="
    echo "RESTORE STATUS : FAIL"
    echo "REASON         : BUNDLE NOT FOUND"
    echo "===================================="
    exit 1
fi

# =========================================================
# FILE PATHS
# =========================================================

PROJECT_STATE="$BUNDLE_DIR/RL_SYS_PROJECT_STATE.json"
RUNTIME_STATE="$BUNDLE_DIR/RL_SYS_RUNTIME_STATE.json"
CONTINUITY="$BUNDLE_DIR/RL_SYS_CHAT_CONTINUITY.json"
MANIFEST="$BUNDLE_DIR/STATE_MANIFEST.json"
SIGNATURE="$BUNDLE_DIR/.ssb_signature"

# =========================================================
# DEFAULT VALUES
# =========================================================

SPRINT="UNKNOWN"
PHASE="UNKNOWN"
CONSISTENCY="UNKNOWN"
HEALTH="UNKNOWN"
SIGNATURE_STATUS="UNKNOWN"

# =========================================================
# PROJECT STATE
# =========================================================

if [ -f "$PROJECT_STATE" ]; then

    SPRINT=$(
    grep -o '"currentSprint"[[:space:]]*:[[:space:]]*"[^"]*"' \
    "$PROJECT_STATE" | head -1 | cut -d'"' -f4 || true
    )

    PHASE=$(
    grep -o '"phase"[[:space:]]*:[[:space:]]*"[^"]*"' \
    "$PROJECT_STATE" | head -1 | cut -d'"' -f4 || true
    )

fi

# =========================================================
# RUNTIME STATE
# =========================================================

if [ -f "$RUNTIME_STATE" ]; then

    CONSISTENCY=$(
    grep -o '"stateConsistency"[[:space:]]*:[[:space:]]*"[^"]*"' \
    "$RUNTIME_STATE" | head -1 | cut -d'"' -f4 || true
    )

    HEALTH=$(
    grep -o '"systemHealth"[[:space:]]*:[[:space:]]*"[^"]*"' \
    "$RUNTIME_STATE" | head -1 | cut -d'"' -f4 || true
    )

fi

# =========================================================
# SIGNATURE VALIDATION
# =========================================================

if [ -f "$SIGNATURE" ]; then

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

    CURRENT_SIG="$(cat "$TMP_SIG")"
    STORED_SIG="$(cat "$SIGNATURE")"

    rm -f "$TMP_SIG"

    if [ "$CURRENT_SIG" = "$STORED_SIG" ]; then
        SIGNATURE_STATUS="VALID"
    else
        SIGNATURE_STATUS="MODIFIED"
    fi

else

    SIGNATURE_STATUS="MISSING"

fi

# =========================================================
# MANIFEST INFO
# =========================================================

ARTIFACT_COUNT="UNKNOWN"

if [ -f "$MANIFEST" ]; then

    ARTIFACT_COUNT=$(
    grep -o '"artifactCount"[[:space:]]*:[[:space:]]*[0-9]*' \
    "$MANIFEST" | grep -o '[0-9]*' || true
    )

fi

# =========================================================
# RESTORE REPORT
# =========================================================

echo ""
echo "===================================="
echo "RL.SYS RESTORE REPORT"
echo "===================================="
echo ""
echo "SPRINT .......... $SPRINT"
echo "PHASE ........... $PHASE"
echo "HEALTH .......... $HEALTH"
echo "CONSISTENCY ..... $CONSISTENCY"
echo "SIGNATURE ....... $SIGNATURE_STATUS"
echo "ARTIFACTS ....... $ARTIFACT_COUNT"
echo ""
echo "BUNDLE .......... $BUNDLE_DIR"
echo ""
echo "RESTORE STATUS .. SUCCESS"
echo ""

# =========================================================
# CONTINUITY SNAPSHOT
# =========================================================

if [ -f "$CONTINUITY" ]; then

    echo "===================================="
    echo "CONTINUITY SNAPSHOT"
    echo "===================================="

    cat "$CONTINUITY"

    echo ""
fi

# =========================================================
# PROJECT STATE
# =========================================================

if [ -f "$PROJECT_STATE" ]; then

    echo "===================================="
    echo "PROJECT STATE"
    echo "===================================="

    cat "$PROJECT_STATE"

    echo ""
fi

# =========================================================
# RUNTIME STATE
# =========================================================

if [ -f "$RUNTIME_STATE" ]; then

    echo "===================================="
    echo "RUNTIME STATE"
    echo "===================================="

    cat "$RUNTIME_STATE"

    echo ""
fi

echo "===================================="
echo "SYSTEM RESTORED (SSB ACTIVE CONTEXT)"
echo "===================================="
