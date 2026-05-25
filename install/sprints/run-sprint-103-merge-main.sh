#!/usr/bin/env bash
set -euo pipefail

SPRINT_ID="103"
SPRINT_BRANCH="sprint-103-paper-runtime-snapshot-recovery"
MERGE_MSG="merge: sprint 103 paper runtime snapshot recovery"

RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOCAL_LOG_DIR="logs"
DOWNLOAD_LOG_DIR="/sdcard/Download"

LOG_FILE="${LOCAL_LOG_DIR}/rlsys-merge-sprint-${SPRINT_ID}-${RUN_ID}.log"
DOWNLOAD_LOG_FILE="${DOWNLOAD_LOG_DIR}/rlsys-merge-sprint-${SPRINT_ID}-${RUN_ID}.log"

mkdir -p "$LOCAL_LOG_DIR" "$DOWNLOAD_LOG_DIR" 2>/dev/null || true

exec > >(tee -a "$LOG_FILE" "$DOWNLOAD_LOG_FILE" 2>/dev/null || tee -a "$LOG_FILE") 2>&1

finish() {
  code="$?"
  echo ""
  echo "============================================================"
  if [ "$code" -eq 0 ]; then
    echo "RL.SYS CORE :: Merge Sprint ${SPRINT_ID} concluído com SUCESSO"
  else
    echo "RL.SYS CORE :: Merge Sprint ${SPRINT_ID} falhou"
  fi
  echo "Status: $code"
  echo "Log local: $LOG_FILE"
  echo "Log Download: $DOWNLOAD_LOG_FILE"
  echo "============================================================"
  exit "$code"
}
trap finish EXIT

echo "== RL.SYS CORE :: Merge Sprint ${SPRINT_ID} =="
echo "Branch origem: $SPRINT_BRANCH"
echo "Destino: main"
echo "Run ID: $RUN_ID"

if [ ! -d ".git" ]; then
  echo "ERROR: execute este script na raiz do repositório rlsys-terminal-main"
  exit 1
fi

echo "== Sincronizando repositório =="
git fetch origin main "$SPRINT_BRANCH"

echo "== Validando branch da Sprint antes do merge =="
git checkout "$SPRINT_BRANCH"
git reset --hard "origin/$SPRINT_BRANCH"

npm run build
npm test

echo "== Preparando main limpa =="
git checkout main
git reset --hard origin/main

echo "== Mergeando Sprint ${SPRINT_ID} em main =="
git merge --no-ff "$SPRINT_BRANCH" -m "$MERGE_MSG"

echo "== Validando main após merge =="
npm run build
npm test

echo "== Enviando main atualizada para GitHub =="
git push origin main

echo ""
echo "== Merge Sprint ${SPRINT_ID} finalizado =="
echo "Main atualizada no GitHub com sucesso."
