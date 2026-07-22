#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

echo "=================================================="
echo "RL.SYS AIDER SESSION BOOTSTRAP"
echo "=================================================="
echo

echo "[1/5] Preparing institutional context..."
bash .dev/scripts/bootstrap/prepare-aider-context.sh

echo
echo "[2/5] Validating context..."
bash .dev/scripts/bootstrap/validate-aider-context.sh

echo
echo "[3/5] Repository status..."
git status --short || true

echo
echo "[4/5] Starting Aider..."
echo

exec aider \
  --config .aider.conf.yml \
  --read .dev/context/AIDER_CONTEXT.md \
  --read .dev/AGENTS.md \
  --read .dev/workflow/AIDER_EXECUTION_PROTOCOL.md

echo
echo "[5/5] Session finished."
