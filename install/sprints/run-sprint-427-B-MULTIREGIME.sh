#!/bin/bash

set -e

echo "[427-B-MR] MULTI-REGIME INSTITUTIONAL PREFLIGHT STARTING..."

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

STATE_FILE="$ROOT_DIR/install/sprints/flags/RL_SYS_PROJECT_STATE.json"
SNAPSHOT_FILE="$ROOT_DIR/install/sprints/flags/RUNTIME_SYSTEM_SNAPSHOT.json"
REGISTRY_FILE="$ROOT_DIR/install/sprints/flags/RUNTIME_CONVERGENCE_REPORT.json"
DECISION_FILE="$ROOT_DIR/install/sprints/flags/RUNTIME_EXECUTION_DECISION_REPORT.json"
WINDOW_FILE="$ROOT_DIR/install/sprints/flags/RUNTIME_ENTRY_WINDOW_DYNAMICS_REPORT.json"
DECAY_FILE="$ROOT_DIR/install/sprints/flags/RUNTIME_EXECUTION_DECAY_TIMING_REPORT.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_427B_multiregime_$(date +%Y%m%d_%H%M%S).log"

echo "[427-B-MR] Starting multi-regime validation..." | tee -a "$LOG_FILE"

# =========================
# FILE VALIDATION LAYER
# =========================

validate_file() {
  if [ ! -f "$1" ]; then
    echo "[FAIL] Missing: $1" | tee -a "$LOG_FILE"
    exit 1
  fi
  echo "[OK] Found: $1" | tee -a "$LOG_FILE"
}

validate_json() {
python3 - <<EOF
import json, sys
try:
    json.load(open("$1"))
    print("[OK] JSON:", "$1")
except Exception as e:
    print("[FAIL] JSON:", "$1", str(e))
    sys.exit(1)
EOF
}

for f in "$SNAPSHOT_FILE" "$STATE_FILE" "$REGISTRY_FILE" "$DECISION_FILE" "$WINDOW_FILE" "$DECAY_FILE"
do
  validate_file "$f"
  validate_json "$f"
done

# =========================
# REGIME EXTRACTION ENGINE
# =========================

echo "[427-B-MR] Extracting regime states..." | tee -a "$LOG_FILE"

CONVERGENCE=$(python3 - <<EOF
import json
d=json.load(open("$REGISTRY_FILE"))
print(d.get("convergence",{}).get("score",0))
EOF
)

DECISION_STATE=$(python3 - <<EOF
import json
d=json.load(open("$DECISION_FILE"))
print(d.get("decision",{}).get("state","UNKNOWN"))
EOF
)

WINDOW_STATE=$(python3 - <<EOF
import json
d=json.load(open("$WINDOW_FILE"))
print(d.get("window",{}).get("state","UNKNOWN"))
EOF
)

DECAY_CLASS=$(python3 - <<EOF
import json
d=json.load(open("$DECAY_FILE"))
print(d.get("timing",{}).get("classification","UNKNOWN"))
EOF
)

# =========================
# MULTI-REGIME LOGIC CORE
# =========================

echo "[427-B-MR] Evaluating regime coherence..." | tee -a "$LOG_FILE"

COHERENCE_SCORE=0

# Convergence regime
if [ "$CONVERGENCE" -ge 70 ]; then
  COHERENCE_SCORE=$((COHERENCE_SCORE + 25))
fi

# Decision regime coherence
if [ "$DECISION_STATE" = "QUALIFIED_WAIT" ] || [ "$DECISION_STATE" = "HOLD" ]; then
  COHERENCE_SCORE=$((COHERENCE_SCORE + 25))
fi

# Window regime coherence
if [ "$WINDOW_STATE" = "OPENING" ] || [ "$WINDOW_STATE" = "STABLE" ]; then
  COHERENCE_SCORE=$((COHERENCE_SCORE + 25))
fi

# Decay regime check
if [ "$DECAY_CLASS" = "INVALID_ENTRY_WINDOW" ] || [ "$DECAY_CLASS" = "NO_ENTRY" ]; then
  COHERENCE_SCORE=$((COHERENCE_SCORE + 15))
fi

echo "[427-B-MR] Coherence Score: $COHERENCE_SCORE" | tee -a "$LOG_FILE"

# =========================
# CROSS-REGIME VALIDATION
# =========================

echo "[427-B-MR] Checking cross-regime contradictions..." | tee -a "$LOG_FILE"

if [ "$CONVERGENCE" -ge 80 ] && [ "$DECAY_CLASS" = "INVALID_ENTRY_WINDOW" ]; then
  echo "[BLOCK] Hard contradiction: high convergence but invalid decay state" | tee -a "$LOG_FILE"
  exit 1
fi

if [ "$WINDOW_STATE" = "OPENING" ] && [ "$DECISION_STATE" = "BLOCK" ]; then
  echo "[BLOCK] Window opening but execution blocked (structural mismatch)" | tee -a "$LOG_FILE"
  exit 1
fi

# =========================
# FINAL MULTI-REGIME GATE
# =========================

echo "[427-B-MR] Final evaluation..." | tee -a "$LOG_FILE"

if [ "$COHERENCE_SCORE" -ge 80 ]; then
  STATUS="PASSED"
  NEXT="428"
else
  STATUS="FAILED"
  NEXT="HOLD"
fi

GATE_FILE="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_MULTIREGIME_GATE.json"

cat > "$GATE_FILE" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "sprint": "427-B-MR",
  "status": "$STATUS",
  "next": "$NEXT",
  "coherenceScore": $COHERENCE_SCORE,
  "regimes": {
    "convergence": $CONVERGENCE,
    "decision": "$DECISION_STATE",
    "window": "$WINDOW_STATE",
    "decay": "$DECAY_CLASS"
  }
}
EOF

echo "[427-B-MR] COMPLETED: $STATUS" | tee -a "$LOG_FILE"
