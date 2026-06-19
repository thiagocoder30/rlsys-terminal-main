#!/bin/bash

set -e

echo "[427-B] INSTITUTIONAL PREFLIGHT GATE STARTING..."

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

STATE_FILE="$ROOT_DIR/install/sprints/flags/RL_SYS_PROJECT_STATE.json"
SNAPSHOT_FILE="$ROOT_DIR/install/sprints/flags/RUNTIME_SYSTEM_SNAPSHOT.json"
REGISTRY_FILE="$ROOT_DIR/install/sprints/flags/RUNTIME_CONVERGENCE_REPORT.json"

LOG_DIR="/sdcard/Download/RL_SYS/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sprint_427B_preflight_$(date +%Y%m%d_%H%M%S).log"

echo "[427-B] Validating system prerequisites..." | tee -a "$LOG_FILE"

# =========================
# VALIDATION FUNCTIONS
# =========================

validate_file() {
  if [ ! -f "$1" ]; then
    echo "[FAIL] Missing required file: $1" | tee -a "$LOG_FILE"
    exit 1
  else
    echo "[OK] Found: $1" | tee -a "$LOG_FILE"
  fi
}

validate_json_integrity() {
  python3 - <<EOF
import json
import sys

path = "$1"
try:
    with open(path, "r") as f:
        json.load(f)
    print("[OK] JSON valid:", path)
except Exception as e:
    print("[FAIL] JSON invalid:", path, str(e))
    sys.exit(1)
EOF
}

# =========================
# PRE-FLIGHT CHECKS
# =========================

echo "[427-B] Checking SYSTEM SNAPSHOT..." | tee -a "$LOG_FILE"
validate_file "$SNAPSHOT_FILE"
validate_json_integrity "$SNAPSHOT_FILE"

echo "[427-B] Checking PROJECT STATE REGISTRY..." | tee -a "$LOG_FILE"
validate_file "$STATE_FILE"
validate_json_integrity "$STATE_FILE"

echo "[427-B] Checking CONVERGENCE REGISTRY..." | tee -a "$LOG_FILE"
validate_file "$REGISTRY_FILE"
validate_json_integrity "$REGISTRY_FILE"

# =========================
# SEMANTIC CONTRACT CHECK
# =========================

echo "[427-B] Evaluating institutional contract boundary..." | tee -a "$LOG_FILE"

CONVERGENCE=$(python3 - <<EOF
import json
f = open("$REGISTRY_FILE")
data = json.load(f)
print(data.get("convergence", {}).get("score", 0))
EOF
)

if [ "$CONVERGENCE" -lt 70 ]; then
  echo "[BLOCK] Convergence too low for Institutional Entry: $CONVERGENCE" | tee -a "$LOG_FILE"
  exit 1
fi

echo "[OK] Convergence threshold passed: $CONVERGENCE" | tee -a "$LOG_FILE"

# =========================
# SNAPSHOT CONSISTENCY CHECK
# =========================

echo "[427-B] Checking snapshot consistency..." | tee -a "$LOG_FILE"

python3 - <<EOF
import json

with open("$SNAPSHOT_FILE") as f:
    snapshot = json.load(f)

artifacts = snapshot.get("convergence", {}).get("artifacts", {})
expected = artifacts.get("expected", 0)
found = artifacts.get("found", 0)

if expected != found:
    print("[BLOCK] Artifact mismatch:", expected, found)
    exit(1)

print("[OK] Snapshot integrity confirmed")
EOF

# =========================
# FINAL GATE DECISION
# =========================

echo "[427-B] FINAL INSTITUTIONAL GATE CHECK..." | tee -a "$LOG_FILE"

echo "STATUS: READY_FOR_428" | tee -a "$LOG_FILE"

# write gate file
GATE_FILE="$ROOT_DIR/install/sprints/flags/INSTITUTIONAL_PREFLIGHT_GATE.json"

cat > "$GATE_FILE" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "sprint": "427-B",
  "status": "PASSED",
  "next": "428",
  "contract": {
    "snapshot": "OK",
    "registry": "OK",
    "convergenceThreshold": "$CONVERGENCE"
  }
}
EOF

echo "[427-B] COMPLETED SUCCESSFULLY" | tee -a "$LOG_FILE"
echo "[427-B] READY FOR SPRINT 428 ENTRY" | tee -a "$LOG_FILE"
