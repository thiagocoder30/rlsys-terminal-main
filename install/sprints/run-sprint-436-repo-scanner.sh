#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 436"
echo " ARCHITECTURAL CODE SCANNER"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

# Define o caminho de saída no diretório do Termux (Download)
OUT_DIR="/sdcard/Download/RL_SYS/snapshots"
mkdir -p "$OUT_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUT_FILE="$OUT_DIR/RL_SYS_CODE_SNAPSHOT_${TIMESTAMP}.txt"

echo "[1/2] Iniciando varredura da Clean Architecture..."

# Cria o cabeçalho do arquivo
cat << 'EOF' > "$OUT_FILE"
======================================================
 DOSSIÊ ARQUITETURAL: RL.SYS CORE
 EXPORTAÇÃO DE CÓDIGO FONTE LIMPO
======================================================
EOF
echo "DATA DA GERAÇÃO: $(date)" >> "$OUT_FILE"
echo -e "======================================================\n" >> "$OUT_FILE"

echo ">> Mapeando Árvore de Diretórios (Tree)..."
echo "--- DIRECTORY TREE ---" >> "$OUT_FILE"
# Lista a árvore, excluindo lixo
find . -type d \( -name "node_modules" -o -name ".git" -o -name "dist" -o -name "build" \) -prune -o -print | sort >> "$OUT_FILE"
echo -e "\n======================================================\n" >> "$OUT_FILE"

echo "[2/2] Extraindo lógica de Domínio, Risco e Inteligência..."
echo "--- SOURCE CODE ---" >> "$OUT_FILE"

# Encontra apenas arquivos de código úteis
find . -type d \( -name "node_modules" -o -name ".git" -o -name "dist" -o -name "build" \) -prune -o \
    -type f \( -name "*.ts" -o -name "*.js" -o -name "package.json" -o -name "tsconfig.json" \) -print | sort | while read -r file; do
    
    echo "Processando: $file"
    echo -e "\n\n// ======================================================" >> "$OUT_FILE"
    echo "// ARQUIVO: $file" >> "$OUT_FILE"
    echo "// ======================================================" >> "$OUT_FILE"
    
    # Adiciona o conteúdo do arquivo
    cat "$file" >> "$OUT_FILE"
done

echo "======================================"
echo -e "\033[1;32m VARREDURA CONCLUÍDA COM SUCESSO \033[0m"
echo " ARQUIVO SALVO EM: $OUT_FILE"
echo " (Envie este arquivo .txt para a análise de IA)"
echo "======================================"
