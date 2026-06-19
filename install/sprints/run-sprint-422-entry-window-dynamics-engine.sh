#!/usr/bin/env bash

set -e

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAG_DIR="$ROOT/install/sprints/flags"
LOG_DIR="$ROOT/install/sprints/logs"

mkdir -p "$FLAG_DIR"
mkdir -p "$LOG_DIR"

SPRINT_ID="422"

DECISION_FILE="$FLAG_DIR/RUNTIME_EXECUTION_DECISION_REPORT.json"
CONVERGENCE_FILE="$FLAG_DIR/RUNTIME_CONVERGENCE_REPORT.json"
CAUSAL_FILE="$FLAG_DIR/RUNTIME_CAUSAL_INTEGRITY_REPORT.json"

OUTPUT="$FLAG_DIR/RUNTIME_ENTRY_WINDOW_DYNAMICS_REPORT.json"
LOG="$LOG_DIR/sprint-422-entry-window-dynamics.log"

echo "[SPRINT 422] ENTRY WINDOW DYNAMICS ENGINE START" | tee "$LOG"
echo "[422] ROOT=$ROOT" | tee -a "$LOG"

# ----------------------------
# SAFE PARSER (jq + fallback)
# ----------------------------

safe_get() {
  local file=$1
  local query=$2

  if [[ -f "$file" ]]; then
    if command -v jq >/dev/null 2>&1; then
      jq -r "$query" "$file" 2>/dev/null || echo "0"
    else
      grep -oE '[0-9]+' "$file" | head -n 1
    fi
  else
    echo "0"
  fi
}

echo "[422] LOADING CONTEXT..." | tee -a "$LOG"

# ----------------------------
# LOAD INPUTS
# ----------------------------

CONVERGENCE=$(safe_get "$CONVERGENCE_FILE" '.convergence.score')
CAUSAL=$(safe_get "$CAUSAL_FILE" '.analysis.causalScore')
PREV_SCORE=$(safe_get "$DECISION_FILE" '.decision.score')

# synthetic temporal signals (simulation layer)
MOMENTUM=$(( (CONVERGENCE + CAUSAL) / 2 ))
DRIFT=$(( 100 - PREV_SCORE ))
VELOCITY=$(( MOMENTUM - DRIFT ))

# ----------------------------
# WINDOW STATE ENGINE
# ----------------------------

echo "[422] ANALYZING WINDOW DYNAMICS..." | tee -a "$LOG"

if (( VELOCITY >= 25 )); then
  WINDOW_STATE="OPENING"
  CONFIDENCE=85
elif (( VELOCITY >= 0 )); then
  WINDOW_STATE="STABLE"
  CONFIDENCE=70
else
  WINDOW_STATE="CLOSING"
  CONFIDENCE=55
fi

# compute entry pressure
ENTRY_PRESSURE=$(( (MOMENTUM + CONFIDENCE) / 2 ))

if (( ENTRY_PRESSURE >= 80 )); then
  ACTION="ENTER_SOON"
elif (( ENTRY_PRESSURE >= 65 )); then
  ACTION="PREPARE"
else
  ACTION="HOLD"
fi

# estimated window size
WINDOW_SIZE=$(( CONFIDENCE / 10 ))
[[ $WINDOW_SIZE -lt 1 ]] && WINDOW_SIZE=1

# ----------------------------
# OUTPUT
# ----------------------------

cat > "$OUTPUT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "model": "ENTRY_WINDOW_DYNAMICS_ENGINE_V1",
  "inputs": {
    "convergence": $CONVERGENCE,
    "causal": $CAUSAL,
    "previousScore": $PREV_SCORE
  },
  "dynamics": {
    "momentum": $MOMENTUM,
    "drift": $DRIFT,
    "velocity": $VELOCITY
  },
  "window": {
    "state": "$WINDOW_STATE",
    "confidence": $CONFIDENCE,
    "sizeRounds": $WINDOW_SIZE
  },
  "decision": {
    "entryPressure": $ENTRY_PRESSURE,
    "action": "$ACTION"
  },
  "interpretation": {
    "meaning": "detects if execution window is opening or closing",
    "note": "focuses on timing evolution, not static score"
  }
}
EOF

echo "==============================" | tee -a "$LOG"
echo "[SPRINT 422 RESULT]" | tee -a "$LOG"
echo "WINDOW STATE: $WINDOW_STATE" | tee -a "$LOG"
echo "CONFIDENCE: $CONFIDENCE" | tee -a "$LOG"
echo "ACTION: $ACTION" | tee -a "$LOG"
echo "OUTPUT: $OUTPUT" | tee -a "$LOG"
echo "==============================" | tee -a "$LOG"

echo "[SPRINT 422] COMPLETE" | tee -a "$LOG"
