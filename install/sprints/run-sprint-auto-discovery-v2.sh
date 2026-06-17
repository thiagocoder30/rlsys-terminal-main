#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

FLAGS="$ROOT/install/sprints/flags/STATE_OF_RL_SYS.json"
SPRINT_DIR="$ROOT/install/sprints"

echo "[AUTO-DISCOVERY v2] RL.SYS SPRINT ENGINE"

# -----------------------------
# SAFETY: CHECK LEDGER
# -----------------------------

if [ ! -f "$FLAGS" ]; then
  echo "[ERROR] Ledger not found"
  exit 1
fi

# -----------------------------
# LOAD COMPLETED SPRINTS (SAFE)
# -----------------------------

COMPLETED=$(node -e "
const fs = require('fs');
const s = JSON.parse(fs.readFileSync('$FLAGS','utf8'));
console.log((s.completed_sprints || []).join('\\n'));
")

echo ""
echo "[INFO] Completed Sprints:"
echo "$COMPLETED"

# -----------------------------
# LIST AVAILABLE SPRINTS
# -----------------------------

echo ""
echo "[INFO] Available Sprints in repo:"

ALL_SPRINTS=$(ls "$SPRINT_DIR" \
  | grep "run-sprint-" \
  | sed 's/run-sprint-//g' \
  | sed 's/.sh//g')

echo "$ALL_SPRINTS"

# -----------------------------
# SAFE NEXT SPRINT CALC
# -----------------------------

NEXT=$(echo "$ALL_SPRINTS" | while read s; do
  echo "$s"
done | node -e "
const fs = require('fs');

const completed = process.argv[1].split('\\n').filter(Boolean);
const all = fs.readFileSync(0,'utf8').trim().split('\n').filter(Boolean);

const next = all.find(s => !completed.includes(s));

console.log(next || 'NONE');
" "$COMPLETED")

echo ""
echo "[NEXT SUGGESTED SPRINT]: $NEXT"

# -----------------------------
# SAFE EXECUTION FLAG
# -----------------------------

if [ "${1:-}" == "--run" ]; then
  if [ "$NEXT" == "NONE" ]; then
    echo "[AUTO] No pending sprints"
    exit 0
  fi

  echo "[AUTO] Executing next sprint: $NEXT"
  bash "$SPRINT_DIR/run-sprint-$NEXT.sh"
fi
