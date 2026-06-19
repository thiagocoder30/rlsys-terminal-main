#!/bin/bash

set -e

echo "[431] INSTITUTIONAL META-CONSISTENCY AUDITOR STARTING..."

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

ADAPTIVE_STATE="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_ADAPTIVE_STATE.json"
FEEDBACK_TRACE="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_FEEDBACK_TRACE.json"
DRIFT_REPORT="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_DRIFT_STABILITY_REPORT.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_431_meta_audit_$(date +%Y%m%d_%H%M%S).log"

echo "[431] Loading historical institutional signals..." | tee -a "$LOG_FILE"

# =========================
# VALIDATION
# =========================

for f in "$ADAPTIVE_STATE" "$FEEDBACK_TRACE" "$DRIFT_REPORT"
do
  if [ ! -f "$f" ]; then
    echo "[FAIL] Missing file: $f" | tee -a "$LOG_FILE"
    exit 1
  fi
done

# =========================
# LOAD HISTORICAL SIGNALS
# =========================

LAST_DELTA=$(python3 - <<EOF
import json
d=json.load(open("$FEEDBACK_TRACE"))
print(d.get("delta",0))
EOF
)

DRIFT_SCORE=$(python3 - <<EOF
import json
d=json.load(open("$DRIFT_REPORT"))
print(d.get("driftScore",0))
EOF
)

STABILITY_MODE=$(python3 - <<EOF
import json
d=json.load(open("$ADAPTIVE_STATE"))
print(d.get("stabilityMode","UNKNOWN"))
EOF
)

THRESHOLD=$(python3 - <<EOF
import json
d=json.load(open("$ADAPTIVE_STATE"))
print(d.get("convergenceThreshold",70))
EOF
)

# =========================
# TRAJECTORY ANALYSIS
# =========================

echo "[431] Analyzing system trajectory..." | tee -a "$LOG_FILE"

CONSISTENCY_SCORE=$(python3 - <<EOF
drift = int("$DRIFT_SCORE")
delta = int("$LAST_DELTA")

score = 100

# penalize drift
score -= drift * 0.5

# penalize instability in learning loop
if abs(delta) > 1:
    score -= 15

# stability mode bonuses/penalties
mode = "$STABILITY_MODE"

if mode == "LOCKED":
    score -= 10
elif mode == "DAMPED":
    score += 5
elif mode == "NORMAL":
    score += 10

print(max(min(int(score),100),0))
EOF
)

# =========================
# META REGIME CLASSIFICATION
# =========================

META_REGIME=$(python3 - <<EOF
score = int("$CONSISTENCY_SCORE")

if score >= 80:
    print("HEALTHY")
elif score >= 60:
    print("STABLE_WITH_RISK")
else:
    print("DEGRADING")
EOF
)

# =========================
# AUDIT REPORT OUTPUT
# =========================

REPORT="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_META_CONSISTENCY_REPORT.json"

cat > "$REPORT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "sprint": "431",
  "consistencyScore": $CONSISTENCY_SCORE,
  "metaRegime": "$META_REGIME",
  "inputs": {
    "driftScore": $DRIFT_SCORE,
    "lastDelta": $LAST_DELTA,
    "stabilityMode": "$STABILITY_MODE",
    "threshold": $THRESHOLD
  }
}
EOF

# =========================
# FINAL OUTPUT
# =========================

echo "[431] COMPLETED" | tee -a "$LOG_FILE"
echo "[431] META REGIME: $META_REGIME" | tee -a "$LOG_FILE"
echo "[431] CONSISTENCY SCORE: $CONSISTENCY_SCORE" | tee -a "$LOG_FILE"
