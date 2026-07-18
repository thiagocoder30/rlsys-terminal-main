#!/data/data/com.termux/files/usr/bin/bash

##############################################################################
# RL.SYS CORE
# Sprint R0-A
#
# ARCHITECTURE BASELINE GENERATOR
#
# Objetivo:
# Gerar documentação arquitetural permanente do estado atual
# do repositório sem alterar comportamento operacional.
#
# SAFE MODE
# READ ONLY
# NO RUNTIME CHANGES
##############################################################################

set -e

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

ROOT="$(git rev-parse --show-toplevel)"

LOG_DIR="/sdcard/Download/RL_SYS/architecture/logs"
EXPORT_DIR="/sdcard/Download/RL_SYS/architecture"

mkdir -p "$LOG_DIR"
mkdir -p "$EXPORT_DIR"

LOG_FILE="$LOG_DIR/R0A-$TIMESTAMP.log"

exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo "====================================================="
echo "RL.SYS CORE"
echo "SPRINT R0-A"
echo "ARCHITECTURE BASELINE GENERATOR"
echo "====================================================="

cd "$ROOT"

DOCS_DIR="docs/architecture"

mkdir -p "$DOCS_DIR"

##############################################################################
# REPOSITORY INVENTORY
##############################################################################

echo "[1/8] Generating repository inventory..."

{
echo "# REPOSITORY INVENTORY"
echo
echo "Generated: $(date)"
echo
echo "## Top Level Structure"
echo

find . \
  -path "./node_modules" -prune -o \
  -path "./dist" -prune -o \
  -path "./.git" -prune -o \
  -type d \
  | sort

} > "$DOCS_DIR/REPOSITORY_INVENTORY.md"

##############################################################################
# DOMAIN MAP
##############################################################################

echo "[2/8] Generating domain map..."

{
echo "# DOMAIN MAP"
echo
echo "Generated: $(date)"
echo

find src/domain \
  -type f \
  2>/dev/null \
  | sort

} > "$DOCS_DIR/DOMAIN_MAP.md"

##############################################################################
# APPLICATION MAP
##############################################################################

echo "[3/8] Generating application map..."

{
echo "# APPLICATION MAP"
echo
echo "Generated: $(date)"
echo

find src/application \
  -type f \
  2>/dev/null \
  | sort

} > "$DOCS_DIR/APPLICATION_MAP.md"

##############################################################################
# INFRASTRUCTURE MAP
##############################################################################

echo "[4/8] Generating infrastructure map..."

{
echo "# INFRASTRUCTURE MAP"
echo
echo "Generated: $(date)"
echo

find src/infrastructure \
  -type f \
  2>/dev/null \
  | sort

} > "$DOCS_DIR/INFRASTRUCTURE_MAP.md"

##############################################################################
# LARGE FILES REPORT
##############################################################################

echo "[5/8] Generating large files report..."

{
echo "# LARGE FILES REPORT"
echo
echo "Generated: $(date)"
echo

find src \
  -name "*.ts" \
  -print0 |
while IFS= read -r -d '' file
do

LINES=$(wc -l < "$file")

if [ "$LINES" -ge 500 ]
then
  printf "%7s %s\n" "$LINES" "$file"
fi

done | sort -rn

} > "$DOCS_DIR/LARGE_FILES_REPORT.md"

##############################################################################
# ARCHITECTURE BASELINE
##############################################################################

echo "[6/8] Generating architecture baseline..."

cat > "$DOCS_DIR/ARCHITECTURE_BASELINE_V4_5.md" << EOF
# RL.SYS CORE

## Architecture Baseline

Generated: $(date)

### Protected Components

- RuntimeKernel
- Persistence Layer
- Certification Pipeline
- Repository Pattern
- CLI Contracts
- Financial Contracts

### Refactoring Rules

1. Same Input -> Same Output
2. No Runtime Behaviour Changes
3. No Persistence Changes
4. No Contract Changes
5. Refactor Through Extraction Only

### Baseline Version

V4.5
EOF

##############################################################################
# COPY TO DOWNLOAD
##############################################################################

echo "[7/8] Exporting artifacts..."

cp -f "$DOCS_DIR"/*.md "$EXPORT_DIR"/

##############################################################################
# GIT STATUS
##############################################################################

echo "[8/8] Completed"

echo
echo "Generated files:"
echo

ls -lah "$DOCS_DIR"

echo
echo "Exported files:"
echo

ls -lah "$EXPORT_DIR"

echo
echo "Log:"
echo "$LOG_FILE"

echo
echo "Sprint R0-A completed successfully."
