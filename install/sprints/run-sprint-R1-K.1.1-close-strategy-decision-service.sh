#!/data/data/com.termux/files/usr/bin/bash

set -e

FILE="src/application/decision/StrategyDecisionService.ts"

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.1.1"
echo "StrategyDecisionService Class Closure Fix"
echo "=================================================="

if ! grep -q "^}$" "$FILE"; then
cat >> "$FILE" <<'EOF'
}
EOF
fi

echo "[OK] StrategyDecisionService.ts fechado"
echo "[OK] Validando TypeScript"

npx tsc --noEmit

echo "[OK] Sprint concluída"
