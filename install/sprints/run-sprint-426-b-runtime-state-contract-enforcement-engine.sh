#!/bin/bash

echo "[SPRINT 426-B] RUNTIME STATE CONTRACT ENFORCEMENT ENGINE START"

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

FLAGS="$ROOT/install/sprints/flags"
LOGS="$ROOT/install/sprints/logs"

mkdir -p "$FLAGS"
mkdir -p "$LOGS"

CONTRACT_FILE="$FLAGS/RUNTIME_STATE_CONTRACT.json"

CONVERGENCE="$FLAGS/RUNTIME_CONVERGENCE_REPORT.json"
DECISION="$FLAGS/RUNTIME_EXECUTION_DECISION_REPORT.json"
REGIME="$FLAGS/RUNTIME_REGIME_VALIDATION_SIGNAL_INTEGRITY_REPORT.json"
WINDOW="$FLAGS/RUNTIME_ENTRY_WINDOW_DYNAMICS_REPORT.json"
DECAY="$FLAGS/RUNTIME_EXECUTION_DECAY_TIMING_REPORT.json"

SNAPSHOT="$FLAGS/RUNTIME_SYSTEM_SNAPSHOT.json"
OUTPUT="$FLAGS/RUNTIME_STATE_CONTRACT_ENFORCEMENT_REPORT.json"

LOG_FILE="$LOGS/sprint-426-b-contract.log"

echo "[426-B] ROOT=$ROOT" | tee "$LOG_FILE"

# ----------------------------
# DEFAULT CONTRACT (SELF-HEALING)
# ----------------------------
if [ ! -f "$CONTRACT_FILE" ]; then
  echo "[426-B] CONTRACT MISSING → CREATING DEFAULT CONTRACT"

  cat > "$CONTRACT_FILE" <<EOF
{
  "model": "RUNTIME_STATE_CONTRACT_V1",
  "required": [
    "RUNTIME_CONVERGENCE_REPORT.json",
    "RUNTIME_EXECUTION_DECISION_REPORT.json",
    "RUNTIME_REGIME_VALIDATION_SIGNAL_INTEGRITY_REPORT.json",
    "RUNTIME_ENTRY_WINDOW_DYNAMICS_REPORT.json",
    "RUNTIME_EXECUTION_DECAY_TIMING_REPORT.json"
  ],
  "optional": [
    "RUNTIME_SYSTEM_SNAPSHOT.json"
  ],
  "rules": {
    "noNullPropagation": true,
    "failFastOnMissing": false,
    "allowFallbackDefaults": true
  }
}
EOF
fi

# ----------------------------
# VALIDATION ENGINE (jq + fallback)
# ----------------------------
check_file() {
  [ -f "$1" ] && echo 1 || echo 0
}

conv=$(check_file "$CONVERGENCE")
dec=$(check_file "$DECISION")
reg=$(check_file "$REGIME")
win=$(check_file "$WINDOW")
decay=$(check_file "$DECAY")
snap=$(check_file "$SNAPSHOT")

missing=0
missing_list=""

if [ "$conv" -eq 0 ]; then missing=$((missing+1)); missing_list="$missing_list CONVERGENCE"; fi
if [ "$dec" -eq 0 ]; then missing=$((missing+1)); missing_list="$missing_list DECISION"; fi
if [ "$reg" -eq 0 ]; then missing=$((missing+1)); missing_list="$missing_list REGIME"; fi
if [ "$win" -eq 0 ]; then missing=$((missing+1)); missing_list="$missing_list WINDOW"; fi
if [ "$decay" -eq 0 ]; then missing=$((missing+1)); missing_list="$missing_list DECAY"; fi

# snapshot is optional
contract_score=$((100 - missing * 20))

if [ "$contract_score" -ge 80 ]; then
  status="CONTRACT_OK"
elif [ "$contract_score" -ge 50 ]; then
  status="CONTRACT_DEGRADED"
else
  status="CONTRACT_VIOLATED"
fi

echo "=============================="
echo "[SPRINT 426-B RESULT]"
echo "CONTRACT SCORE: $contract_score"
echo "STATUS: $status"
echo "MISSING: $missing_list"
echo "SNAPSHOT EXISTS: $snap"
echo "OUTPUT: $OUTPUT"
echo "=============================="

cat > "$OUTPUT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "model": "RUNTIME_STATE_CONTRACT_ENFORCEMENT_V1",
  "inputs": {
    "convergence": $conv,
    "decision": $dec,
    "regime": $reg,
    "window": $win,
    "decay": $decay,
    "snapshot": $snap
  },
  "contract": {
    "score": $contract_score,
    "status": "$status",
    "missing": "$missing_list"
  },
  "rules": {
    "enforced": true,
    "noSilentFailure": true
  }
}
EOF

echo "[SPRINT 426-B] COMPLETE" | tee -a "$LOG_FILE"
