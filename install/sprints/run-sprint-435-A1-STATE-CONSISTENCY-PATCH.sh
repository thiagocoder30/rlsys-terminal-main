#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

echo "[435-A.1] STATE CONSISTENCY PATCH STARTING..."

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT_DIR/install/sprints/flags"

PROJECT_STATE="$FLAGS_DIR/RL_SYS_PROJECT_STATE.json"
RUNTIME_STATE="$FLAGS_DIR/RL_SYS_RUNTIME_STATE.json"

DOWNLOAD_DIR="/sdcard/Download/RL_SYS"
LOG_DIR="$DOWNLOAD_DIR/logs"

mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_435A1_state_consistency_$(date +%Y%m%d_%H%M%S).log"

echo "[435-A.1] ROOT_DIR=$ROOT_DIR" | tee -a "$LOG_FILE"

if [ ! -f "$RUNTIME_STATE" ]; then
  echo "[FAIL] Missing runtime state: $RUNTIME_STATE" | tee -a "$LOG_FILE"
  exit 1
fi

# ============================================================
# Detect highest implemented sprint
# ============================================================

HIGHEST=427

check_sprint() {
  local sprint="$1"
  local file="$2"

  if [ -f "$file" ]; then
    HIGHEST="$sprint"
    echo "[OK] Sprint $sprint detected" | tee -a "$LOG_FILE"
  fi
}

check_sprint 428 "$FLAGS_DIR/INSTITUTIONAL_ENTRY_QUALIFICATION_REPORT.json"
check_sprint 430 "$FLAGS_DIR/INSTITUTIONAL_DRIFT_STABILITY_REPORT.json"
check_sprint 431 "$FLAGS_DIR/INSTITUTIONAL_META_CONSISTENCY_REPORT.json"
check_sprint 432 "$FLAGS_DIR/INSTITUTIONAL_SELF_CORRECTION_REPORT.json"
check_sprint 433 "$FLAGS_DIR/INSTITUTIONAL_ENTRY_TIMING_REPORT.json"
check_sprint 434 "$FLAGS_DIR/INSTITUTIONAL_EXECUTION_PRESSURE_REPORT.json"

PROJECT_SPRINT="UNKNOWN"

if [ -f "$PROJECT_STATE" ]; then
  PROJECT_SPRINT=$(python3 - <<PY
import json
try:
    with open("$PROJECT_STATE","r",encoding="utf-8") as f:
        d=json.load(f)
    print(d.get("currentSprint","UNKNOWN"))
except:
    print("UNKNOWN")
PY
)
fi

STATE_CONSISTENCY="ALIGNED"

if [ "$PROJECT_SPRINT" != "$HIGHEST" ] && [ "$PROJECT_SPRINT" != "${HIGHEST}-A" ]; then
  STATE_CONSISTENCY="DIVERGENT"
fi

# ============================================================
# Update runtime state
# ============================================================

TMP_FILE="$(mktemp)"

python3 <<PY > "$TMP_FILE"
import json

with open("$RUNTIME_STATE","r",encoding="utf-8") as f:
    data=json.load(f)

data["latestSprint"] = "$HIGHEST"
data["projectStateSprint"] = "$PROJECT_SPRINT"
data["runtimeStateSprint"] = "$HIGHEST"
data["stateConsistency"] = "$STATE_CONSISTENCY"

print(json.dumps(data, indent=2))
PY

mv "$TMP_FILE" "$RUNTIME_STATE"

cp "$RUNTIME_STATE" \
"$DOWNLOAD_DIR/RL_SYS_RUNTIME_STATE.json"

echo "[435-A.1] PROJECT SPRINT : $PROJECT_SPRINT" | tee -a "$LOG_FILE"
echo "[435-A.1] RUNTIME SPRINT : $HIGHEST" | tee -a "$LOG_FILE"
echo "[435-A.1] CONSISTENCY    : $STATE_CONSISTENCY" | tee -a "$LOG_FILE"

git add "$RUNTIME_STATE" 2>/dev/null || true

echo "[435-A.1] COMPLETED" | tee -a "$LOG_FILE"
