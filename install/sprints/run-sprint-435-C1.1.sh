#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — RUNTIME METADATA RECONCILIATION (435-C1.1)
# =========================================================
# Objective:
# - Synchronize runtime metadata
# - Fix projectStateSprint
# - Fix runtimeStateSprint
# - Recalculate consistency
# - Preserve runtime data
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT/install/sprints/flags"

PROJECT_STATE="$FLAGS_DIR/RL_SYS_PROJECT_STATE.json"
RUNTIME_STATE="$FLAGS_DIR/RL_SYS_RUNTIME_STATE.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
LOG_FILE="$LOG_DIR/sprint_435C1_1_runtime_reconciliation_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

log() {
    echo "[435-C1.1] $1" | tee -a "$LOG_FILE"
}

log "STARTING RUNTIME METADATA RECONCILIATION"

if [ ! -f "$PROJECT_STATE" ]; then
    log "PROJECT_STATE missing"
    exit 1
fi

if [ ! -f "$RUNTIME_STATE" ]; then
    log "RUNTIME_STATE missing"
    exit 1
fi

CURRENT_SPRINT=$(
grep -o '"currentSprint"[[:space:]]*:[[:space:]]*"[^"]*"' \
"$PROJECT_STATE" | head -1 | cut -d'"' -f4
)

LATEST_SPRINT=$(
grep -o '"latestSprint"[[:space:]]*:[[:space:]]*"[^"]*"' \
"$RUNTIME_STATE" | head -1 | cut -d'"' -f4
)

log "PROJECT sprint = $CURRENT_SPRINT"
log "RUNTIME sprint = $LATEST_SPRINT"

BACKUP="$RUNTIME_STATE.bak.$(date +%Y%m%d_%H%M%S)"
cp "$RUNTIME_STATE" "$BACKUP"

log "Backup created: $BACKUP"

TMP_FILE="$(mktemp)"

sed \
-e "s/\"projectStateSprint\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"projectStateSprint\":\"$CURRENT_SPRINT\"/" \
-e "s/\"runtimeStateSprint\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"runtimeStateSprint\":\"$LATEST_SPRINT\"/" \
"$RUNTIME_STATE" > "$TMP_FILE"

mv "$TMP_FILE" "$RUNTIME_STATE"

if [ "$CURRENT_SPRINT" = "$LATEST_SPRINT" ]; then

    TMP_FILE="$(mktemp)"

    sed \
    's/"stateConsistency"[[:space:]]*:[[:space:]]*"[^"]*"/"stateConsistency":"CONSISTENT"/' \
    "$RUNTIME_STATE" > "$TMP_FILE"

    mv "$TMP_FILE" "$RUNTIME_STATE"

    CONSISTENCY="CONSISTENT"

else

    TMP_FILE="$(mktemp)"

    sed \
    's/"stateConsistency"[[:space:]]*:[[:space:]]*"[^"]*"/"stateConsistency":"DIVERGENT"/' \
    "$RUNTIME_STATE" > "$TMP_FILE"

    mv "$TMP_FILE" "$RUNTIME_STATE"

    CONSISTENCY="DIVERGENT"

fi

REPORT="$FLAGS_DIR/RUNTIME_METADATA_RECONCILIATION_REPORT.json"

cat > "$REPORT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "engine":"RUNTIME_METADATA_RECONCILIATION_V1",
  "projectSprint":"$CURRENT_SPRINT",
  "runtimeSprint":"$LATEST_SPRINT",
  "consistency":"$CONSISTENCY",
  "status":"SUCCESS"
}
EOF

cp "$LOG_FILE" /sdcard/Download/RL_SYS/ 2>/dev/null || true

log "Consistency = $CONSISTENCY"
log "SUCCESS"

echo ""
echo "===================================="
echo "RUNTIME METADATA RECONCILIATION"
echo "===================================="
echo "PROJECT SPRINT : $CURRENT_SPRINT"
echo "RUNTIME SPRINT : $LATEST_SPRINT"
echo "CONSISTENCY    : $CONSISTENCY"
echo "===================================="

echo "435-C1.1 RESULT: SUCCESS"
