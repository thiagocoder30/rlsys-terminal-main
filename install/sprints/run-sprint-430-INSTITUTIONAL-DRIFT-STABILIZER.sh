#!/bin/bash

set -e

echo "[430] INSTITUTIONAL DRIFT STABILIZER STARTING..."

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

ADAPTIVE_STATE="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_ADAPTIVE_STATE.json"
FEEDBACK_TRACE="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_FEEDBACK_TRACE.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_430_drift_stabilizer_$(date +%Y%m%d_%H%M%S).log"

echo "[430] Loading adaptive system state..." | tee -a "$LOG_FILE"

# =========================
# VALIDATION
# =========================

if [ ! -f "$ADAPTIVE_STATE" ]; then
  echo "[FAIL] Missing adaptive state file" | tee -a "$LOG_FILE"
  exit 1
fi

if [ ! -f "$FEEDBACK_TRACE" ]; then
  echo "[FAIL] Missing feedback trace file" | tee -a "$LOG_FILE"
  exit 1
fi

# =========================
# LOAD STATE VALUES
# =========================

DELTA=$(python3 - <<EOF
import json
d=json.load(open("$FEEDBACK_TRACE"))
print(d.get("delta",0))
EOF
)

CONVERGENCE_THRESHOLD=$(python3 - <<EOF
import json
d=json.load(open("$ADAPTIVE_STATE"))
print(d.get("convergenceThreshold",70))
EOF
)

COHERENCE_WEIGHT=$(python3 - <<EOF
import json
d=json.load(open("$ADAPTIVE_STATE"))
print(d.get("coherenceWeight",25))
EOF
)

RISK_PENALTY=$(python3 - <<EOF
import json
d=json.load(open("$ADAPTIVE_STATE"))
print(d.get("riskPenalty",30))
EOF
)

# =========================
# DRIFT DETECTION ENGINE
# =========================

echo "[430] Calculating drift signals..." | tee -a "$LOG_FILE"

DRIFT_SCORE=$(python3 - <<EOF
delta = int("$DELTA")

threshold = int("$CONVERGENCE_THRESHOLD")
weight = int("$COHERENCE_WEIGHT")

drift = 0

# instability from oscillation
if abs(delta) > 1:
    drift += 30

# overly aggressive adaptation
if threshold < 68 or threshold > 78:
    drift += 25

# imbalance between weight and penalty
if weight > 35 and int("$RISK_PENALTY") < 25:
    drift += 20

print(min(drift,100))
EOF
)

echo "[430] Drift Score = $DRIFT_SCORE" | tee -a "$LOG_FILE"

# =========================
# STABILIZATION CORE
# =========================

echo "[430] Applying stabilization rules..." | tee -a "$LOG_FILE"

python3 - <<EOF
import json

path = "$ADAPTIVE_STATE"
state = json.load(open(path))

drift = int("$DRIFT_SCORE")

# -------------------------
# STABILIZATION LOGIC
# -------------------------

# High drift → freeze adaptation
if drift >= 60:
    state["convergenceThreshold"] = max(70, state["convergenceThreshold"])
    state["coherenceWeight"] = min(30, state["coherenceWeight"])
    state["stabilityMode"] = "LOCKED"

# Medium drift → dampen changes
elif drift >= 30:
    state["convergenceThreshold"] = int((state["convergenceThreshold"] + 70) / 2)
    state["coherenceWeight"] = int((state["coherenceWeight"] + 25) / 2)
    state["stabilityMode"] = "DAMPED"

# Low drift → allow mild adaptation
else:
    state["stabilityMode"] = "NORMAL"

state["lastDriftScore"] = drift

json.dump(state, open(path,"w"), indent=2)

print("[430] Updated adaptive state:", state)
EOF

# =========================
# SYSTEM STABILITY REPORT
# =========================

REPORT="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_DRIFT_STABILITY_REPORT.json"

cat > "$REPORT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "sprint": "430",
  "driftScore": $DRIFT_SCORE,
  "stabilityMode": "$(python3 -c "import json; print(json.load(open('$ADAPTIVE_STATE')).get('stabilityMode','UNKNOWN'))")",
  "threshold": $CONVERGENCE_THRESHOLD
}
EOF

# =========================
# FINAL OUTPUT
# =========================

echo "[430] COMPLETED" | tee -a "$LOG_FILE"
echo "[430] SYSTEM STABILITY ENFORCED" | tee -a "$LOG_FILE"
