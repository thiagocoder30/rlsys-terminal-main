#!/data/data/com.termux/files/usr/bin/bash

set -e

OUTPUT="portfolio-risk-consumption-audit.txt"

rm -f "$OUTPUT"

{
echo "======================================================"
echo "RL.SYS — PORTFOLIO RISK CONSUMPTION AUDIT"
echo "======================================================"
echo

echo "HEAD:"
git log -1 --oneline

echo
echo "======================================================"
echo "PORTFOLIO RISK CONTROLLER REFERENCES"
echo "======================================================"

grep -R -n \
  "PaperProspectivePortfolioRiskController" \
  src tests \
  || true

echo
echo "======================================================"
echo "RECOVERY CONTROLLER REFERENCES"
echo "======================================================"

grep -R -n \
  "PaperInstitutionalRecoveryController" \
  src/application/runtime \
  || true

echo
echo "======================================================"
echo "TRIPLICACAO RUNTIME STAKE FLOW"
echo "======================================================"

grep -R -n -A8 -B8 \
  "suggestedStake\|financialRecommendation\|financialController" \
  src/application/runtime/TriplicacaoProspectiveInstitutionalSessionRuntime.ts \
  || true

echo
echo "======================================================"
echo "FUSION RUNTIME REFERENCES"
echo "======================================================"

grep -R -n \
  "FusionReduced\|financialController\|suggestedStake" \
  src/application/runtime \
  || true

echo
echo "======================================================"
echo "HEATMAP RUNTIME REFERENCES"
echo "======================================================"

grep -R -n \
  "Heatmap\|financialController\|suggestedStake" \
  src/application/runtime \
  || true

echo
echo "======================================================"
echo "CONSTRUCTOR DEPENDENCY MAP"
echo "======================================================"

grep -R -n \
  "constructor(" \
  src/application/runtime \
  | grep -E \
  "Triplicacao|Fusion|Heatmap|Portfolio|Recovery" \
  || true

echo
echo "======================================================"
echo "END AUDIT"
echo "======================================================"

} > "$OUTPUT"

echo "Audit generated: $OUTPUT"
