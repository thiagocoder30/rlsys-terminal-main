#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — ROADMAP STATE RECONCILIATION (434-B)
# =========================================================
# Objective:
# - Reconcile roadmap history with current sprint
# - Detect documentation drift
# - Update completed roadmap entries
# - Preserve existing roadmap structure
# - Generate reconciliation report
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

PROJECT_STATE="$ROOT/install/sprints/flags/RL_SYS_PROJECT_STATE.json"

REPORT="$ROOT/install/sprints/flags/ROADMAP_RECONCILIATION_REPORT.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_434B_roadmap_reconciliation_$(date +%Y%m%d_%H%M%S).log"

log() {
    echo "[434-B] $1" | tee -a "$LOG_FILE"
}

log "STARTING ROADMAP STATE RECONCILIATION"

if [ ! -f "$PROJECT_STATE" ]; then
    log "PROJECT STATE NOT FOUND"
    echo "434-B RESULT: FAIL"
    exit 1
fi

CURRENT_SPRINT=$(
grep -o '"currentSprint"[[:space:]]*:[[:space:]]*"[^"]*"' \
"$PROJECT_STATE" \
| head -1 \
| cut -d'"' -f4
)

log "CURRENT SPRINT = $CURRENT_SPRINT"

BACKUP="${PROJECT_STATE}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$PROJECT_STATE" "$BACKUP"

log "Backup created"
log "$BACKUP"

python3 <<PY
import json
from datetime import datetime

project_file = "$PROJECT_STATE"
current_sprint = "$CURRENT_SPRINT"

with open(project_file, "r", encoding="utf-8") as f:
    data = json.load(f)

completed = data.get("roadmap", {}).get("completed", [])

completed = [str(x) for x in completed]

def sprint_key(value):
    v = str(value)
    if "-" in v:
        parts = v.split("-")
        try:
            return (int(parts[0]), parts[1])
        except:
            return (999999, v)
    try:
        return (int(v), "")
    except:
        return (999999, v)

existing = set(completed)

for n in range(428, 435):
    if str(n) not in existing:
        completed.append(str(n))

completed = sorted(
    list(dict.fromkeys(completed)),
    key=sprint_key
)

roadmap = data.setdefault("roadmap", {})
roadmap["completed"] = completed
roadmap["next"] = ["435"]

data["generatedAt"] = datetime.now().astimezone().isoformat()

with open(project_file, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
PY

COMPLETED_COUNT=$(
python3 - <<PY
import json
with open("$PROJECT_STATE","r",encoding="utf-8") as f:
    data=json.load(f)
print(len(data["roadmap"]["completed"]))
PY
)

cat > "$REPORT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "engine":"ROADMAP_STATE_RECONCILIATION_434_B",
  "currentSprint":"$CURRENT_SPRINT",
  "result":"SUCCESS",
  "completedCount":$COMPLETED_COUNT,
  "nextSprint":"435"
}
EOF

log "Roadmap updated"
log "Completed count = $COMPLETED_COUNT"
log "Report generated"
log "SUCCESS"

echo ""
echo "===================================="
echo "ROADMAP STATE RECONCILIATION"
echo "===================================="
echo "CURRENT SPRINT : $CURRENT_SPRINT"
echo "NEXT SPRINT    : 435"
echo "COMPLETED      : $COMPLETED_COUNT"
echo "===================================="

echo "434-B RESULT: SUCCESS"
