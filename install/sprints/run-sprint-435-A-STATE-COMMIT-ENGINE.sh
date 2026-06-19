#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

echo "[435-A] STATE COMMIT ENGINE STARTING..."

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT_DIR/install/sprints/flags"

RUNTIME_STATE="$FLAGS_DIR/RL_SYS_RUNTIME_STATE.json"

DOWNLOAD_DIR="/sdcard/Download/RL_SYS"
LOG_DIR="$DOWNLOAD_DIR/logs"

mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_435A_state_commit_$(date +%Y%m%d_%H%M%S).log"

echo "[435-A] ROOT_DIR=$ROOT_DIR" | tee -a "$LOG_FILE"

# ============================================================
# Helpers
# ============================================================

read_json_value() {
  local file="$1"
  local expr="$2"

  python3 - <<PY
import json

try:
    with open("$file","r",encoding="utf-8") as f:
        data=json.load(f)

    value=$expr

    if value is None:
        print("")
    else:
        print(value)

except Exception:
    print("")
PY
}

safe_file() {
  local f="$1"

  if [ ! -f "$f" ]; then
    echo ""
  else
    echo "$f"
  fi
}

# ============================================================
# Source files
# ============================================================

PROJECT_STATE=$(safe_file "$FLAGS_DIR/RL_SYS_PROJECT_STATE.json")
SNAPSHOT=$(safe_file "$FLAGS_DIR/RUNTIME_SYSTEM_SNAPSHOT.json")

QUAL_428=$(safe_file "$FLAGS_DIR/INSTITUTIONAL_ENTRY_QUALIFICATION_REPORT.json")
DRIFT_430=$(safe_file "$FLAGS_DIR/INSTITUTIONAL_DRIFT_STABILITY_REPORT.json")
META_431=$(safe_file "$FLAGS_DIR/INSTITUTIONAL_META_CONSISTENCY_REPORT.json")
GOV_432=$(safe_file "$FLAGS_DIR/INSTITUTIONAL_SELF_CORRECTION_REPORT.json")
TIMING_433=$(safe_file "$FLAGS_DIR/INSTITUTIONAL_ENTRY_TIMING_REPORT.json")
PRESSURE_434=$(safe_file "$FLAGS_DIR/INSTITUTIONAL_EXECUTION_PRESSURE_REPORT.json")

# ============================================================
# Snapshot values
# ============================================================

CURRENT_SPRINT="434"

if [ -n "$PROJECT_STATE" ]; then
  TMP=$(read_json_value "$PROJECT_STATE" 'data.get("currentSprint","434")')
  [ -n "$TMP" ] && CURRENT_SPRINT="$TMP"
fi

CONVERGENCE="0"
DECISION_SCORE="0"
WINDOW_CONFIDENCE="0"
REGIME_STATE="UNKNOWN"

if [ -n "$SNAPSHOT" ]; then

  TMP=$(read_json_value "$SNAPSHOT" \
'data.get("convergence",{}).get("convergence",{}).get("score",0)')
  [ -n "$TMP" ] && CONVERGENCE="$TMP"

  TMP=$(read_json_value "$SNAPSHOT" \
'data.get("decision",{}).get("decision",{}).get("score",0)')
  [ -n "$TMP" ] && DECISION_SCORE="$TMP"

  TMP=$(read_json_value "$SNAPSHOT" \
'data.get("window",{}).get("window",{}).get("confidence",0)')
  [ -n "$TMP" ] && WINDOW_CONFIDENCE="$TMP"

  TMP=$(read_json_value "$SNAPSHOT" \
'data.get("regime",{}).get("regime",{}).get("state","UNKNOWN")')
  [ -n "$TMP" ] && REGIME_STATE="$TMP"
fi

# ============================================================
# 428
# ============================================================

QUALIFICATION="UNKNOWN"
ENTRY_SCORE="0"

if [ -n "$QUAL_428" ]; then

  TMP=$(read_json_value "$QUAL_428" \
'data.get("qualification","UNKNOWN")')
  [ -n "$TMP" ] && QUALIFICATION="$TMP"

  TMP=$(read_json_value "$QUAL_428" \
'data.get("entryScore",0)')
  [ -n "$TMP" ] && ENTRY_SCORE="$TMP"
fi

# ============================================================
# 430
# ============================================================

DRIFT_SCORE="0"

if [ -n "$DRIFT_430" ]; then
  TMP=$(read_json_value "$DRIFT_430" \
'data.get("driftScore",0)')
  [ -n "$TMP" ] && DRIFT_SCORE="$TMP"
fi

# ============================================================
# 431
# ============================================================

CONSISTENCY_SCORE="0"

if [ -n "$META_431" ]; then
  TMP=$(read_json_value "$META_431" \
'data.get("consistencyScore",0)')
  [ -n "$TMP" ] && CONSISTENCY_SCORE="$TMP"
fi

# ============================================================
# 432
# ============================================================

ARCH_DRIFT="0"

if [ -n "$GOV_432" ]; then
  TMP=$(read_json_value "$GOV_432" \
'data.get("architecturalDrift",0)')
  [ -n "$TMP" ] && ARCH_DRIFT="$TMP"
fi

# ============================================================
# 433
# ============================================================

TIMING_SCORE="0"
TIMING_PHASE="UNKNOWN"

if [ -n "$TIMING_433" ]; then

  TMP=$(read_json_value "$TIMING_433" \
'data.get("timingScore",0)')
  [ -n "$TMP" ] && TIMING_SCORE="$TMP"

  TMP=$(read_json_value "$TIMING_433" \
'data.get("phase","UNKNOWN")')
  [ -n "$TMP" ] && TIMING_PHASE="$TMP"
fi

# ============================================================
# 434
# ============================================================

EXECUTION_PRESSURE="0"
EXECUTION_SIZING="UNKNOWN"

if [ -n "$PRESSURE_434" ]; then

  TMP=$(read_json_value "$PRESSURE_434" \
'data.get("executionPressure",0)')
  [ -n "$TMP" ] && EXECUTION_PRESSURE="$TMP"

  TMP=$(read_json_value "$PRESSURE_434" \
'data.get("sizing","UNKNOWN")')
  [ -n "$TMP" ] && EXECUTION_SIZING="$TMP"
fi

# ============================================================
# Commit ID
# ============================================================

COMMIT_ID="$(date +%Y%m%d%H%M%S)"

# ============================================================
# Runtime State
# ============================================================

cat > "$RUNTIME_STATE" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "commitId":"$COMMIT_ID",
  "engine":"STATE_COMMIT_ENGINE_V1",

  "latestSprint":"$CURRENT_SPRINT",

  "systemHealth":"GREEN",

  "runtime":{
    "convergence":$CONVERGENCE,
    "decisionScore":$DECISION_SCORE,
    "windowConfidence":$WINDOW_CONFIDENCE,
    "regime":"$REGIME_STATE"
  },

  "qualification":{
    "status":"$QUALIFICATION",
    "entryScore":$ENTRY_SCORE
  },

  "timing":{
    "phase":"$TIMING_PHASE",
    "score":$TIMING_SCORE
  },

  "execution":{
    "pressure":$EXECUTION_PRESSURE,
    "sizing":"$EXECUTION_SIZING"
  },

  "governance":{
    "consistencyScore":$CONSISTENCY_SCORE,
    "architecturalDrift":$ARCH_DRIFT
  }
}
EOF

cp "$RUNTIME_STATE" \
"$DOWNLOAD_DIR/RL_SYS_RUNTIME_STATE.json"

echo "[435-A] COMMIT CREATED" | tee -a "$LOG_FILE"
echo "[435-A] COMMIT ID: $COMMIT_ID" | tee -a "$LOG_FILE"
echo "[435-A] OUTPUT: $RUNTIME_STATE" | tee -a "$LOG_FILE"

git add "$RUNTIME_STATE" 2>/dev/null || true

echo "[435-A] COMPLETED" | tee -a "$LOG_FILE"
