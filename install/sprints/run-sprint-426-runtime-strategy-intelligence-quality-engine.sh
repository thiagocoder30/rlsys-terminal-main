#!/bin/bash

echo "[SPRINT 426] RUNTIME STRATEGY INTELLIGENCE QUALITY ENGINE START"

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
LEDGER="$ROOT/install/sprints/flags/RUNTIME_CONVERGENCE_REPORT.json"
DECISION="$ROOT/install/sprints/flags/RUNTIME_EXECUTION_DECISION_REPORT.json"
WINDOW="$ROOT/install/sprints/flags/RUNTIME_ENTRY_WINDOW_DYNAMICS_REPORT.json"
REGIME="$ROOT/install/sprints/flags/RUNTIME_REGIME_VALIDATION_SIGNAL_INTEGRITY_REPORT.json"
DECAY="$ROOT/install/sprints/flags/RUNTIME_EXECUTION_DECAY_TIMING_REPORT.json"

OUT="$ROOT/install/sprints/flags/RUNTIME_STRATEGY_INTELLIGENCE_QUALITY_REPORT.json"

echo "[426] ROOT=$ROOT"
echo "[426] LOADING INTELLIGENCE SIGNALS..."

get_score () {
  FILE=$1
  KEY=$2
  if [ -f "$FILE" ]; then
    grep -oE "\"$KEY\"[ ]*:[ ]*[0-9]+" "$FILE" | head -n1 | grep -oE "[0-9]+"
  else
    echo 0
  fi
}

CONVERGENCE=$(get_score "$LEDGER" "score")
CAUSAL=$(get_score "$LEDGER" "causal")
DECISION_SCORE=$(get_score "$DECISION" "score")
WINDOW_SCORE=$(get_score "$WINDOW" "confidence")
REGIME_SCORE=$(get_score "$REGIME" "baseSignal")
DECAY_SCORE=$(get_score "$DECAY" "decayedScore")

# fallback safety
CONVERGENCE=${CONVERGENCE:-0}
CAUSAL=${CAUSAL:-0}
DECISION_SCORE=${DECISION_SCORE:-0}
WINDOW_SCORE=${WINDOW_SCORE:-0}
REGIME_SCORE=${REGIME_SCORE:-0}
DECAY_SCORE=${DECAY_SCORE:-0}

echo "[426] SIGNALS LOADED"
echo "[426] CONVERGENCE=$CONVERGENCE CAUSAL=$CAUSAL DECISION=$DECISION_SCORE WINDOW=$WINDOW_SCORE REGIME=$REGIME_SCORE DECAY=$DECAY_SCORE"

QUALITY=$(( (CONVERGENCE + CAUSAL + DECISION_SCORE + WINDOW_SCORE + REGIME_SCORE) / 5 + DECAY_SCORE ))

if [ "$QUALITY" -ge 80 ]; then
  STATE="HIGH_QUALITY_SIGNAL"
elif [ "$QUALITY" -ge 60 ]; then
  STATE="MODERATE_SIGNAL"
else
  STATE="LOW_QUALITY_SIGNAL"
fi

echo "=============================="
echo "[SPRINT 426 RESULT]"
echo "QUALITY_SCORE: $QUALITY"
echo "STATE: $STATE"
echo "ACTION: QUALIFY_STRATEGY_ONLY"
echo "NOTE: ENTRY DECISION IS HANDLED BY 421+GATE LAYER"
echo "OUTPUT: $OUT"
echo "=============================="

mkdir -p "$ROOT/install/sprints/flags"

cat > "$OUT" <<EOF
{
  "generatedAt": "$(date -I
