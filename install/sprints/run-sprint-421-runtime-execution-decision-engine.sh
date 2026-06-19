#!/usr/bin/env bash

set -e

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAG_DIR="$ROOT/install/sprints/flags"
LOG_DIR="$ROOT/install/sprints/logs"

mkdir -p "$FLAG_DIR"
mkdir -p "$LOG_DIR"

SPRINT_ID="421"

LEDGER="$FLAG_DIR/RUNTIME_CONVERGENCE_REPORT.json"
CAUSAL="$FLAG_DIR/RUNTIME_CAUSAL_INTEGRITY_REPORT.json"

OUTPUT="$FLAG_DIR/RUNTIME_EXECUTION_DECISION_REPORT.json"
LOG="$LOG_DIR/sprint-421-runtime-execution-decision.log"

echo "[SPRINT 421] RUNTIME EXECUTION DECISION ENGINE START" | tee "$LOG"
echo "[421] ROOT=$ROOT" | tee -a "$LOG"

safe_get() {
  local file=$1
  local query=$2

  if command -v jq >/dev/null 2>&1; then
    jq -r "$query" "$file" 2>/dev/null || echo "0"
  else
    grep -oE '[0-9]+' "$file" | head -n 1
  fi
}

if [[ -f "$LEDGER" ]]; then
  CONVERGENCE=$(safe_get "$LEDGER" '.convergence.score')
else
  CONVERGENCE=0
fi

if [[ -f "$CAUSAL" ]]; then
  CAUSAL_SCORE=$(safe_get "$CAUSAL" '.analysis.causalScore')
else
  CAUSAL_SCORE=0
fi

FLOW_STATE=70
COOLDOWN_IMPACT=15
VOLATILITY=20

echo "[421] LOADING ARTIFACTS..." | tee -a "$LOG"

SCORE=$(( (CONVERGENCE + CAUSAL_SCORE + FLOW_STATE) / 3 ))
SCORE=$(( SCORE - (COOLDOWN_IMPACT / 2) ))
SCORE=$(( SCORE - (VOLATILITY / 5) ))

if (( SCORE >= 80 )); then
  STATE="QUALIFIED_ACTIVE"
  ACTION="ENTER NOW"
elif (( SCORE >= 60 )); then
  STATE="QUALIFIED_WAIT"
  ACTION="HOLD"
else
  STATE="QUALIFIED_INVALIDATED"
  ACTION="NO ENTRY"
fi

WINDOW=$(( SCORE / 10 ))
[[ $WINDOW -lt 1 ]] && WINDOW=0

echo "[421] ANALYZING EXECUTION DECISION..." | tee -a "$LOG"

cat > "$OUTPUT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "model": "RUNTIME_EXECUTION_DECISION_ENGINE_V1",
  "inputs": {
    "convergence": $CONVERGENCE,
    "causal": $CAUSAL_SCORE,
    "flow": $FLOW_STATE
  },
  "decision": {
    "score": $SCORE,
    "state": "$STATE",
    "action": "$ACTION",
    "executionWindowRounds": $WINDOW
  },
  "interpretation": {
    "meaning": "context-aware execution gating",
    "note": "separates strategy quality from timing decision"
  }
}
EOF

echo "==============================" | tee -a "$LOG"
echo "[SPRINT 421 RESULT]" | tee -a "$LOG"
echo "SCORE: $SCORE" | tee -a "$LOG"
echo "STATE: $STATE" | tee -a "$LOG"
echo "ACTION: $ACTION" | tee -a "$LOG"
echo "OUTPUT: $OUTPUT" | tee -a "$LOG"
echo "==============================" | tee -a "$LOG"

echo "[SPRINT 421] COMPLETE" | tee -a "$LOG"
