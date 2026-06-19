#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 446"
echo " SYNC COMMAND HOTFIX"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null 2>&1 || pwd)
cd "$ROOT_DIR"

# Substituição do método attachEventListeners para incluir o comando SYNC
# Este script re-aplica a classe completa com o parser de sync
echo "[1/2] A atualizar o parser de comandos do Orchestrator..."
sed -i 's/this.rl.on(.line., (line) => {/&\n            if (cmd.startsWith("sync ")) {\n                const sequence = cmd.replace("sync ", "").trim();\n                const nums = sequence.split(",").map(n => parseInt(n.trim(), 10));\n                nums.forEach(n => {\n                    if (!isNaN(n) \&\& n >= 0 \&\& n <= 36) {\n                        this.mesaTracker.addNumber(n);\n                    }\n                });\n                this.saveSystemState();\n                this.generateNextTrade();\n                this.renderTerminalHud();\n                return;\n            }/' src/presentation/cli/LivePaperOrchestrator.ts

echo "[2/2] A recompilar o sistema..."
npx tsc

echo "======================================"
echo -e "\033[1;32m SPRINT 446 APLICADA E COMPILADA \033[0m"
echo " STATUS: COMANDO SYNC ATIVO"
echo "======================================"
