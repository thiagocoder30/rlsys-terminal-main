#!/usr/bin/env bash
set -euo pipefail

SPRINT_NAME="${1:-sprint-buffer}"
PROJECT_DIR="${PROJECT_DIR:-$HOME/rlsys-terminal-main}"
DOWNLOAD_DIR="/sdcard/Download"

cd "$PROJECT_DIR"

mkdir -p logs

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="logs/${SPRINT_NAME}-${TIMESTAMP}.log"
DOWNLOAD_FILE="${DOWNLOAD_DIR}/${SPRINT_NAME}-${TIMESTAMP}.log"

if ! command -v tmux >/dev/null 2>&1; then
  echo "ERRO: tmux não encontrado. Instale com: pacman -S tmux"
  exit 1
fi

if [ ! -d "$DOWNLOAD_DIR" ]; then
  echo "ERRO: pasta $DOWNLOAD_DIR não encontrada."
  echo "No Termux puro, rode: termux-setup-storage"
  exit 1
fi

tmux capture-pane -S -100000 -p > "$LOG_FILE"

cp "$LOG_FILE" "$DOWNLOAD_FILE"

echo "Buffer capturado com sucesso:"
echo "$LOG_FILE"
echo
echo "Arquivo enviado para Downloads:"
echo "$DOWNLOAD_FILE"
echo
echo "Após me enviar o arquivo aqui e eu confirmar a análise, remova com:"
echo "rm '$LOG_FILE' '$DOWNLOAD_FILE'"
