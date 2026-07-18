#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS AIDER SESSION BOOTSTRAP"
echo "=================================================="


echo "[1/4] Updating context..."

bash .dev/scripts/bootstrap/prepare-aider-context.sh


echo "[2/4] Validating context..."

bash .dev/scripts/bootstrap/validate-aider-context.sh


echo "[3/4] Repository status"

git status


echo "[4/4] Aider ready"

echo ""
echo "Load context:"
echo ".dev/context/AIDER_CONTEXT.md"
echo ""
echo "Follow:"
echo ".dev/workflow/AIDER_EXECUTION_PROTOCOL.md"

