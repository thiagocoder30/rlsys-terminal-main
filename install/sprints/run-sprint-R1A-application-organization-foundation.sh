#!/data/data/com.termux/files/usr/bin/bash

##############################################################################
# RL.SYS CORE
# Sprint R1-A
#
# APPLICATION ORGANIZATION FOUNDATION
#
# Objetivo:
# Preparar a futura organização da camada application
# sem mover arquivos existentes.
#
# SAFE MODE
# NO IMPORT CHANGES
# NO RUNTIME CHANGES
# NO CONTRACT CHANGES
##############################################################################

set -e

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

ROOT=$(git rev-parse --show-toplevel)

LOG_DIR="/sdcard/Download/RL_SYS/architecture/logs"
EXPORT_DIR="/sdcard/Download/RL_SYS/architecture"

mkdir -p "$LOG_DIR"
mkdir -p "$EXPORT_DIR"

LOG_FILE="$LOG_DIR/R1A-$TIMESTAMP.log"

exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo "====================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-A"
echo "APPLICATION ORGANIZATION FOUNDATION"
echo "====================================================="

cd "$ROOT"

echo "[1/7] Creating future application structure..."

mkdir -p src/application/analytics
mkdir -p src/application/certification
mkdir -p src/application/decision
mkdir -p src/application/learning
mkdir -p src/application/paper
mkdir -p src/application/runtime
mkdir -p src/application/security
mkdir -p src/application/warmup

echo "[2/7] Creating README markers..."

for DIR in \
analytics \
certification \
decision \
learning \
paper \
runtime \
security \
warmup
do

cat > "src/application/$DIR/README.md" <<EOF
# $DIR

Created by Sprint R1-A.

Purpose:
Future organization namespace.

Status:
Reserved.

No files migrated yet.
EOF

done

echo "[3/7] Generating organization plan..."

mkdir -p docs/architecture

cat > docs/architecture/APPLICATION_ORGANIZATION_PLAN.md <<EOF
# APPLICATION ORGANIZATION PLAN

Generated: $(date)

Future namespaces:

- analytics
- certification
- decision
- learning
- paper
- runtime
- security
- warmup

Policy:

1. No existing files moved.
2. No imports changed.
3. New components should preferentially be created in the proper namespace.
4. Existing runtime remains untouched.
EOF

echo "[4/7] Exporting plan..."

cp -f docs/architecture/APPLICATION_ORGANIZATION_PLAN.md \
"$EXPORT_DIR/"

echo "[5/7] Verifying structure..."

find src/application \
-maxdepth 1 \
-type d \
| sort

echo "[6/7] Git status..."

git status --short || true

echo "[7/7] Completed"

echo
echo "Plan:"
echo "docs/architecture/APPLICATION_ORGANIZATION_PLAN.md"

echo
echo "Export:"
echo "$EXPORT_DIR/APPLICATION_ORGANIZATION_PLAN.md"

echo
echo "Log:"
echo "$LOG_FILE"

echo
echo "Sprint R1-A completed successfully."
