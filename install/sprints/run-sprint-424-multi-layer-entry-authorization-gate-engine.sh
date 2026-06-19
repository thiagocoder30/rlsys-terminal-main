#!/usr/bin/env bash

set -e

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAG_DIR="$ROOT/install/sprints/flags"
LOG_DIR="$ROOT/install/sprints/logs"

mkdir -p "$FLAG_DIR"
mkdir -p "$LOG_DIR"

SPRINT_ID="424"

# Inputs from previous layers
CONVERGENCE="$FLAG_DIR/RUNTIME_CONVERGENCE_REPORT.json"
CAUSAL="$FLAG_DIR/RUNTIME_CAUSAL_INTEGRITY_REPORT.json"
DECISION="$FLAG_DIR/RUNTIME_EXECUTION_DECISION_REPORT.json"
WINDOW="$FLAG_DIR/RUNTIME_ENTRY_WINDOW_DYNAMICS_REPORT.json"
REGIME="$FLAG_DIR/RUNTIME_REGIME_SHIFT_DETECTOR_REPORT.json"

OUTPUT="$FLAG_DIR/RUNTIME_ENTRY_AUTHORIZATION_GATE_REPORT.json"
LOG="$LOG_DIR/sprint-424-entry-authorization-gate.log"

echo "[SPRINT 424] MULTI-LAYER ENTRY AUTHORIZATION GATE START" | tee "$LOG"
echo "[424] ROOT=$ROOT" | tee -a "$LOG"

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

echo "[424] LOADING MULTI-LAYER SIGNALS..." | tee -a "$LOG"

# ----------------------------
# INPUTS
# ----------------------------

CONV=$(safe_get "$CONVERGENCE" '.convergence.score')
CAUSAL_SCORE=$(safe_get "$CAUSAL" '.analysis.causalScore')
DEC_SCORE=$(safe_get "$DECISION" '.decision.score')

WINDOW_STATE=$(safe_str "$WINDOW" "state")
WINDOW_ACTION=$(safe_str "$WINDOW" "action")

REGIME_STATE=$(safe_str "$REGIME" "state")
REGIME_RISK=$(safe_str "$REGIME" "risk")

[[ -z "$CONV" ]] && CONV=0
[[ -z "$CAUSAL_SCORE" ]] && CAUSAL_SCORE=0
[[ -z "$DEC_SCORE" ]] && DEC_SCORE=0
[[ -z "$WINDOW_STATE" ]] && WINDOW_STATE="UNKNOWN"
[[ -z "$REGIME_STATE" ]] && REGIME_STATE="UNKNOWN"
[[ -z "$REGIME_RISK" ]] && REGIME_RISK="HIGH"

echo "[424] EVALUATING ENTRY CONSENSUS..." | tee -a "$LOG"

# ----------------------------
# CORE AUTHORIZATION ENGINE
# ----------------------------

BASE_SCORE=$(( (CONV + CAUSAL_SCORE + DEC_SCORE) / 3 ))

# Window modifier
if [[ "$WINDOW_STATE" == "OPENING" ]]; then
  WINDOW_BIAS=15
elif [[ "$WINDOW_STATE" == "STABLE" ]]; then
  WINDOW_BIAS=5
else
  WINDOW_BIAS=-20
fi

# Regime modifier
if [[ "$REGIME_STATE" == "CONFIRMED_WINDOW" ]]; then
  REGIME_BIAS=20
elif [[ "$REGIME_STATE" == "UNCERTAIN" ]]; then
  REGIME_BIAS=-10
elif [[ "$REGIME_STATE" == "FALSE_WINDOW" ]]; then
  REGIME_BIAS=-40
else
  REGIME_BIAS=-15
fi

# Risk modifier
if [[ "$REGIME_RISK" == "LOW" ]]; then
  RISK_BIAS=10
elif [[ "$REGIME_RISK" == "MEDIUM" ]]; then
  RISK_BIAS=0
else
  RISK_BIAS=-25
fi

AUTH_SCORE=$(( BASE_SCORE + WINDOW_BIAS + REGIME_BIAS + RISK_BIAS ))

# ----------------------------
# FINAL GATE DECISION
# ----------------------------

if (( AUTH_SCORE >= 85 )); then
  DECISION_FINAL="ENTER"
  GATE_STATE="OPEN"
elif (( AUTH_SCORE >= 70 )); then
  DECISION_FINAL="WAIT_CONFIRMATION"
  GATE_STATE="PARTIAL"
else
  DECISION_FINAL="BLOCK"
  GATE_STATE="CLOSED"
fi

# confidence model
CONFIDENCE=$(( AUTH_SCORE > 100 ? 100 : AUTH_SCORE ))
[[ $CONFIDENCE -lt 0 ]] && CONFIDENCE=0

echo "[424] COMPUTING FINAL AUTHORIZATION..." | tee -a "$LOG"

# ----------------------------
# OUTPUT
# ----------------------------

cat > "$OUTPUT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "model": "MULTI_LAYER_ENTRY_AUTHORIZATION_GATE_V1",
  "inputs": {
    "convergence": $CONV,
    "causal": $CAUSAL_SCORE,
    "decisionScore": $DEC_SCORE,
    "windowState": "$WINDOW_STATE",
    "regimeState": "$REGIME_STATE",
    "regimeRisk": "$REGIME_RISK"
  },
  "scoring": {
    "baseScore": $BASE_SCORE,
    "authScore": $AUTH_SCORE,
    "confidence": $CONFIDENCE
  },
  "gate": {
    "state": "$GATE_STATE",
    "decision": "$DECISION_FINAL"
  },
  "interpretation": {
    "meaning": "final institutional authorization layer for execution entry",
    "principle": "only allows entry when convergence, timing, and regime align"
  }
}
EOF

echo "==============================" | tee -a "$LOG"
echo "[SPRINT 424 RESULT]" | tee -a "$LOG"
echo "AUTH SCORE: $AUTH_SCORE" | tee -a "$LOG"
echo "GATE STATE: $GATE_STATE" | tee -a "$LOG"
echo "DECISION: $DECISION_FINAL" | tee -a "$LOG"
echo "OUTPUT: $OUTPUT" | tee -a "$LOG"
echo "==============================" | tee -a "$LOG"

echo "[SPRINT 424] COMPLETE" | tee -a "$LOG"
