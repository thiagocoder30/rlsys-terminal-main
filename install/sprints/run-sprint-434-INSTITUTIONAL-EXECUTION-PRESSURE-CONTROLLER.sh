#!/bin/bash

set -e

echo "[434] INSTITUTIONAL EXECUTION PRESSURE CONTROLLER STARTING..."

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

QUAL_428="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_ENTRY_QUALIFICATION_REPORT.json"
DRIFT_430="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_DRIFT_STABILITY_REPORT.json"
META_431="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_META_CONSISTENCY_REPORT.json"
GOV_432="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_SELF_CORRECTION_REPORT.json"
TIMING_433="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_ENTRY_TIMING_REPORT.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_434_execution_pressure_$(date +%Y%m%d_%H%M%S).log"

echo "[434] Loading institutional execution inputs..." | tee -a "$LOG_FILE"

# =========================
# VALIDATION
# =========================

for f in "$QUAL_428" "$DRIFT_430" "$META_431" "$GOV_432" "$TIMING_433"
do
  if [ ! -f "$f" ]; then
    echo "[FAIL] Missing file: $f" | tee -a "$LOG_FILE"
    exit 1
  fi
done

# =========================
# LOAD SIGNALS
# =========================

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

TIMING=$(python3 - <<EOF
import json
d=json.load(open("$TIMING_433"))
print(d.get("timingScore",60))
EOF
)

PHASE=$(python3 - <<EOF
import json
d=json.load(open("$TIMING_433"))
print(d.get("phase","UNKNOWN"))
EOF
)

# =========================
# EXECUTION PRESSURE ENGINE
# =========================

echo "[434] Calculating execution pressure..." | tee -a "$LOG_FILE"

PRESSURE=$(python3 - <<EOF
entry = int("$ENTRY_SCORE")
drift = int("$DRIFT")
consistency = int("$CONSISTENCY")
arch = int("$ARCH_DRIFT")
timing = int("$TIMING")

pressure = 0

# base strength
pressure += entry * 0.3
pressure += timing * 0.3

# stability boost
pressure += consistency * 0.2

# risk penalties
pressure -= drift * 0.25
pressure -= arch * 0.2

# phase adjustment
if "$PHASE" == "OPTIMAL_ENTRY":
    pressure += 10
elif "$PHASE" == "EARLY_ENTRY":
    pressure -= 10
elif "$PHASE" == "LATE_ENTRY":
    pressure -= 25

print(max(0, min(int(pressure), 100)))
EOF
)

# =========================
# SIZING CLASSIFICATION
# =========================

SIZING=$(python3 - <<EOF
p = int("$PRESSURE")

if p >= 75:
    print("HIGH_PRESSURE_ENTRY")
elif p >= 50:
    print("MEDIUM_PRESSURE_ENTRY")
else:
    print("LOW_PRESSURE_ENTRY")
EOF
)

# =========================
# OUTPUT REPORT
# =========================

REPORT="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_EXECUTION_PRESSURE_REPORT.json"

cat > "$REPORT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "sprint": "434",
  "executionPressure": $PRESSURE,
  "sizing": "$SIZING",
  "inputs": {
    "entryScore": $ENTRY_SCORE,
    "drift": $DRIFT,
    "consistency": $CONSISTENCY,
    "architecturalDrift": $ARCH_DRIFT,
    "timingScore": $TIMING,
    "phase": "$PHASE"
  }
}
EOF

# =========================
# FINAL OUTPUT
# =========================

echo "[434] COMPLETED" | tee -a "$LOG_FILE"
echo "[434] EXECUTION PRESSURE: $PRESSURE" | tee -a "$LOG_FILE"
echo "[434] SIZING: $SIZING" | tee -a "$LOG_FILE"
