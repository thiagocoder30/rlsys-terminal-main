#!/bin/bash

set -e

echo "[433] INSTITUTIONAL ENTRY TIMING PRECISION ENGINE STARTING..."

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

GATE_427="$ROOT_DIR/install/sprints/flags/RUNTIME_REGIME_VALIDATION_SIGNAL_INTEGRITY_REPORT.json"
QUAL_428="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_ENTRY_QUALIFICATION_REPORT.json"
DRIFT_430="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_DRIFT_STABILITY_REPORT.json"
META_431="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_META_CONSISTENCY_REPORT.json"
GOV_432="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_SELF_CORRECTION_REPORT.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_433_timing_precision_$(date +%Y%m%d_%H%M%S).log"

echo "[433] Loading institutional timing inputs..." | tee -a "$LOG_FILE"

# =========================
# VALIDATION
# =========================

for f in "$GATE_427" "$QUAL_428" "$DRIFT_430" "$META_431" "$GOV_432"
do
  if [ ! -f "$f" ]; then
    echo "[FAIL] Missing file: $f" | tee -a "$LOG_FILE"
    exit 1
  fi
done

# =========================
# LOAD SIGNALS
# =========================

COHERENCE=$(python3 - <<EOF
import json
d=json.load(open("$GATE_427"))
print(d.get("validation",{}).get("baseSignal",80))
EOF
)

ENTRY_SCORE=$(python3 - <<EOF
import json
d=json.load(open("$QUAL_428"))
print(d.get("entryScore",80))
EOF
)

DRIFT=$(python3 - <<EOF
import json
d=json.load(open("$DRIFT_430"))
print(d.get("driftScore",0))
EOF
)

CONSISTENCY=$(python3 - <<EOF
import json
d=json.load(open("$META_431"))
print(d.get("consistencyScore",100))
EOF
)

ARCH_DRIFT=$(python3 - <<EOF
import json
d=json.load(open("$GOV_432"))
print(d.get("architecturalDrift",0))
EOF
)

# =========================
# ENTRY TIMING ENGINE
# =========================

echo "[433] Calculating entry timing precision..." | tee -a "$LOG_FILE"

TIMING_SCORE=$(python3 - <<EOF
coherence = int("$COHERENCE")
entry = int("$ENTRY_SCORE")
drift = int("$DRIFT")
consistency = int("$CONSISTENCY")
arch = int("$ARCH_DRIFT")

score = 0

# base quality
score += entry * 0.35
score += coherence * 0.25

# stability contribution
score += consistency * 0.2

# penalties
score -= drift * 0.3
score -= arch * 0.2

print(max(0, min(int(score), 100)))
EOF
)

# =========================
# PHASE CLASSIFICATION
# =========================

PHASE=$(python3 - <<EOF
s = int("$TIMING_SCORE")

if s >= 75:
    print("OPTIMAL_ENTRY")
elif s >= 55:
    print("EARLY_ENTRY")
else:
    print("LATE_ENTRY")
EOF
)

# =========================
# OUTPUT REPORT
# =========================

REPORT="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_ENTRY_TIMING_REPORT.json"

cat > "$REPORT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "sprint": "433",
  "timingScore": $TIMING_SCORE,
  "phase": "$PHASE",
  "inputs": {
    "coherence": $COHERENCE,
    "entryScore": $ENTRY_SCORE,
    "drift": $DRIFT,
    "consistency": $CONSISTENCY,
    "architecturalDrift": $ARCH_DRIFT
  }
}
EOF

# =========================
# FINAL OUTPUT
# =========================

echo "[433] COMPLETED" | tee -a "$LOG_FILE"
echo "[433] TIMING SCORE: $TIMING_SCORE" | tee -a "$LOG_FILE"
echo "[433] PHASE: $PHASE" | tee -a "$LOG_FILE"
