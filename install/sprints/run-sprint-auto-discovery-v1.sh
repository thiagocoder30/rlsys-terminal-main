#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

FLAGS="$ROOT/install/sprints/flags/STATE_OF_RL_SYS.json"
SPRINT_DIR="$ROOT/install/sprints"

echo "[AUTO-DISCOVERY] RL.SYS SPRINT ENGINE"

# -----------------------------
# CHECK LEDGER
# -----------------------------

if [ ! -f "$FLAGS" ]; then
  echo "[ERROR] Ledger not found"
  exit 1
fi

COMPLETED=$(node -e "
const fs = require('fs');
const s = JSON.parse(fs.readFileSync('$FLAGS','utf8'));
console.log(JSON.stringify(s.completed_sprints || []));
")

echo "[INFO] Completed Sprints:"
echo "$COMPLETED" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')))"

# -----------------------------
# LIST AVAILABLE SPRINTS
# -----------------------------

echo ""
echo "[INFO] Available Sprints in repo:"

ls "$SPRINT_DIR" | grep "run-sprint-" | sed 's/run-sprint-//g' | sed 's/.sh//g'

# -----------------------------
# SUGGEST NEXT SPRINT
# -----------------------------

NEXT=$(ls "$SPRINT_DIR" \
  | grep "run-sprint-" \
  | sed 's/run-sprint-//g' \
  | sed 's/.sh//g' \
  | while read s; do
      echo "$s"
    done \
  | node -e "
const fs = require('fs');

const completed = JSON.parse(process.argv[1]);
const all = fs.readFileSync(0,'utf8').trim().split('\n').filter(Boolean);

const next = all.find(s => !completed.includes(s));

console.log(next || 'NONE');
" "$COMPLETED")

echo ""
echo "[NEXT SUGGESTED SPRINT]: $NEXT"

# -----------------------------
# OPTIONAL AUTO RUN
# -----------------------------

if [ "$1" == "--run" ]; then
  echo "[AUTO] Executing next sprint: $NEXT"
  bash "$SPRINT_DIR/run-sprint-$NEXT.sh"
fi
