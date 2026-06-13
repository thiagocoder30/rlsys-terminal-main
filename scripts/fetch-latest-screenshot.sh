#!/usr/bin/env bash
set -euo pipefail

# Caminho padrão do Android/Termux para Screenshots
SOURCE_DIR="/data/data/com.termux/files/home/storage/shared/DCIM/Screenshots"
DEST_DIR="data/paper-runtime/warmup-screenshots"

echo "🔍 Inspecionando galeria do dispositivo..."

if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ ERRO CRÍTICO: Diretório de Screenshots não encontrado em: $SOURCE_DIR"
  echo "👉 DICA: Você precisa dar permissão de armazenamento ao Termux."
  echo "Execute o comando 'termux-setup-storage' e tente novamente."
  exit 1
fi

mkdir -p "$DEST_DIR"

# ls -t ordena por data de modificação. head -n 1 pega apenas o mais novo.
LATEST_FILE=$(ls -t "$SOURCE_DIR" | grep -iE '\.(png|jpg|jpeg|webp)$' | head -n 1 || true)

if [ -z "$LATEST_FILE" ]; then
  echo "❌ ERRO: Nenhuma imagem encontrada na pasta de Screenshots do celular."
  exit 1
fi

SOURCE_PATH="$SOURCE_DIR/$LATEST_FILE"
DEST_PATH="$DEST_DIR/$LATEST_FILE"

echo "🧹 Limpando prints antigos do projeto para evitar confusão no OCR..."
rm -f "$DEST_DIR"/*

echo "📸 Importando imagem mais recente: $LATEST_FILE"
cp "$SOURCE_PATH" "$DEST_PATH"

echo "✅ Imagem ancorada com sucesso no ambiente RL.SYS!"
