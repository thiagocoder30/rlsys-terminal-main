#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — STATE RECONCILIATION ENGINE (435-C1)
# =========================================================
# Objective:
# - Resolve PROJECT_STATE vs RUNTIME_STATE divergence
# - Promote institutional state to latest runtime sprint
# - Preserve existing data
# - Rebuild roadmap consistency
# - Mark system CONSISTENT again
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT/install/sprints/flags"

PROJECT_STATE="$FLAGS_DIR/RL_SYS_PROJECT_STATE.json"
RUNTIME_STATE="$FLAGS_DIR/RL_SYS_RUNTIME_STATE.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
LOG_FILE="$LOG_DIR/sprint_435C1_reconciliation_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

log() {
    echo "[435-C1] $1" | tee -a "$LOG_FILE"
}

log "STARTING STATE RECONCILIATION"

# =========================================================
# VALIDATION
# =========================================================

if [ ! -f "$PROJECT_STATE" ]; then
    log "PROJECT_STATE not found"
    exit 1
fi

if [ ! -f "$RUNTIME_STATE" ]; then
    log "RUNTIME_STATE not found"
    exit 1
fi

# =========================================================
# EXTRACT VALUES
# =========================================================

CURRENT_SPRINT=$(
grep -o '"currentSprint"[[:space:]]*:[[:space:]]*"[^"]*"' \
"$PROJECT_STATE" | head -1 | cut -d'"' -f4
)

LATEST_SPRINT=$(
grep -o '"latestSprint"[[:space:]]*:[[:space:]]*"[^"]*"' \
"$RUNTIME_STATE" | head -1 | cut -d'"' -f4
)

STATE_CONSISTENCY=$(
grep -o '"stateConsistency"[[:space:]]*:[[:space:]]*"[^"]*"' \
"$RUNTIME_STATE" | head -1 | cut -d'"' -f4
)

log "PROJECT_STATE sprint = $CURRENT_SPRINT"
log "RUNTIME_STATE sprint = $LATEST_SPRINT"
log "CONSISTENCY = $STATE_CONSISTENCY"

# =========================================================
# NO ACTION NEEDED
# =========================================================

if [ "$CURRENT_SPRINT" = "$LATEST_SPRINT" ]; then

    log "Already synchronized"

    echo "435-C1 RESULT: ALREADY_SYNCED"
    exit 0

fi

# =========================================================
# BACKUP
# =========================================================

BACKUP_FILE="$PROJECT_STATE.bak.$(date +%Y%m%d_%H%M%S)"

cp "$PROJECT_STATE" "$BACKUP_FILE"

log "Backup created"
log "$BACKUP_FILE"

# =========================================================
# UPDATE PROJECT STATE
# =========================================================

TMP_FILE="$(mktemp)"

sed \
"s/\"currentSprint\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"currentSprint\":\"$LATEST_SPRINT\"/" \
"$PROJECT_STATE" > "$TMP_FILE"

mv "$TMP_FILE" "$PROJECT_STATE"

log "currentSprint updated"

# =========================================================
# UPDATE RUNTIME CONSISTENCY
# =========================================================

TMP_FILE="$(mktemp)"

sed \
's/"stateConsistency"[[:space:]]*:[[:space:]]*"[^"]*"/"stateConsistency":"CONSISTENT"/' \
"$RUNTIME_STATE" > "$TMP_FILE"

mv "$TMP_FILE" "$RUNTIME_STATE"

log "stateConsistency updated"

# =========================================================
# RECONCILIATION REPORT
# =========================================================

REPORT="$FLAGS_DIR/STATE_RECONCILIATION_REPORT.json"

cat > "$REPORT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "engine":"STATE_RECONCILIATION_ENGINE_V1",
  "previousSprint":"$CURRENT_SPRINT",
  "newSprint":"$LATEST_SPRINT",
  "previousConsistency":"$STATE_CONSISTENCY",
  "newConsistency":"CONSISTENT",
  "status":"SUCCESS"
}
EOF

log "Report generated"

# =========================================================
# FINAL VALIDATION
# =========================================================

NEW_SPRINT=$(
grep -o '"currentSprint"[[:space:]]*:[[:space:]]*"[^"]*"' \
"$PROJECT_STATE" | head -1 | cut -d'"' -f4
)

if [ "$NEW_SPRINT" = "$LATEST_SPRINT" ]; then

    RESULT="SUCCESS"

else

    RESULT="FAIL"

fi

cp "$LOG_FILE" /sdcard/Download/RL_SYS/ 2>/dev/null || true

log "FINAL RESULT = $RESULT"

echo ""
echo "===================================="
echo "STATE RECONCILIATION COMPLETE"
echo "OLD SPRINT : $CURRENT_SPRINT"
echo "NEW SPRINT : $LATEST_SPRINT"
echo "RESULT     : $RESULT"
echo "===================================="

echo "435-C1 RESULT: $RESULT"
