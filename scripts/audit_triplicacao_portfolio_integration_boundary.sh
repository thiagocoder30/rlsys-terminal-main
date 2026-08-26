#!/data/data/com.termux/files/usr/bin/bash

set -e

OUTPUT="triplicacao-portfolio-integration-audit.txt"

rm -f "$OUTPUT"

{
  echo "======================================================"
  echo "RL.SYS — TRIPLICAÇÃO PORTFOLIO INTEGRATION AUDIT"
  echo "======================================================"
  echo
  echo "HEAD:"
  git log --oneline -1
  echo
  echo "======================================================"
  echo "FILES"
  echo "======================================================"
  echo

  grep -RIl \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    -E \
    "TriplicacaoProspectiveInstitutionalSessionRuntime|PaperInstitutionalRecoveryController|PaperStakeRecommendationResolver|PaperProspectivePortfolioRiskController" \
    src/application/runtime \
    tests/application/runtime \
    || true

  echo
  echo "======================================================"
  echo "REFERENCES"
  echo "======================================================"
  echo

  grep -RIn \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    -E \
    "TriplicacaoProspectiveInstitutionalSessionRuntime|PaperInstitutionalRecoveryController|PaperStakeRecommendationResolver|PaperProspectivePortfolioRiskController|suggestedStake|settle\\(" \
    src/application/runtime \
    tests/application/runtime \
    || true

  echo
  echo "======================================================"
  echo "TRIPLICACAO RUNTIME FILE"
  echo "======================================================"
  echo

  find src/application/runtime \
    -name "*Triplicacao*" \
    -o -name "*Portfolio*Risk*" \
    -o -name "*Recovery*"

} > "$OUTPUT"

echo "Audit generated: $OUTPUT"
