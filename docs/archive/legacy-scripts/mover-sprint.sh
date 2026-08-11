#!/usr/bin/env bash
set -euo pipefail

DOWNLOAD_DIR="/sdcard/Download"
PROJECT_DIR="$HOME/rlsys-terminal-main"
PATTERN="rlsys-terminal-sprint-*.diff"

cd "$DOWNLOAD_DIR"

file=$(ls -t $PATTERN 2>/dev/null | head -n 1 || true)

if [[ -z "$file" ]]; then
  echo "Nenhum arquivo encontrado: $DOWNLOAD_DIR/$PATTERN"
  exit 1
fi

mv "$file" "$PROJECT_DIR/"

echo "Arquivo movido com sucesso:"
echo "$DOWNLOAD_DIR/$file -> $PROJECT_DIR/$file"
