#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — SPRINT 434-A
# QUALIFICATION STATE RESOLVER
# =========================================================
# Objective:
# - Resolve qualification status from entryScore
# - Eliminate UNKNOWN qualification states
# - Update RL_SYS_RUNTIME_STATE.json
# - Generate qualification report
# - Preserve existing runtime metadata
# - Non-destructive operation
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

RUNTIME_FILE="$ROOT/install/sprints/flags/RL_SYS_RUNTIME_STATE.json"
REPORT_FILE="$ROOT/install/sprints/flags/RUNTIME_QUALIFICATION_REPORT.json"

DATE_TAG="$(date +%Y%m%d_%H%M%S)"
ISO_TIME="$(date -Iseconds)"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
LOG_FILE="$LOG_DIR/sprint_434A_qualification_resolver_${DATE_TAG}.log"

mkdir -p "$LOG_DIR"

log() {
    echo "[434-A] $1" | tee -a "$LOG_FILE"
}

log "STARTING QUALIFICATION STATE RESOLVER"

# =========================================================
# VALIDATION
# =========================================================

if [ ! -f "$RUNTIME_FILE" ]; then

    log "Runtime state not found"
    echo "434-A RESULT: FAIL (NO_RUNTIME_STATE)"
    exit 1

fi

# =========================================================
# BACKUP
# =========================================================

BACKUP_FILE="${RUNTIME_FILE}.bak.${DATE_TAG}"

cp "$RUNTIME_FILE" "$BACKUP_FILE"

log "Backup created"
log "$BACKUP_FILE"

# =========================================================
# EXTRACT ENTRY SCORE
# =========================================================

ENTRY_SCORE=$(
grep -o '"entryScore"[[:space:]]*:[[:space:]]*[0-9]*' "$RUNTIME_FILE" \
| head -1 \
| grep -o '[0-9]*' \
|| echo "0"
)

ENTRY_SCORE=${ENTRY_SCORE:-0}

log "ENTRY_SCORE=$ENTRY_SCORE"

# =========================================================
# RESOLVE STATUS
# =========================================================

QUALIFICATION_STATUS="UNKNOWN"

if [ "$ENTRY_SCORE" -ge 80 ]; then

    QUALIFICATION_STATUS="QUALIFIED"

elif [ "$ENTRY_SCORE" -ge 60 ]; then

    QUALIFICATION_STATUS="CANDIDATE"

elif [ "$ENTRY_SCORE" -ge 40 ]; then

    QUALIFICATION_STATUS="WATCHLIST"

else

    QUALIFICATION_STATUS="REJECTED"

fi

log "QUALIFICATION_STATUS=$QUALIFICATION_STATUS"

# =========================================================
# UPDATE RUNTIME STATE
# =========================================================

python3 <<PY
import json

runtime_file = "$RUNTIME_FILE"

with open(runtime_file, "r", encoding="utf-8") as f:
    data = json.load(f)

qualification = data.get("qualification", {})

qualification["status"] = "$QUALIFICATION_STATUS"
qualification["entryScore"] = int("$ENTRY_SCORE")

data["qualification"] = qualification

with open(runtime_file, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
PY

log "Runtime qualification updated"

# =========================================================
# REPORT
# =========================================================

LATEST_SPRINT=$(
grep -o '"latestSprint"[[:space:]]*:[[:space:]]*"[^"]*"' "$RUNTIME_FILE" \
| head -1 \
| cut -d'"' -f4 \
|| echo "UNKNOWN"
)

cat > "$REPORT_FILE" <<EOF
{
  "generatedAt":"$ISO_TIME",
  "engine":"QUALIFICATION_STATE_RESOLVER_V1",
  "latestSprint":"$LATEST_SPRINT",
  "entryScore":$ENTRY_SCORE,
  "qualificationStatus":"$QUALIFICATION_STATUS",
  "runtimeFile":"$RUNTIME_FILE"
}
EOF

log "Qualification report generated"

# =========================================================
# EXPORT LOG
# =========================================================

cp "$LOG_FILE" /sdcard/Download/RL_SYS/ 2>/dev/null || true

log "SUCCESS"

echo ""
echo "===================================="
echo "QUALIFICATION STATE RESOLVER"
echo "===================================="
echo "ENTRY SCORE : $ENTRY_SCORE"
echo "STATUS      : $QUALIFICATION_STATUS"
echo "===================================="

echo "434-A RESULT: SUCCESS"
