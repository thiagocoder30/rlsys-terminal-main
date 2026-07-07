#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - FAST BOOT ALIAS"
echo "======================================"

# Captura o diretório raiz absoluto do sistema
ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# Limpa o alias antigo caso ele já exista, para evitar duplicações
if grep -q "alias rlsys=" ~/.bashrc; then
    sed -i '/alias rlsys=/d' ~/.bashrc
fi

# Injeta o novo alias tático apontando para o caminho correto
echo "alias rlsys='cd $ROOT_DIR/pwa-terminal && npm run dev'" >> ~/.bashrc

echo "[RL.SYS] Alias 'rlsys' fundido ao núcleo do terminal com sucesso."
echo "======================================"
