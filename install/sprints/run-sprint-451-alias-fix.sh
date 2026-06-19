#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 451"
echo " SYSTEM ALIAS RECONFIGURATION"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

SYS_BIN="/data/data/com.termux/files/usr/bin/rlsys"

echo "[1/2] Atualizando o gancho de execução global em $SYS_BIN..."

cat > "$SYS_BIN" <<'EOF'
#!/bin/bash
# Ponto de entrada oficial do RL.SYS Core compilado
node /data/data/com.termux/files/home/rlsys-terminal-main/dist/main.js "$@"
EOF

echo "[2/2] Aplicando permissões de execução estritas..."
chmod +x "$SYS_BIN"

echo "[+] Registrando a sprint de configuração de ambiente no repositório..."
git add install/sprints/run-sprint-451-alias-fix.sh
git commit -m "chore(env): reconfigure system binary path to target production dist/main.js entry point seamlessly (Sprint 451)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 451 APLICADA COM SUCESSO \033[0m"
echo " O COMANDO GLOBAL 'rlsys' ESTÁ ATUALIZADO"
echo "======================================"
