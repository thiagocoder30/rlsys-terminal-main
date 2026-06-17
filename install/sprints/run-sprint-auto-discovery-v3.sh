#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

FLAGS="$ROOT/install/sprints/flags/STATE_OF_RL_SYS.json"
SPRINT_DIR="$ROOT/install/sprints"

echo "[AUTO-DISCOVERY v3] RL.SYS SPRINT ENGINE"

# -----------------------------
# LOAD LEDGER SAFELY
# -----------------------------

COMPLETED=$(node -e "
const fs = require('fs');
const s = JSON.parse(fs.readFileSync('$FLAGS','utf8'));
console.log((s.completed_sprints || []).join('\\n'));
")

# -----------------------------
# GET VALID SPRINT FILES ONLY
# -----------------------------

echo ""
echo "[INFO] Valid Sprint Files:"

ALL=$(find "$SPRINT_DIR" -maxdepth 1 -type f -name "run-sprint-*.sh" \
  | sed 's|.*/run-sprint-||g' \
  | sed 's|.sh||g')

echo "$ALL"

# -----------------------------
# NEXT SPRINT (FILTERED BY REAL FILE EXISTENCE)
# -----------------------------

NEXT=$(echo "$ALL" | node -e "
const fs = require('fs');

const completed = process.argv[1].split('\n').filter(Boolean);
const all = fs.readFileSync(0,'utf8').trim().split('\n').filter(Boolean);

// remove completed + broken entries
const next = all.find(s => !completed.includes(s));

console.log(next || 'NONE');
" "$COMPLETED")

echo ""
echo "[NEXT VALID SPRINT]: $NEXT"

# -----------------------------
# SAFE EXECUTION
# -----------------------------

if [ "${1:-}" == "--run" ]; then
  if [ "$NEXT" == "NONE" ]; then
    echo "[AUTO] No valid sprints available"
    exit 0
  fi

  echo "[AUTO] Running: $NEXT"
  bash "$SPRINT_DIR/run-sprint-$NEXT.sh"
fi
