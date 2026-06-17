#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - HOTFIX 373.3"
echo " MODULE RESOLUTION: GHOST FILE CLEANUP"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Expurgando arquivo JS legado (Ghost File)..."
# Deleta fisicamente o arquivo JS legado que está causando a colisão com o TS
if [ -f "src/domain/analytics/LiveMesaTracker.js" ]; then
    rm -f src/domain/analytics/LiveMesaTracker.js
    echo " -> Arquivo LiveMesaTracker.js removido com sucesso."
else
    echo " -> Arquivo LiveMesaTracker.js já estava ausente."
fi

echo "[2/2] Registrando limpeza na árvore Git..."
# Remove do Git caso estivesse rastreado, ignorando erros se não estiver
git rm -f src/domain/analytics/LiveMesaTracker.js 2>/dev/null || true
git commit -m "fix(analytics): remove legacy JS file causing module resolution collision with TS version (Hotfix 373.3)" > /dev/null 2>&1 || true

echo "======================================"
echo -e "\033[1;32m HOTFIX 373.3 APLICADO COM SUCESSO \033[0m"
echo " STATUS: RESOLUÇÃO DE MÓDULOS PURIFICADA"
echo "======================================"

