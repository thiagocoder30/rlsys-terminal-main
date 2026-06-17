#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 346-INSPECT"
echo " ENGINE STATE DISCOVERY"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

LOG_DIR="/sdcard/Download/rlsys/logs/sprint-346-inspect"
mkdir -p "$LOG_DIR"

REPORT_FILE="$LOG_DIR/report.txt"
TREE_FILE="$LOG_DIR/tree.txt"
HASH_FILE="$LOG_DIR/hashes.txt"

{
  echo "===== RL.SYS CORE INSPECTION ====="
  echo "DATE=$(date)"
  echo "ROOT=$ROOT_DIR"
  echo
} > "$REPORT_FILE"

echo "[1/7] Ambiente"

{
  echo "===== TOOLCHAIN ====="
  node -v || true
  npm -v || true
  tsc -v || true
  git --version || true
  echo
} >> "$REPORT_FILE"

echo "[2/7] Git"

{
  echo "===== GIT STATUS ====="
  git status --short || true
  echo
  echo "===== CURRENT BRANCH ====="
  git branch --show-current || true
  echo
  echo "===== LAST 20 COMMITS ====="
  git log --oneline -20 || true
  echo
} >> "$REPORT_FILE"

echo "[3/7] Localizando AnalyticsDecisionEngine"

ENGINE_FILE=$(find src -type f -name "AnalyticsDecisionEngine.ts" | head -n 1 || true)

if [ -z "${ENGINE_FILE:-}" ]; then
  echo "[ERROR] AnalyticsDecisionEngine.ts não encontrado"
  exit 1
fi

echo "ENGINE_FILE=$ENGINE_FILE" | tee -a "$REPORT_FILE"

echo "[4/7] Hashes"

{
  echo
  echo "===== FILE HASHES ====="
  sha256sum "$ENGINE_FILE" || true

  find src -type f \
    \( \
      -name "*Triplicacao*" -o \
      -name "*Heatmap*" -o \
      -name "*Analytics*" \
    \) \
    -exec sha256sum {} \; 2>/dev/null || true
} > "$HASH_FILE"

echo "[5/7] Exportando Engine"

cp "$ENGINE_FILE" "$LOG_DIR/AnalyticsDecisionEngine.ts"

echo "[6/7] Exportando árvore"

find src -type f | sort > "$TREE_FILE"

echo "[7/7] Snapshot final"

{
  echo
  echo "===== OBSERVABILITY FILES ====="
  find src -type f | grep -i "observ" || true
  echo
  echo "===== ANALYTICS FILES ====="
  find src -type f | grep -i "analytics" || true
} >> "$REPORT_FILE"

echo
echo "======================================"
echo " INSPECTION COMPLETE"
echo "======================================"
echo "REPORT:  $REPORT_FILE"
echo "TREE:    $TREE_FILE"
echo "HASHES:  $HASH_FILE"
echo "ENGINE:  $LOG_DIR/AnalyticsDecisionEngine.ts"
echo "======================================"
