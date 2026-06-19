#!/usr/bin/env bash

# =========================================================
# RL.SYS CORE — PROJECT CONTINUITY SNAPSHOT ENGINE (434-C)
# =========================================================
# Objective:
# - Generate executive continuity snapshot
# - Consolidate institutional state
# - Improve SSB restore speed
# - Create single-source project summary
# - Feed future Export/Import pipelines
# =========================================================

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

PROJECT_STATE="$ROOT/install/sprints/flags/RL_SYS_PROJECT_STATE.json"
RUNTIME_STATE="$ROOT/install/sprints/flags/RL_SYS_RUNTIME_STATE.json"

OUTPUT="$ROOT/install/sprints/flags/PROJECT_CONTINUITY_SNAPSHOT.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_434C_project_continuity_snapshot_$(date +%Y%m%d_%H%M%S).log"

log() {
    echo "[434-C] $1" | tee -a "$LOG_FILE"
}

log "STARTING PROJECT CONTINUITY SNAPSHOT ENGINE"

if [ ! -f "$PROJECT_STATE" ]; then
    log "PROJECT STATE NOT FOUND"
    echo "434-C RESULT: FAIL"
    exit 1
fi

if [ ! -f "$RUNTIME_STATE" ]; then
    log "RUNTIME STATE NOT FOUND"
    echo "434-C RESULT: FAIL"
    exit 1
fi

python3 <<PY
import json
from datetime import datetime

project_file = "$PROJECT_STATE"
runtime_file = "$RUNTIME_STATE"
output_file = "$OUTPUT"

with open(project_file, "r", encoding="utf-8") as f:
    project = json.load(f)

with open(runtime_file, "r", encoding="utf-8") as f:
    runtime = json.load(f)

current_sprint = project.get("currentSprint", "UNKNOWN")
phase = project.get("phase", "UNKNOWN")
health = project.get("repositoryHealth", "UNKNOWN")

qualification = (
    runtime.get("qualification", {})
           .get("status", "UNKNOWN")
)

consistency = runtime.get(
    "stateConsistency",
    "UNKNOWN"
)

next_sprint = "UNKNOWN"

roadmap = project.get("roadmap", {})
next_list = roadmap.get("next", [])

if isinstance(next_list, list) and len(next_list) > 0:
    next_sprint = str(next_list[0])

system_status = "READY_FOR_CONTINUATION"

snapshot = {
    "generatedAt": datetime.now().astimezone().isoformat(),
    "engine": "PROJECT_CONTINUITY_SNAPSHOT_ENGINE_V1",
    "currentSprint": current_sprint,
    "phase": phase,
    "health": health,
    "qualification": qualification,
    "stateConsistency": consistency,
    "nextSprint": next_sprint,
    "systemStatus": system_status
}

with open(output_file, "w", encoding="utf-8") as out:
    json.dump(snapshot, out, indent=2)
PY

log "Snapshot generated"
log "OUTPUT=$OUTPUT"

cp "$LOG_FILE" /sdcard/Download/RL_SYS/ 2>/dev/null || true

log "SUCCESS"

echo ""
echo "===================================="
echo "PROJECT CONTINUITY SNAPSHOT"
echo "===================================="
echo "OUTPUT : $OUTPUT"
echo "STATUS : READY_FOR_CONTINUATION"
echo "===================================="

echo "434-C RESULT: SUCCESS"
