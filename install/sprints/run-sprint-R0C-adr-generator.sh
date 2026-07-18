#!/data/data/com.termux/files/usr/bin/bash

##############################################################################
# RL.SYS CORE
# Sprint R0-C
#
# ADR GENERATOR
#
# Objetivo:
# Gerar Architecture Decision Records (ADR)
# para preservar decisões arquiteturais críticas.
#
# SAFE MODE
# READ ONLY
# NO RUNTIME CHANGES
##############################################################################

set -e

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

ROOT=$(git rev-parse --show-toplevel)

DOCS_DIR="$ROOT/docs/architecture"
ADR_DIR="$DOCS_DIR/adr"

EXPORT_DIR="/sdcard/Download/RL_SYS/architecture/adr"
LOG_DIR="/sdcard/Download/RL_SYS/architecture/logs"

mkdir -p "$ADR_DIR"
mkdir -p "$EXPORT_DIR"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/R0C-$TIMESTAMP.log"

exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo "====================================================="
echo "RL.SYS CORE"
echo "SPRINT R0-C"
echo "ADR GENERATOR"
echo "====================================================="

echo "[1/8] Generating ADR-001 RuntimeKernel..."

cat > "$ADR_DIR/ADR-001-RuntimeKernel.md" <<'EOF'
# ADR-001 RuntimeKernel

Status: ACCEPTED

## Context

RuntimeKernel atua como núcleo de coordenação do sistema.

## Decision

Preservar RuntimeKernel como ponto central de orquestração.

## Consequences

Não substituir sem ADR formal.
EOF

echo "[2/8] Generating ADR-002 PersistenceModel..."

cat > "$ADR_DIR/ADR-002-PersistenceModel.md" <<'EOF'
# ADR-002 Persistence Model

Status: ACCEPTED

## Context

Persistência atual validada pelos pipelines existentes.

## Decision

Preservar contratos de persistência existentes.

## Consequences

Mudanças exigem migração compatível.
EOF

echo "[3/8] Generating ADR-003 CLIContracts..."

cat > "$ADR_DIR/ADR-003-CLIContracts.md" <<'EOF'
# ADR-003 CLI Contracts

Status: ACCEPTED

## Context

CLI é utilizada por operadores e pipelines.

## Decision

Manter compatibilidade retroativa.

## Consequences

Mudanças devem preservar comportamento.
EOF

echo "[4/8] Generating ADR-004 CertificationPipeline..."

cat > "$ADR_DIR/ADR-004-CertificationPipeline.md" <<'EOF'
# ADR-004 Certification Pipeline

Status: ACCEPTED

## Context

Certificações protegem estabilidade operacional.

## Decision

Toda refatoração deve manter certificações existentes.

## Consequences

Nenhuma Sprint pode remover validações.
EOF

echo "[5/8] Generating ADR-005 RepositoryPattern..."

cat > "$ADR_DIR/ADR-005-RepositoryPattern.md" <<'EOF'
# ADR-005 Repository Pattern

Status: ACCEPTED

## Context

Repositories isolam acesso a dados.

## Decision

Preservar padrão Repository.

## Consequences

Evitar acesso direto à persistência.
EOF

echo "[6/8] Generating ADR-006 RefactoringPolicy..."

cat > "$ADR_DIR/ADR-006-RefactoringPolicy.md" <<'EOF'
# ADR-006 Refactoring Policy

Status: ACCEPTED

## Context

Projeto em evolução contínua.

## Decision

Refatorações devem seguir:

- Same Input -> Same Output
- No Runtime Behaviour Change
- No Persistence Contract Change
- No Certification Removal

## Consequences

Refatorar por extração e modularização incremental.
EOF

echo "[7/8] Exporting ADRs..."

cp -f "$ADR_DIR"/*.md "$EXPORT_DIR/"

echo "[8/8] Completed"

echo
echo "Generated ADRs:"
ls -lah "$ADR_DIR"

echo
echo "Exported ADRs:"
ls -lah "$EXPORT_DIR"

echo
echo "Log:"
echo "$LOG_FILE"

echo
echo "Sprint R0-C completed successfully."
