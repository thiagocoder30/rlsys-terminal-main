#!/bin/bash
set -Eeuo pipefail

PROJECT_DIR="$HOME/rlsys-terminal-main"
PATCH="rlsys-terminal-sprint-034-runtime-enforcement-orchestrator.diff"
BRANCH="sprint-034-runtime-enforcement-orchestrator"
LOG_DIR="$PROJECT_DIR/logs"
RUN_LOG="$LOG_DIR/sprint-034-install-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$LOG_DIR"

trap 'echo; echo "[ERRO] Falha na linha $LINENO. Veja o log:"; echo "$RUN_LOG"; echo; read -p "Pressione ENTER para manter o terminal aberto..." _' ERR
trap 'echo; echo "[FINALIZADO] Log salvo em: $RUN_LOG"; echo; read -p "Pressione ENTER para sair..." _' EXIT

exec > >(tee -a "$RUN_LOG") 2>&1

echo "[INFO] Entrando no projeto..."
cd "$PROJECT_DIR"

echo "[INFO] Ativando venv, se existir..."
[ -f ".venv/bin/activate" ] && source .venv/bin/activate || true

echo "[INFO] Garantindo patch na raiz do projeto..."
cp "/sdcard/Download/$PATCH" . 2>/dev/null || true
test -f "$PATCH"

echo "[INFO] Conferindo ambiente..."
pwd
git status --short
node -v
npm -v

echo "[INFO] Preparando branch..."
git checkout main
git pull origin main

git branch -D "$BRANCH" 2>/dev/null || true
git push origin --delete "$BRANCH" 2>/dev/null || true

git checkout -b "$BRANCH"

echo "[INFO] Validando patch..."
git apply --check "$PATCH"

echo "[INFO] Aplicando patch..."
git apply "$PATCH"

echo "[INFO] Instalando dependências..."
npm ci

echo "[INFO] Build TypeScript..."
npm run build

echo "[INFO] Testes..."
npm test

echo "[INFO] Removendo patch..."
rm "$PATCH"

echo "[INFO] Commit..."
git add .
git commit -m "feat(runtime): add enforcement orchestrator"

echo "[INFO] Push branch..."
git push -u origin "$BRANCH"

echo "[INFO] Merge em main..."
git checkout main
git pull origin main
git merge "$BRANCH"
git push origin main

echo "[INFO] Capturando buffer..."
./capture-sprint-buffer.sh

echo "[SUCESSO] Sprint 034 instalada com sucesso."
