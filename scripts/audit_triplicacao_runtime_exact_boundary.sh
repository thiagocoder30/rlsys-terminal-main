#!/data/data/com.termux/files/usr/bin/bash

set -u

OUT="rlsys-triplicacao-runtime-exact-boundary.txt"

{
  echo "============================================================"
  echo "RL.SYS — TRIPLICACAO EXACT PORTFOLIO BOUNDARY"
  echo "============================================================"
  echo

  echo "===== STATUS ====="
  git status --short
  echo

  echo "===== RUNTIME: CONSTRUCTOR / FINANCIAL CONTROLLER ====="
  sed -n '300,470p' \
    src/application/runtime/TriplicacaoProspectiveSessionRuntime.ts
  echo

  echo "===== RUNTIME: RECOMMENDATION FLOW ====="
  sed -n '650,820p' \
    src/application/runtime/TriplicacaoProspectiveSessionRuntime.ts
  echo

  echo "===== RUNTIME: SETTLEMENT FLOW ====="
  sed -n '800,940p' \
    src/application/runtime/TriplicacaoProspectiveSessionRuntime.ts
  echo

  echo "===== RUNTIME: SNAPSHOT / BANKROLL ====="
  grep -n -B20 -A55 \
    -E \
    "currentBankroll|peakBankroll|pendingLossDebt|financialController|financialRecommendation|financialSettlement" \
    src/application/runtime/TriplicacaoProspectiveSessionRuntime.ts
  echo

  echo "===== PORTFOLIO PUBLIC METHODS ====="
  grep -n -B15 -A80 \
    -E \
    "public reserve\\(|public settle\\(|public release\\(|public snapshot\\(" \
    src/application/runtime/PaperProspectivePortfolioRiskController.ts
  echo

  echo "===== BUILD ====="
  npm run build
  echo

  echo "===== END ====="
} > "$OUT" 2>&1

mkdir -p /sdcard/Download
cp "$OUT" /sdcard/Download/

echo
echo "Arquivo gerado:"
echo "/sdcard/Download/$OUT"
