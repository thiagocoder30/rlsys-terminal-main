#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — SPRINT 435-E
# SELF-BOOTSTRAP RESTORE ENGINE
# =========================================================
#
# Objective:
# - Auto-bootstrap restored context
# - Read restored project state
# - Read runtime state
# - Read continuity snapshot
# - Read certification artifacts
# - Produce a single bootstrap report
# - Mark system READY_FOR_OPERATION
#
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT/install/sprints/flags"

PROJECT_STATE="$FLAGS_DIR/RL_SYS_PROJECT_STATE.json"
RUNTIME_STATE="$FLAGS_DIR/RL_SYS_RUNTIME_STATE.json"
CONTINUITY="$FLAGS_DIR/PROJECT_CONTINUITY_SNAPSHOT.json"
RESTORE_CERT="$FLAGS_DIR/CONTEXT_RESTORE_CERTIFICATION_REPORT.json"
CHAIN_CERT="$FLAGS_DIR/RESTORE_CHAIN_CERTIFICATION_REPORT.json"

OUTPUT="$FLAGS_DIR/SELF_BOOTSTRAP_RESTORE_REPORT.json"

echo "[435-E] STARTING SELF-BOOTSTRAP RESTORE ENGINE"

FAILURES=0

require_file() {

    local file="$1"

    if [ -f "$file" ]; then
        echo "[435-E] FOUND $(basename "$file")"
    else
        echo "[435-E] MISSING $(basename "$file")"
        FAILURES=$((FAILURES + 1))
    fi

}

require_file "$PROJECT_STATE"
require_file "$RUNTIME_STATE"
require_file "$CONTINUITY"
require_file "$RESTORE_CERT"
require_file "$CHAIN_CERT"

CURRENT_SPRINT=$(
grep -o '"currentSprint"[[:space:]]*:[[:space:]]*"[^"]*"' \
"$PROJECT_STATE" \
2>/dev/null \
| head -1 \
| cut -d'"' -f4
)

CURRENT_PHASE=$(
grep -o '"phase"[[:space:]]*:[[:space:]]*"[^"]*"' \
"$PROJECT_STATE" \
2>/dev/null \
| head -1 \
| cut -d'"' -f4
)

SYSTEM_HEALTH=$(
grep -o '"repositoryHealth"[[:space:]]*:[[:space:]]*"[^"]*"' \
"$PROJECT_STATE" \
2>/dev/null \
| head -1 \
| cut -d'"' -f4
)

STATE_CONSISTENCY=$(
grep -o '"stateConsistency"[[:space:]]*:[[:space:]]*"[^"]*"' \
"$RUNTIME_STATE" \
2>/dev/null \
| head -1 \
| cut -d'"' -f4
)

[ -z "${CURRENT_SPRINT:-}" ] && CURRENT_SPRINT="UNKNOWN"
[ -z "${CURRENT_PHASE:-}" ] && CURRENT_PHASE="UNKNOWN"
[ -z "${SYSTEM_HEALTH:-}" ] && SYSTEM_HEALTH="UNKNOWN"
[ -z "${STATE_CONSISTENCY:-}" ] && STATE_CONSISTENCY="UNKNOWN"

if [ "$FAILURES" -eq 0 ]; then
    STATUS="READY_FOR_OPERATION"
else
    STATUS="DEGRADED"
fi

cat > "$OUTPUT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "engine":"SELF_BOOTSTRAP_RESTORE_ENGINE_V1",
  "currentSprint":"$CURRENT_SPRINT",
  "phase":"$CURRENT_PHASE",
  "health":"$SYSTEM_HEALTH",
  "stateConsistency":"$STATE_CONSISTENCY",
  "failures":$FAILURES,
  "status":"$STATUS"
}
EOF

echo "[435-E] REPORT GENERATED"
echo "[435-E] STATUS=$STATUS"

echo ""
echo "===================================="
echo "SELF BOOTSTRAP RESTORE"
echo "===================================="
echo "SPRINT      : $CURRENT_SPRINT"
echo "PHASE       : $CURRENT_PHASE"
echo "HEALTH      : $SYSTEM_HEALTH"
echo "CONSISTENCY : $STATE_CONSISTENCY"
echo "FAILURES    : $FAILURES"
echo "STATUS      : $STATUS"
echo "===================================="

echo "435-E RESULT: $STATUS"
