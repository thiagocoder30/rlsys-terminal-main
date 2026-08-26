#!/data/data/com.termux/files/usr/bin/bash

set -e

OUTPUT="triplicacao-portfolio-runtime-injection-point.txt"

rm -f "$OUTPUT"

{
echo "======================================================"
echo "RL.SYS — TRIPLICAÇÃO PORTFOLIO RUNTIME INJECTION AUDIT"
echo "======================================================"
echo

echo "HEAD:"
git log --oneline -1

echo
echo "======================================================"
echo "IMPORTS"
echo "======================================================"

sed -n '1,130p' \
src/application/runtime/TriplicacaoProspectiveSessionRuntime.ts

echo
echo "======================================================"
echo "CONSTRUCTOR / DEPENDENCIES"
echo "======================================================"

grep -n -A120 -B20 \
"constructor" \
src/application/runtime/TriplicacaoProspectiveSessionRuntime.ts

echo
echo "======================================================"
echo "STAKE FLOW"
echo "======================================================"

grep -n -A80 -B40 \
"suggestedStake" \
src/application/runtime/TriplicacaoProspectiveSessionRuntime.ts

echo
echo "======================================================"
echo "SETTLEMENT FLOW"
echo "======================================================"

grep -n -A100 -B40 \
"financialController.settle\|settle(" \
src/application/runtime/TriplicacaoProspectiveSessionRuntime.ts

} > "$OUTPUT"

echo "Generated: $OUTPUT"
