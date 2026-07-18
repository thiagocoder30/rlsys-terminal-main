#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "====================================================="
echo "RL.SYS CORE - R0-BOOT-CMD"
echo "UNIFIED BOOT COMMAND INTERFACE"
echo "====================================================="

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

BOOT_MASTER="$REPO_ROOT/install/sprints/run-sprint-R0-BOOT-MASTER.sh"
BOOT_AI="$REPO_ROOT/install/sprints/run-sprint-R0-BOOT-AI.sh"

BOOT_DIR="/sdcard/Download/RL_SYS/bootstrap"
LOG_DIR="/sdcard/Download/RL_SYS/sprint_logs"

mkdir -p "$BOOT_DIR"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/R0-BOOT-CMD.log"

echo "[1/6] Checking system components..." | tee "$LOG_FILE"

if [ ! -f "$BOOT_MASTER" ]; then
  echo "BOOT-MASTER NOT FOUND" | tee -a "$LOG_FILE"
  exit 1
fi

echo "[2/6] Executing BOOT-MASTER..." | tee -a "$LOG_FILE"

bash "$BOOT_MASTER"

echo "[3/6] Loading reconstructed context..." | tee -a "$LOG_FILE"

MASTER_FILE="$BOOT_DIR/RL_SYS_MASTER_RECONSTRUCTED_CONTEXT.md"

if [ ! -f "$MASTER_FILE" ]; then
  echo "MASTER CONTEXT NOT FOUND" | tee -a "$LOG_FILE"
  exit 1
fi

echo "[4/6] Displaying system state..." | tee -a "$LOG_FILE"

echo "====================================================="
echo "📦 RL.SYS CORE - RECONSTRUCTED STATE"
echo "====================================================="
cat "$MASTER_FILE"
echo "====================================================="

echo "[5/6] Running AI inference layer..." | tee -a "$LOG_FILE"

if [ -f "$BOOT_AI" ]; then
  bash "$BOOT_AI"
else
  echo "BOOT-AI NOT FOUND (optional layer skipped)" | tee -a "$LOG_FILE"
fi

echo "[6/6] Done."

echo "====================================================="
echo "R0-BOOT-CMD COMPLETED"
echo "SYSTEM READY FOR CONTINUATION"
echo "====================================================="
