#!/bin/bash

set -e

echo "[432] INSTITUTIONAL SELF-CORRECTION GOVERNOR STARTING..."

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

GATE_427="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_MULTIREGIME_GATE.json"
QUAL_428="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_ENTRY_QUALIFICATION_REPORT.json"
ADAPT_429="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_ADAPTIVE_STATE.json"
DRIFT_430="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_DRIFT_STABILITY_REPORT.json"
META_431="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_META_CONSISTENCY_REPORT.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_432_governor_$(date +%Y%m%d_%H%M%S).log"

echo "[432] Loading institutional layers..." | tee -a "$LOG_FILE"

# =========================
# VALIDATION
# =========================

for f in "$GATE_427" "$QUAL_428" "$ADAPT_429" "$DRIFT_430" "$META_431"
do
  if [ ! -f "$f" ]; then
    echo "[FAIL] Missing file: $f" | tee -a "$LOG_FILE"
    exit 1
  fi
done

# =========================
# LOAD CORE SIGNALS
# =========================

COHERENCE=$(python3 - <<EOF
import json
d=json.load(open("$GATE_427"))
print(d.get("coherenceScore",0))
EOF
)

ENTRY_SCORE=$(python3 - <<EOF
import json
d=json.load(open("$QUAL_428"))
print(d.get("entryScore",0))
EOF
)

CLASSIFICATION=$(python3 - <<EOF
import json
d=json.load(open("$QUAL_428"))
print(d.get("classification","UNKNOWN"))
EOF
)

DELTA=$(python3 - <<EOF
import json
d=json.load(open("$ADAPT_429"))
print(d.get("lastDelta",0))
EOF
)

DRIFT=$(python3 - <<EOF
import json
d=json.load(open("$DRIFT_430"))
print(d.get("driftScore",0))
EOF
)

META_SCORE=$(python3 - <<EOF
import json
d=json.load(open("$META_431"))
print(d.get("consistencyScore",0))
EOF
)

# =========================
# ARCHITECTURAL DRIFT DETECTION
# =========================

echo "[432] Analyzing architectural drift..." | tee -a "$LOG_FILE"

ARCH_DRIFT=$(python3 - <<EOF
coherence = int("$COHERENCE")
entry = int("$ENTRY_SCORE")
meta = int("$META_SCORE")
drift = int("$DRIFT")
delta = int("$DELTA")

score = 0

# structural imbalance
if coherence < 75:
    score += 25

# weak qualification system
if entry < 70:
    score += 25

# unstable learning loop
if abs(delta) > 2:
    score += 20

# instability in drift layer
if drift > 50:
    score += 20

# meta inconsistency
if meta < 80:
    score += 15

print(min(score,100))
EOF
)

echo "[432] Architectural Drift Score = $ARCH_DRIFT" | tee -a "$LOG_FILE"

# =========================
# CORRECTION ENGINE
# =========================

echo "[432] Generating corrective actions..." | tee -a "$LOG_FILE"

CORRECTION_LEVEL=$(python3 - <<EOF
score = int("$ARCH_DRIFT")

if score >= 70:
    print("HARD_CORRECTION")
elif score >= 40:
    print("SOFT_CORRECTION")
else:
    print("NO_ACTION")
EOF
)

# =========================
# APPLY INSTITUTIONAL PATCHES
# =========================

PATCH_FILE="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_SELF_CORRECTION_PATCH.json"

python3 - <<EOF
import json

patch = {
    "generatedAt": "$(date -Iseconds)",
    "sprint": "432",
    "correctionLevel": "$CORRECTION_LEVEL",
    "architecturalDrift": int("$ARCH_DRIFT"),
    "recommendedActions": []
}

level = "$CORRECTION_LEVEL"

if level == "HARD_CORRECTION":
    patch["recommendedActions"] = [
        "increase_430_stability_lock",
        "reduce_429_adaptation_rate",
        "tighten_428_qualification_threshold"
    ]

elif level == "SOFT_CORRECTION":
    patch["recommendedActions"] = [
        "slightly_adjust_430_damping",
        "rebalance_429_delta_weight"
    ]

else:
    patch["recommendedActions"] = [
        "maintain_current_state"
    ]

json.dump(patch, open("$PATCH_FILE","w"), indent=2)

print("[432] Patch generated:", patch)
EOF

# =========================
# FINAL REPORT
# =========================

REPORT="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_SELF_CORRECTION_REPORT.json"

cat > "$REPORT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "sprint": "432",
  "architecturalDrift": $ARCH_DRIFT,
  "correctionLevel": "$CORRECTION_LEVEL",
  "systemHealth": "UNDER_GOVERNANCE"
}
EOF

echo "[432] COMPLETED" | tee -a "$LOG_FILE"
echo "[432] GOVERNOR ACTIVE" | tee -a "$LOG_FILE"
