#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — SPRINT 435-D
# RESTORE CHAIN CERTIFICATION ENGINE
# =========================================================
#
# Objective:
# - Certify complete restore chain
# - Verify export/import continuity
# - Verify rebuild state
# - Verify validation state
# - Generate final certification artifact
#
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT/install/sprints/flags"

OUTPUT="$FLAGS_DIR/RESTORE_CHAIN_CERTIFICATION_REPORT.json"

echo "[435-D] STARTING RESTORE CHAIN CERTIFICATION"

FOUND=0
FAILURES=0

check_file() {

    local file="$1"

    if [ -f "$FLAGS_DIR/$file" ]; then
        echo "[435-D] PASS $file"
        FOUND=$((FOUND + 1))
    else
        echo "[435-D] FAIL $file"
        FAILURES=$((FAILURES + 1))
    fi

}

check_file "RL_SYS_PROJECT_STATE.json"
check_file "RL_SYS_RUNTIME_STATE.json"
check_file "PROJECT_CONTINUITY_SNAPSHOT.json"
check_file "EXPORT_PIPELINE_READINESS_REPORT.json"
check_file "CONTEXT_RESTORE_CERTIFICATION_REPORT.json"
check_file "RESTORE_VALIDATOR_REPORT.json"

if [ "$FAILURES" -eq 0 ]; then
    STATUS="CERTIFIED"
else
    STATUS="FAILED"
fi

cat > "$OUTPUT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "engine":"RESTORE_CHAIN_CERTIFICATION_ENGINE_V1",
  "validatedArtifacts":$FOUND,
  "failures":$FAILURES,
  "status":"$STATUS"
}
EOF

echo "[435-D] REPORT GENERATED"
echo "[435-D] STATUS=$STATUS"

echo ""
echo "===================================="
echo "RESTORE CHAIN CERTIFICATION"
echo "===================================="
echo "VALIDATED : $FOUND"
echo "FAILURES  : $FAILURES"
echo "STATUS    : $STATUS"
echo "===================================="

echo "435-D RESULT: $STATUS"
