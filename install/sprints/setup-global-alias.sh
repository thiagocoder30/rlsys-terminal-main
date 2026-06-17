#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - DEPLOYMENT TOOL"
echo " GLOBAL CLI BINARY SETUP"
echo "======================================"

# Descobre o caminho raiz do projeto
ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
# Caminho da pasta de binários globais do Termux
BIN_DIR="$PREFIX/bin"

echo "[1/2] Criando executável nativo em $BIN_DIR/rlsys..."

cat > "$BIN_DIR/rlsys" <<EOF
#!/usr/bin/env bash
# RL.SYS CORE - Global Entrypoint

echo "Iniciando RL.SYS CORE..."
cd "$ROOT_DIR" || { echo "Falha ao localizar o diretório base: $ROOT_DIR"; exit 1; }
npx ts-node src/main.ts
EOF

echo "[2/2] Aplicando permissões de execução global..."
chmod +x "$BIN_DIR/rlsys"

echo "======================================"
echo -e "\033[1;32m ATALHO GLOBAL INSTALADO COM SUCESSO \033[0m"
echo " STATUS: COMANDO 'rlsys' DISPONÍVEL NO SISTEMA"
echo "======================================"

