#!/bin/bash

set -e

echo "[428] INSTITUTIONAL ENTRY QUALIFICATION ENGINE STARTING..."

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

GATE_FILE="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_MULTIREGIME_GATE.json"
STATE_FILE="$ROOT_DIR/install/sprints/flags/RL_SYS_PROJECT_STATE.json"
SNAPSHOT_FILE="$ROOT_DIR/install/sprints/flags/RUNTIME_SYSTEM_SNAPSHOT.json"
REGISTRY_FILE="$ROOT_DIR/install/sprints/flags/RUNTIME_CONVERGENCE_REPORT.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_428_institutional_entry_$(date +%Y%m%d_%H%M%S).log"

echo "[428] Loading institutional gate..." | tee -a "$LOG_FILE"

# =========================
# VALIDATION
# =========================

for f in "$GATE_FILE" "$STATE_FILE" "$SNAPSHOT_FILE" "$REGISTRY_FILE"
do
  if [ ! -f "$f" ]; then
    echo "[FAIL] Missing file: $f" | tee -a "$LOG_FILE"
    exit 1
  fi
done

echo "[428] Parsing multi-regime gate..." | tee -a "$LOG_FILE"

COHERENCE=$(python3 - <<EOF
import json
d=json.load(open("$GATE_FILE"))
print(d.get("coherenceScore",0))
EOF
)

CONVERGENCE=$(python3 - <<EOF
import json
d=json.load(open("$REGISTRY_FILE"))
print(d.get("convergence",{}).get("score",0))
EOF
)

REGIME=$(python3 - <<EOF
import json
d=json.load(open("$STATE_FILE"))
print(d.get("runtime",{}).get("regime","UNKNOWN"))
EOF
)

# =========================
# CONTEXT NORMALIZATION
# =========================

echo "[428] Normalizing institutional context..." | tee -a "$LOG_FILE"

CONTEXT_SCORE=$(python3 - <<EOF
score = 0

coherence = int("$COHERENCE")
convergence = int("$CONVERGENCE")

# base alignment
if coherence >= 85:
    score += 40
elif coherence >= 70:
    score += 25
else:
    score += 10

# convergence contribution
if convergence >= 80:
    score += 40
elif convergence >= 70:
    score += 25
else:
    score += 10

# regime bonus
if "$REGIME" == "CONFIRMED_OPENING":
    score += 15

print(min(score, 100))
EOF
)

# =========================
# RISK MODEL
# =========================

echo "[428] Calculating risk layer..." | tee -a "$LOG_FILE"

RISK_SCORE=$(python3 - <<EOF
import json

risk = 0

coherence = int("$COHERENCE")
convergence = int("$CONVERGENCE")

if coherence < 80:
    risk += 30

if convergence < 75:
    risk += 30

if "$REGIME" != "CONFIRMED_OPENING":
    risk += 25

print(min(risk, 100))
EOF
)

# =========================
# QUALIFICATION ENGINE
# =========================

echo "[428] Running qualification engine..." | tee -a "$LOG_FILE"

ENTRY_SCORE=$(python3 - <<EOF
cs = int("$CONTEXT_SCORE")
rs = int("$RISK_SCORE")

score = cs - rs

print(max(min(score,100),0))
EOF
)

# =========================
# CLASSIFICATION
# =========================

CLASSIFICATION=$(python3 - <<EOF
score = int("$ENTRY_SCORE")

if score >= 75:
    print("QUALIFIED")
elif score >= 50:
    print("HOLD")
else:
    print("REJECTED")
EOF
)

# =========================
# OUTPUT ARTIFACT
# =========================

OUTPUT="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_ENTRY_QUALIFICATION_REPORT.json"

cat > "$OUTPUT" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "sprint": "428",
  "contextScore": $CONTEXT_SCORE,
  "riskScore": $RISK_SCORE,
  "entryScore": $ENTRY_SCORE,
  "classification": "$CLASSIFICATION",
  "inputs": {
    "coherence": $COHERENCE,
    "convergence": $CONVERGENCE,
    "regime": "$REGIME"
  }
}
EOF

echo "[428] COMPLETED => $CLASSIFICATION (score=$ENTRY_SCORE)" | tee -a "$LOG_FILE"
