#!/usr/bin/env bash
set -Eeuo pipefail

LOCAL_DIR="${RLSYS_TERMUX_WARMUP_INBOX:-/sdcard/Download/rlsys-warmup-inbox}"
REMOTE_DIR="${RLSYS_CODESPACE_WARMUP_SCREENSHOTS:-/workspaces/rlsys-terminal-main/data/paper-runtime/warmup-screenshots}"

mkdir -p "$LOCAL_DIR"

echo "RL.SYS CORE — TERMUX WARMUP SCREENSHOT SYNC"
echo "Local:  $LOCAL_DIR"
echo "Remote: $REMOTE_DIR"
echo ""

if ! command -v gh >/dev/null 2>&1; then
  echo "Erro: GitHub CLI 'gh' não encontrado no Termux."
  exit 1
fi

if ! find "$LOCAL_DIR" -maxdepth 1 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.webp" \) | grep -q .; then
  echo "Nenhum print encontrado em: $LOCAL_DIR"
  echo "Tire o print da mesa e mova para essa pasta."
  exit 1
fi

gh cs cp "$LOCAL_DIR" "remote:$REMOTE_DIR"

echo ""
echo "Sync concluído."
echo "No console guiado, use:"
echo "warmup-screenshot latest"
