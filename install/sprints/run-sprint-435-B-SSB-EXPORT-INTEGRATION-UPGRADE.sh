#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

echo "[435-B] SSB EXPORT INTEGRATION UPGRADE STARTING..."

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT_DIR/install/sprints/flags"

RUNTIME_STATE="$FLAGS_DIR/RL_SYS_RUNTIME_STATE.json"

EXPORT_TOOL="$ROOT_DIR/install/sprints/tools/SSB-EXPORT.sh"

DOWNLOAD_ROOT="/sdcard/Download/RL_SYS"

LOG_DIR="$DOWNLOAD_ROOT/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_435B_export_upgrade_$(date +%Y%m%d_%H%M%S).log"

echo "[435-B] ROOT_DIR=$ROOT_DIR" | tee -a "$LOG_FILE"

# ============================================================
# VALIDATION
# ============================================================

if [ ! -f "$RUNTIME_STATE" ]; then
  echo "[FAIL] Missing runtime state" | tee -a "$LOG_FILE"
  echo "[FAIL] Run 435-A first" | tee -a "$LOG_FILE"
  exit 1
fi

if [ ! -f "$EXPORT_TOOL" ]; then
  echo "[FAIL] Missing SSB-EXPORT.sh" | tee -a "$LOG_FILE"
  exit 1
fi

# ============================================================
# BACKUP
# ============================================================

BACKUP_FILE="$EXPORT_TOOL.pre435B"

cp "$EXPORT_TOOL" "$BACKUP_FILE"

echo "[435-B] Backup created:" | tee -a "$LOG_FILE"
echo "$BACKUP_FILE" | tee -a "$LOG_FILE"

# ============================================================
# PATCH DETECTION
# ============================================================

if grep -q "RL_SYS_RUNTIME_STATE.json" "$EXPORT_TOOL"; then

  echo "[435-B] Export already upgraded." | tee -a "$LOG_FILE"

else

cat >> "$EXPORT_TOOL" <<'EOF'

# ============================================================
# 435-B EXPORT INTEGRATION
# ============================================================

RUNTIME_STATE_FILE="$ROOT_DIR/install/sprints/flags/RL_SYS_RUNTIME_STATE.json"

if [ -f "$RUNTIME_STATE_FILE" ]; then

  cp "$RUNTIME_STATE_FILE" \
     "$EXPORT_DIR/RL_SYS_RUNTIME_STATE.json"

  python3 <<PY
import json
from datetime import datetime

runtime_file="$EXPORT_DIR/RL_SYS_RUNTIME_STATE.json"

with open(runtime_file,"r",encoding="utf-8") as f:
    runtime=json.load(f)

manifest={
    "generatedAt": datetime.now().isoformat(),
    "engine":"SSB_EXPORT_V2",
    "primarySource":"RL_SYS_RUNTIME_STATE.json",
    "latestSprint": runtime.get("latestSprint","UNKNOWN"),
    "commitId": runtime.get("commitId","UNKNOWN"),
    "stateConsistency": runtime.get("stateConsistency","UNKNOWN")
}

with open(
    "$EXPORT_DIR/STATE_MANIFEST.json",
    "w",
    encoding="utf-8"
) as out:
    json.dump(manifest,out,indent=2)
PY

fi

EOF

fi

chmod +x "$EXPORT_TOOL"

echo "[435-B] EXPORT TOOL PATCHED" | tee -a "$LOG_FILE"
echo "[435-B] Runtime State integrated." | tee -a "$LOG_FILE"
echo "[435-B] Manifest generation integrated." | tee -a "$LOG_FILE"

echo "[435-B] COMPLETED" | tee -a "$LOG_FILE"
