#!/bin/bash

set -e

echo "[429] INSTITUTIONAL FEEDBACK LOOP INITIALIZING..."

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

GATE_FILE="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_MULTIREGIME_GATE.json"
QUAL_FILE="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_ENTRY_QUALIFICATION_REPORT.json"
STATE_FILE="$ROOT_DIR/install/sprints/flags/RL_SYS_PROJECT_STATE.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_429_feedback_loop_$(date +%Y%m%d_%H%M%S).log"

echo "[429] Loading institutional outcomes..." | tee -a "$LOG_FILE"

# =========================
# LOAD QUALIFICATION RESULT
# =========================

CLASSIFICATION=$(python3 - <<EOF
import json
d=json.load(open("$QUAL_FILE"))
print(d.get("classification","UNKNOWN"))
EOF
)

ENTRY_SCORE=$(python3 - <<EOF
import json
d=json.load(open("$QUAL_FILE"))
print(d.get("entryScore",0))
EOF
)

COHERENCE=$(python3 - <<EOF
import json
d=json.load(open("$GATE_FILE"))
print(d.get("coherenceScore",0))
EOF
)

# =========================
# FEEDBACK ACCUMULATION MODEL
# =========================

echo "[429] Calculating feedback deltas..." | tee -a "$LOG_FILE"

DELTA_MODEL=$(python3 - <<EOF
classification = "$CLASSIFICATION"
score = int("$ENTRY_SCORE")
coherence = int("$COHERENCE")

delta = 0

# positive reinforcement
if classification == "QUALIFIED" and score >= 75:
    delta += 1

# negative reinforcement
if classification == "REJECTED" and coherence >= 80:
    delta -= 2

# unstable decision penalty
if classification == "HOLD":
    delta -= 1

print(delta)
EOF
)

# =========================
# ADAPTIVE THRESHOLD ENGINE
# =========================

echo "[429] Adjusting institutional thresholds..." | tee -a "$LOG_FILE"

UPDATED_STATE="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_ADAPTIVE_STATE.json"

python3 - <<EOF
import json, os

path = "$UPDATED_STATE"

state = {}
if os.path.exists(path):
    state = json.load(open(path))

state.setdefault("convergenceThreshold", 70)
state.setdefault("coherenceWeight", 25)
state.setdefault("riskPenalty", 30)

delta = int("$DELTA_MODEL")

# adaptive rules
if delta > 0:
    state["convergenceThreshold"] = max(65, state["convergenceThreshold"] - 1)
    state["coherenceWeight"] = min(40, state["coherenceWeight"] + 1)

if delta < 0:
    state["convergenceThreshold"] = min(80, state["convergenceThreshold"] + 1)
    state["riskPenalty"] = min(50, state["riskPenalty"] + 2)

state["lastDelta"] = delta

json.dump(state, open(path,"w"), indent=2)

print("[429] Adaptive state updated:", state)
EOF

# =========================
# FEEDBACK TRACE LOG
# =========================

TRACE_FILE="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_FEEDBACK_TRACE.json"

cat > "$TRACE_FILE" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "sprint": "429",
  "classification": "$CLASSIFICATION",
  "entryScore": $ENTRY_SCORE,
  "coherence": $COHERENCE,
  "delta": $DELTA_MODEL
}
EOF

# =========================
# FINAL REPORT
# =========================

echo "[429] FEEDBACK LOOP COMPLETED" | tee -a "$LOG_FILE"
echo "[429] SYSTEM IS NOW ADAPTIVE (CLOSED LOOP ENABLED)" | tee -a "$LOG_FILE"
