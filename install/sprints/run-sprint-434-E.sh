#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — EXPORT PIPELINE READINESS VALIDATOR (434-E)
# =========================================================
# Objective:
# - Validate continuity export pipeline
# - Verify snapshot availability
# - Verify export integration readiness
# - Verify runtime consistency
# - Generate export readiness report
# - Gate future SSB_EXPORT upgrades
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT/install/sprints/flags"

PROJECT_STATE="$FLAGS_DIR/RL_SYS_PROJECT_STATE.json"
RUNTIME_STATE="$FLAGS_DIR/RL_SYS_RUNTIME_STATE.json"
CONTINUITY="$FLAGS_DIR/PROJECT_CONTINUITY_SNAPSHOT.json"
INTEGRATION="$FLAGS_DIR/EXPORT_CONTINUITY_INTEGRATION_REPORT.json"

REPORT="$FLAGS_DIR/EXPORT_PIPELINE_READINESS_REPORT.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_434E_export_pipeline_readiness_$(date +%Y%m%d_%H%M%S).log"

log() {
    echo "[434-E] $1" | tee -a "$LOG_FILE"
}

log "STARTING EXPORT PIPELINE READINESS VALIDATOR"

FAILURES=0

check_file() {

    local file="$1"

    if [ -f "$file" ]; then
        log "FOUND $(basename "$file")"
    else
        log "MISSING $(basename "$file")"
        FAILURES=$((FAILURES + 1))
    fi
}

check_file "$PROJECT_STATE"
check_file "$RUNTIME_STATE"
check_file "$CONTINUITY"
check_file "$INTEGRATION"

CURRENT_SPRINT="UNKNOWN"
CONSISTENCY="UNKNOWN"
STATUS="FAIL"

if [ -f "$RUNTIME_STATE" ]; then

    CURRENT_SPRINT=$(
        python3 - <<PY
import json
with open("$RUNTIME_STATE","r",encoding="utf-8") as f:
    data=json.load(f)
print(data.get("latestSprint","UNKNOWN"))
PY
    )

    CONSISTENCY=$(
        python3 - <<PY
import json
with open("$RUNTIME_STATE","r",encoding="utf-8") as f:
    data=json.load(f)
print(data.get("stateConsistency","UNKNOWN"))
PY
    )

fi

if [ "$FAILURES" -eq 0 ] && [ "$CONSISTENCY" = "CONSISTENT" ]; then
    STATUS="READY"
else
    STATUS="DEGRADED"
fi

cat > "$REPORT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "engine":"EXPORT_PIPELINE_READINESS_VALIDATOR_434_E",
  "currentSprint":"$CURRENT_SPRINT",
  "consistency":"$CONSISTENCY",
  "failures":$FAILURES,
  "status":"$STATUS"
}
EOF

log "Report generated"
log "STATUS=$STATUS"

cp "$LOG_FILE" /sdcard/Download/RL_SYS/ 2>/dev/null || true

echo ""
echo "===================================="
echo "EXPORT PIPELINE READINESS"
echo "===================================="
echo "SPRINT      : $CURRENT_SPRINT"
echo "CONSISTENCY : $CONSISTENCY"
echo "FAILURES    : $FAILURES"
echo "STATUS      : $STATUS"
echo "===================================="

echo "434-E RESULT: $STATUS"
