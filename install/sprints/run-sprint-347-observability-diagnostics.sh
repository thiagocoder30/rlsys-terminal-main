#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 347"
echo " OBSERVABILITY DIAGNOSTICS"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

LOG_DIR="/sdcard/Download/rlsys/logs/sprint-347-observability-diagnostics"
mkdir -p "$LOG_DIR"

echo "[1/5] Localizando arquivos..."

TEST1="tests/observability-analytics-shadow-auditor.test.js"
TEST2="tests/observability-drift-certification-engine.test.js"
TEST3="tests/observability-drift-stability-analyzer.test.js"

for file in "$TEST1" "$TEST2" "$TEST3"; do
  if [ ! -f "$file" ]; then
    echo "[ERROR] Arquivo não encontrado: $file"
    exit 1
  fi
done

echo "[2/5] Executando Shadow Auditor isoladamente..."
node --test "$TEST1" \
  > "$LOG_DIR/shadow-auditor.stdout.log" \
  2> "$LOG_DIR/shadow-auditor.stderr.log" || true

echo "[3/5] Executando Drift Certification isoladamente..."
node --test "$TEST2" \
  > "$LOG_DIR/drift-certification.stdout.log" \
  2> "$LOG_DIR/drift-certification.stderr.log" || true

echo "[4/5] Executando Drift Stability isoladamente..."
node --test "$TEST3" \
  > "$LOG_DIR/drift-stability.stdout.log" \
  2> "$LOG_DIR/drift-stability.stderr.log" || true

REPORT="$LOG_DIR/report.txt"

{
  echo "======================================"
  echo " RL.SYS CORE OBSERVABILITY REPORT"
  echo "======================================"
  echo

  echo "===== SHADOW AUDITOR ====="
  cat "$LOG_DIR/shadow-auditor.stdout.log" 2>/dev/null || true
  cat "$LOG_DIR/shadow-auditor.stderr.log" 2>/dev/null || true

  echo
  echo "===== DRIFT CERTIFICATION ====="
  cat "$LOG_DIR/drift-certification.stdout.log" 2>/dev/null || true
  cat "$LOG_DIR/drift-certification.stderr.log" 2>/dev/null || true

  echo
  echo "===== DRIFT STABILITY ====="
  cat "$LOG_DIR/drift-stability.stdout.log" 2>/dev/null || true
  cat "$LOG_DIR/drift-stability.stderr.log" 2>/dev/null || true

} > "$REPORT"

echo "[5/5] Diagnóstico concluído."

echo
echo "======================================"
echo " RELATÓRIO GERADO"
echo "======================================"
echo "$REPORT"
echo
echo "Execute:"
echo "cat $REPORT"
echo "======================================"
