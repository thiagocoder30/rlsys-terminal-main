#!/data/data/com.termux/files/usr/bin/bash

set -u

ROOT="$(pwd)"
REPORT="rlsys-first-paper-readiness.txt"
DOWNLOAD_DIR="/sdcard/Download"

echo "RL.SYS — FIRST PAPER SESSION READINESS AUDIT" > "$REPORT"
echo "======================================================" >> "$REPORT"
echo "Generated: $(date)" >> "$REPORT"
echo "Repository: $ROOT" >> "$REPORT"
echo "" >> "$REPORT"


section() {
  echo "" >> "$REPORT"
  echo "======================================================" >> "$REPORT"
  echo "$1" >> "$REPORT"
  echo "======================================================" >> "$REPORT"
}


section "1. GIT STATE"

git branch --show-current >> "$REPORT" 2>&1
echo "" >> "$REPORT"

git status --short >> "$REPORT" 2>&1 || true

echo "" >> "$REPORT"
echo "LAST COMMITS:" >> "$REPORT"
git log --oneline -12 >> "$REPORT" 2>&1


section "2. BUILD"

npm run build >> "$REPORT" 2>&1

echo "" >> "$REPORT"
echo "BUILD EXIT CODE: $?" >> "$REPORT"


section "3. PAPER ENTRYPOINT"

grep -RIn \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  -E \
  "paper-runtime-session|paper:live|paper:manual|live-paper-orchestrator|automaticBet|executeBet|placeBet" \
  package.json scripts src tests \
  >> "$REPORT" 2>&1 || true


section "4. STRATEGY RUNTIME COMPONENTS"

grep -RIn \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  -E \
  "TriplicacaoLiveTerminalController|TriplicacaoProspectiveSessionRuntime|PaperInstitutionalRecoveryController|FusionLiveTerminalController|FusionReduced|HeatmapDynamic" \
  src scripts tests \
  >> "$REPORT" 2>&1 || true


section "5. FINANCIAL AUTHORITY MAP"

grep -RIn \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  -E \
  "PaperStakeRecommendationResolver|PaperBaseExposureRiskPolicy|PaperProspectivePortfolioRiskController|PaperInstitutionalRecoveryController|Settlement" \
  src/application/runtime \
  >> "$REPORT" 2>&1 || true


section "6. PAPER SAFETY INVARIANTS"

echo "Checking forbidden execution primitives..." >> "$REPORT"

grep -RIn \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  -E \
  "automaticBet|autoBet|placeBet|executeBet|casinoApi|providerApi" \
  src scripts tests \
  >> "$REPORT" 2>&1 || true


section "7. HISTORICAL SHADOW"

grep -RIn \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  -E \
  "PaperHistoricalShadowSessionEngine|PaperHistoricalShadowPresenter|HistoricalShadowReplayEngine|SHADOW" \
  src scripts tests \
  >> "$REPORT" 2>&1 || true


section "8. LIVE TEMPORAL BOUNDARY"

grep -RIn \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  -E \
  "FRONTEIRA|temporal|Sync|catch-up|synchronizedHistory" \
  scripts src tests \
  >> "$REPORT" 2>&1 || true


section "9. TEST INVENTORY"

find tests/application/runtime \
  -maxdepth 1 \
  -type f \
  -name "*.test.js" \
  | sort >> "$REPORT"


section "10. FINAL STATUS"

echo "READY REVIEW REQUIRED" >> "$REPORT"
echo "" >> "$REPORT"
echo "This report does not authorize LIVE betting." >> "$REPORT"
echo "RL.Sys remains recommendation-only with human execution." >> "$REPORT"


if [ -d "$DOWNLOAD_DIR" ]; then
  cp "$REPORT" "$DOWNLOAD_DIR/$REPORT"
  echo "" >> "$REPORT"
  echo "Copied to $DOWNLOAD_DIR/$REPORT" >> "$REPORT"
fi


echo "Audit completed:"
echo "$REPORT"

