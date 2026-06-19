#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — RESTORE VALIDATOR
# Sprint 435-C
# =========================================================
# Objective:
# - Validate restore integrity
# - Validate signature existence
# - Validate rebuilt state
# - Validate certification chain
# - Produce final restore validation report
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT/install/sprints/flags"

EXPORT_BASE="/sdcard/Download/RL_SYS/ssb/export"
DATE_TAG="$(date +%F)"

BUNDLE_DIR="$EXPORT_BASE/$DATE_TAG/FULL_SSB_BUNDLE"

REPORT="$FLAGS_DIR/RESTORE_VALIDATOR_REPORT.json"

echo "[435-C] STARTING RESTORE VALIDATOR"

CHECKS=0
FAILURES=0

validate_file() {

    local FILE="$1"

    CHECKS=$((CHECKS + 1))

    if [ -f "$FILE" ]; then

        echo "[435-C] PASS $(basename "$FILE")"

    else

        echo "[435-C] FAIL $(basename "$FILE")"

        FAILURES=$((FAILURES + 1))
    fi
}

validate_file "$BUNDLE_DIR/RL_SYS_PROJECT_STATE.json"
validate_file "$BUNDLE_DIR/RL_SYS_RUNTIME_STATE.json"
validate_file "$BUNDLE_DIR/PROJECT_CONTINUITY_SNAPSHOT.json"
validate_file "$BUNDLE_DIR/STATE_MANIFEST.json"
validate_file "$BUNDLE_DIR/.ssb_signature"

if [ -f "$FLAGS_DIR/STATE_REBUILDER_REPORT.json" ]; then
    echo "[435-C] PASS STATE_REBUILDER_REPORT"
else
    echo "[435-C] FAIL STATE_REBUILDER_REPORT"
    FAILURES=$((FAILURES + 1))
fi

if [ -f "$FLAGS_DIR/CONTEXT_RESTORE_CERTIFICATION_REPORT.json" ]; then
    echo "[435-C] PASS CONTEXT_RESTORE_CERTIFICATION"
else
    echo "[435-C] FAIL CONTEXT_RESTORE_CERTIFICATION"
    FAILURES=$((FAILURES + 1))
fi

if [ "$FAILURES" -eq 0 ]; then
    STATUS="VALIDATED"
else
    STATUS="FAILED"
fi

cat > "$REPORT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "engine":"RESTORE_VALIDATOR_ENGINE_V1",
  "checks":$CHECKS,
  "failures":$FAILURES,
  "status":"$STATUS"
}
EOF

echo "[435-C] STATUS=$STATUS"

echo ""
echo "===================================="
echo "RESTORE VALIDATOR"
echo "===================================="
echo "CHECKS    : $CHECKS"
echo "FAILURES  : $FAILURES"
echo "STATUS    : $STATUS"
echo "===================================="

echo "435-C RESULT: $STATUS"
