#!/usr/bin/env bash

set -e

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAG_DIR="$ROOT/install/sprints/flags"
LOG_DIR="$ROOT/install/sprints/logs"

mkdir -p "$FLAG_DIR"
mkdir -p "$LOG_DIR"

SPRINT_ID="425"

# Inputs from system
WINDOW="$FLAG_DIR/RUNTIME_ENTRY_WINDOW_DYNAMICS_REPORT.json"
REGIME="$FLAG_DIR/RUNTIME_REGIME_VALIDATION_SIGNAL_INTEGRITY_REPORT.json"
GATE424="$FLAG_DIR/RUNTIME_FINAL_EXECUTION_GATE_REPORT.json"
DECISION="$FLAG_DIR/RUNTIME_EXECUTION_DECISION_REPORT.json"

OUTPUT="$FLAG_DIR/RUNTIME_EXECUTION_DECAY_TIMING_REPORT.json"
LOG="$LOG_DIR/sprint-425-execution-decay.log"

echo "[SPRINT 425] EXECUTION CONFIDENCE DECAY ENGINE START" | tee "$LOG"
echo "[425] ROOT=$ROOT" | tee -a "$LOG"

# ----------------------------
# SAFE PARSER
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

safe_str() {
  local file=$1
  local key=$2
  grep -o "\"$key\"[ ]*:[ ]*\"[^\"]*\"" "$file" 2>/dev/null | cut -d'"' -f4
}

echo "[425] LOADING TEMPORAL SIGNAL STATE..." | tee -a "$LOG"

# ----------------------------
# INPUTS
# ----------------------------

WINDOW_STATE=$(safe_str "$WINDOW" "state")
WINDOW_CONFIDENCE=$(safe_get "$WINDOW" '.window.confidence')

REGIME_STATE=$(safe_str "$REGIME" "regime.state")
REGIME_INTEGRITY=$(safe_str "$REGIME" "validation.integrity")

GATE_STATE=$(safe_str "$GATE424" "gate.state")
GATE_ACTION=$(safe_str "$GATE424" "gate.action")

DEC_SCORE=$(safe_get "$DECISION" '.decision.score')

[[ -z "$WINDOW_STATE" ]] && WINDOW_STATE="UNKNOWN"
[[ -z "$REGIME_STATE" ]] && REGIME_STATE="UNKNOWN"
[[ -z "$REGIME_INTEGRITY" ]] && REGIME_INTEGRITY="LOW"
[[ -z "$GATE_STATE" ]] && GATE_STATE="CLOSED"
[[ -z "$GATE_ACTION" ]] && GATE_ACTION="BLOCK_EXECUTION"
[[ -z "$WINDOW_CONFIDENCE" ]] && WINDOW_CONFIDENCE=0
[[ -z "$DEC_SCORE" ]] && DEC_SCORE=0

echo "[425] COMPUTING TIME-DECAY MODEL..." | tee -a "$LOG"

# ----------------------------
# CORE DECAY ENGINE
# ----------------------------

# base entry potential
BASE_POTENTIAL=$(( (WINDOW_CONFIDENCE + DEC_SCORE) / 2 ))

# temporal decay factor
if [[ "$WINDOW_STATE" == "OPENING" ]]; then
  DECAY=0
elif [[ "$WINDOW_STATE" == "STABLE" ]]; then
  DECAY=10
elif [[ "$WINDOW_STATE" == "CLOSING" ]]; then
  DECAY=25
else
  DECAY=40
fi

# regime penalty
if [[ "$REGIME_INTEGRITY" == "HIGH" ]]; then
  REGIME_PENALTY=0
elif [[ "$REGIME_INTEGRITY" == "MEDIUM" ]]; then
  REGIME_PENALTY=15
else
  REGIME_PENALTY=35
fi

# gate penalty (very important)
if [[ "$GATE_STATE" == "OPEN" ]]; then
  GATE_PENALTY=0
elif [[ "$GATE_STATE" == "SOFT_OPEN" ]]; then
  GATE_PENALTY=10
else
  GATE_PENALTY=50
fi

# final decay score
DECAYED_SCORE=$(( BASE_POTENTIAL - DECAY - REGIME_PENALTY - GATE_PENALTY ))

# ----------------------------
# TIMING CLASSIFICATION
# ----------------------------

if (( DECAYED_SCORE >= 85 )); then
  TIMING="OPTIMAL_ENTRY"
  ACTION="EXECUTE_IMMEDIATELY"
elif (( DECAYED_SCORE >= 70 )); then
  TIMING="ACCEPTABLE_ENTRY"
  ACTION="ENTER_WITH_CAUTION"
elif (( DECAYED_SCORE >= 50 )); then
  TIMING="LATE_ENTRY"
  ACTION="REDUCE_SIZE_OR_SKIP"
else
  TIMING="INVALID_ENTRY_WINDOW"
  ACTION="NO_ENTRY"
fi

echo "[425] FINALIZING TEMPORAL QUALITY..." | tee -a "$LOG"

# ----------------------------
# OUTPUT
# ----------------------------

cat > "$OUTPUT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "model": "EXECUTION_CONFIDENCE_DECAY_TIMING_ENGINE_V1",
  "inputs": {
    "windowState": "$WINDOW_STATE",
    "windowConfidence": $WINDOW_CONFIDENCE,
    "decisionScore": $DEC_SCORE,
    "regimeState": "$REGIME_STATE",
    "regimeIntegrity": "$REGIME_INTEGRITY",
    "gateState": "$GATE_STATE",
    "gateAction": "$GATE_ACTION"
  },
  "scoring": {
    "basePotential": $BASE_POTENTIAL,
    "decay": $DECAY,
    "regimePenalty": $REGIME_PENALTY,
    "gatePenalty": $GATE_PENALTY,
    "decayedScore": $DECAYED_SCORE
  },
  "timing": {
    "classification": "$TIMING",
    "action": "$ACTION"
  },
  "interpretation": {
    "meaning": "evaluates whether a valid signal is still temporally actionable or has degraded",
    "principle": "good signals lose value over time; timing is a first-class constraint"
  }
}
EOF

echo "==============================" | tee -a "$LOG"
echo "[SPRINT 425 RESULT]" | tee -a "$LOG"
echo "DECAY SCORE: $DECAYED_SCORE" | tee -a "$LOG"
echo "TIMING: $TIMING" | tee -a "$LOG"
echo "ACTION: $ACTION" | tee -a "$LOG"
echo "OUTPUT: $OUTPUT" | tee -a "$LOG"
echo "==============================" | tee -a "$LOG"

echo "[SPRINT 425] COMPLETE" | tee -a "$LOG"
