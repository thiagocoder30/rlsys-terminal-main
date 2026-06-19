#!/usr/bin/env bash

set -e

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAG_DIR="$ROOT/install/sprints/flags"
LOG_DIR="$ROOT/install/sprints/logs"

mkdir -p "$FLAG_DIR"
mkdir -p "$LOG_DIR"

SPRINT_ID="423"

CONVERGENCE="$FLAG_DIR/RUNTIME_CONVERGENCE_REPORT.json"
CAUSAL="$FLAG_DIR/RUNTIME_CAUSAL_INTEGRITY_REPORT.json"
DECISION="$FLAG_DIR/RUNTIME_EXECUTION_DECISION_REPORT.json"
WINDOW="$FLAG_DIR/RUNTIME_ENTRY_WINDOW_DYNAMICS_REPORT.json"

OUTPUT="$FLAG_DIR/RUNTIME_REGIME_VALIDATION_SIGNAL_INTEGRITY_REPORT.json"
LOG="$LOG_DIR/sprint-423-regime-validation.log"

echo "[SPRINT 423] RUNTIME REGIME VALIDATION ENGINE START" | tee "$LOG"
echo "[423] ROOT=$ROOT" | tee -a "$LOG"

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

echo "[423] LOADING MULTI-LAYER STATE..." | tee -a "$LOG"

# ----------------------------
# INPUTS
# ----------------------------

CONV=$(safe_get "$CONVERGENCE" '.convergence.score')
CAUSAL_SCORE=$(safe_get "$CAUSAL" '.analysis.causalScore')
DEC_SCORE=$(safe_get "$DECISION" '.decision.score')

WINDOW_STATE=$(safe_str "$WINDOW" "state")
WINDOW_ACTION=$(safe_str "$WINDOW" "action")

[[ -z "$CONV" ]] && CONV=0
[[ -z "$CAUSAL_SCORE" ]] && CAUSAL_SCORE=0
[[ -z "$DEC_SCORE" ]] && DEC_SCORE=0
[[ -z "$WINDOW_STATE" ]] && WINDOW_STATE="UNKNOWN"

echo "[423] ANALYZING REGIME CONSISTENCY..." | tee -a "$LOG"

# ----------------------------
# SIGNAL INTEGRITY MODEL
# ----------------------------

BASE_SIGNAL=$(( (CONV + CAUSAL_SCORE + DEC_SCORE) / 3 ))

# regime stability mapping
if [[ "$WINDOW_STATE" == "OPENING" ]]; then
  STABILITY=20
elif [[ "$WINDOW_STATE" == "STABLE" ]]; then
  STABILITY=10
elif [[ "$WINDOW_STATE" == "CLOSING" ]]; then
  STABILITY=-10
else
  STABILITY=-20
fi

# anomaly detection (signal vs structure mismatch)
if (( BASE_SIGNAL >= 75 && STABILITY < 0 )); then
  REGIME="FALSE_OPENING"
  INTEGRITY="LOW"
  ACTION="BLOCK_ENTRY"
elif (( BASE_SIGNAL >= 75 && STABILITY >= 10 )); then
  REGIME="CONFIRMED_OPENING"
  INTEGRITY="HIGH"
  ACTION="ALLOW_CANDIDATE"
elif (( BASE_SIGNAL >= 60 )); then
  REGIME="TRANSITION_ZONE"
  INTEGRITY="MEDIUM"
  ACTION="WAIT_CONFIRMATION"
else
  REGIME="NO_VALID_WINDOW"
  INTEGRITY="LOW"
  ACTION="NO_ENTRY"
fi

# risk model
if [[ "$INTEGRITY" == "HIGH" ]]; then
  RISK="LOW"
elif [[ "$INTEGRITY" == "MEDIUM" ]]; then
  RISK="MEDIUM"
else
  RISK="HIGH"
fi

echo "[423] COMPUTING REGIME VALIDATION..." | tee -a "$LOG"

# ----------------------------
# OUTPUT
# ----------------------------

cat > "$OUTPUT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "model": "RUNTIME_REGIME_VALIDATION_SIGNAL_INTEGRITY_ENGINE_V1",
  "inputs": {
    "convergence": $CONV,
    "causal": $CAUSAL_SCORE,
    "decisionScore": $DEC_SCORE,
    "windowState": "$WINDOW_STATE"
  },
  "validation": {
    "baseSignal": $BASE_SIGNAL,
    "stabilityScore": $STABILITY,
    "integrity": "$INTEGRITY"
  },
  "regime": {
    "state": "$REGIME",
    "risk": "$RISK"
  },
  "decision": {
    "action": "$ACTION"
  },
  "interpretation": {
    "meaning": "validates whether a perceived entry window is structurally real or false-positive",
    "principle": "prevents execution on deceptive alignment signals"
  }
}
EOF

echo "==============================" | tee -a "$LOG"
echo "[SPRINT 423 RESULT]" | tee -a "$LOG"
echo "REGIME: $REGIME" | tee -a "$LOG"
echo "INTEGRITY: $INTEGRITY" | tee -a "$LOG"
echo "ACTION: $ACTION" | tee -a "$LOG"
echo "OUTPUT: $OUTPUT" | tee -a "$LOG"
echo "==============================" | tee -a "$LOG"

echo "[SPRINT 423] COMPLETE" | tee -a "$LOG"
