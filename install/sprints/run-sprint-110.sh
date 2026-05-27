#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT_ID="110"
BRANCH="sprint-110-paper-runtime-v1-release-tag"
COMMIT_MSG="chore(release): publish paper runtime v1 release artifacts"
TAG_NAME="v1.0-paper-runtime"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/rlsys-install-sprint-${SPRINT_ID}-${RUN_ID}.log"
DOWNLOAD_DIR="/sdcard/Download"

mkdir -p "$LOG_DIR"

exec > >(tee -a "$LOG_FILE") 2>&1

copy_log() {
  if [ -d "$DOWNLOAD_DIR" ]; then
    cp "$LOG_FILE" "$DOWNLOAD_DIR/" || true
    echo "Log copiado para: ${DOWNLOAD_DIR}/$(basename "$LOG_FILE")"
  fi
}

fail() {
  local exit_code="$1"
  local line_no="$2"
  echo
  echo "== SPRINT ${SPRINT_ID} FALHOU =="
  echo "Exit code: ${exit_code}"
  echo "Linha: ${line_no}"
  echo "Log: ${LOG_FILE}"
  copy_log
  exit "$exit_code"
}

success() {
  echo
  echo "== SPRINT ${SPRINT_ID} CONCLUÍDA COM SUCESSO =="
  echo "Tag: ${TAG_NAME}"
  echo "Log: ${LOG_FILE}"
  copy_log
}

trap 'fail "$?" "$LINENO"' ERR

echo "== RL.SYS CORE :: Sprint 110 =="
echo "== Paper Runtime v1.0 Release Tag =="
echo "Run ID: ${RUN_ID}"

git fetch origin main --tags || true
git checkout main
git pull origin main || true
git checkout -B "$BRANCH"

mkdir -p docs/release docs/operations tests

cat > docs/release/v1.0-paper-runtime.md <<'MD'
# RL.SYS CORE — Paper Runtime v1.0

## Identidade do produto

O RL.SYS CORE v1.0 Paper Runtime é um copiloto defensivo de operação paper supervisionada.

Ele não promete ganho.  
Ele protege o operador.

## Escopo da versão

Esta versão consolida:

- runtime operacional resiliente
- paper runtime supervisionado
- HUD humano
- REPL interativo
- snapshot de sessão
- recovery seguro
- ledger paper
- relatório de sessão
- discipline guard
- readiness review
- logs auditáveis
- testes automatizados

## Princípios de segurança

O sistema deve:

- bloquear operação insegura
- preservar banca
- reduzir exposição emocional
- impedir retomada automática após recuperação
- manter rastreabilidade
- exigir supervisão humana

## Comandos principais

```bash
npm run paper:runtime
npm run soak:runtime
npm run certify:runtime
npm test
