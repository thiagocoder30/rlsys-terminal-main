#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

echo "[SPRINT 427-A] RUNTIME PROJECT STATE REGISTRY ENGINE START"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS_DIR="$ROOT/install/sprints/flags"
LOG_DIR="$ROOT/install/sprints/logs"

mkdir -p "$FLAGS_DIR"
mkdir -p "$LOG_DIR"
mkdir -p /sdcard/Download

LOG_FILE="$LOG_DIR/sprint-427-a-runtime-project-state-registry.log"

exec > >(tee "$LOG_FILE")
exec 2>&1

echo "[427-A] ROOT=$ROOT"
echo "[427-A] LOADING SNAPSHOT..."

SNAPSHOT="$FLAGS_DIR/RUNTIME_SYSTEM_SNAPSHOT.json"

if [ ! -f "$SNAPSHOT" ]; then
    echo "[427-A] ERROR: SNAPSHOT NOT FOUND"
    exit 1
fi

read_json() {
    local query="$1"
    jq -r "$query // empty" "$SNAPSHOT" 2>/dev/null || true
}

CONVERGENCE_SCORE="$(read_json '.synthesis.convergenceScore')"
DECISION_SCORE="$(read_json '.synthesis.decisionScore')"
WINDOW_CONFIDENCE="$(read_json '.synthesis.windowConfidence')"
REGIME_STATE="$(read_json '.synthesis.regimeState')"
DECAY_SCORE="$(read_json '.synthesis.decayScore')"

CONVERGENCE_SCORE="${CONVERGENCE_SCORE:-0}"
DECISION_SCORE="${DECISION_SCORE:-0}"
WINDOW_CONFIDENCE="${WINDOW_CONFIDENCE:-0}"
REGIME_STATE="${REGIME_STATE:-UNKNOWN}"
DECAY_SCORE="${DECAY_SCORE:-0}"

STATE_FILE="$FLAGS_DIR/RL_SYS_PROJECT_STATE.json"

cat > "$STATE_FILE" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "project":"RL.SYS CORE",
  "phase":"INSTITUTIONAL_WARMUP_INTELLIGENCE",
  "currentSprint":"427-A",
  "repositoryHealth":"GREEN",

  "runtime":{
    "snapshot":"READY",
    "convergence":$CONVERGENCE_SCORE,
    "decision":$DECISION_SCORE,
    "window":$WINDOW_CONFIDENCE,
    "regime":"$REGIME_STATE",
    "decay":$DECAY_SCORE
  },

  "roadmap":{
    "completed":[
      "420",
      "421",
      "422",
      "423",
      "424",
      "425",
      "426",
      "426-B",
      "427"
    ],

    "next":[
      "428",
      "429",
      "430",
      "431"
    ]
  }
}
EOF

CHECKSUM="$(sha256sum "$STATE_FILE" | awk '{print $1}')"
SIZE="$(wc -c < "$STATE_FILE")"

RECEIPT="$LOG_DIR/receipt_RUNTIME_427_A.json"

cat > "$RECEIPT" <<EOF
{
  "generatedAt":"$(date -Iseconds)",
  "sprint":"427-A",
  "artifact":"RL_SYS_PROJECT_STATE",
  "checksum":"$CHECKSUM",
  "sizeBytes":$SIZE,
  "status":"PROJECT_STATE_REGISTERED"
}
EOF

cp "$STATE_FILE" \
"/sdcard/Download/RL_SYS_PROJECT_STATE.json" 2>/dev/null || true

cp "$RECEIPT" \
"/sdcard/Download/receipt_RUNTIME_427_A.json" 2>/dev/null || true

cp "$LOG_FILE" \
"/sdcard/Download/sprint-427-a-runtime-project-state-registry.log" 2>/dev/null || true

echo
echo "=============================="
echo "[SPRINT 427-A RESULT]"
echo "PROJECT STATE: REGISTERED"
echo "PHASE: INSTITUTIONAL_WARMUP_INTELLIGENCE"
echo "CURRENT SPRINT: 427-A"
echo "OUTPUT: $STATE_FILE"
echo "RECEIPT: $RECEIPT"
echo "LOG: $LOG_FILE"
echo "=============================="
echo

echo "[SPRINT 427-A] COMPLETE"

git add "$STATE_FILE" 2>/dev/null || true
git commit -m "Sprint 427-A - Runtime Project State Registry Engine" 2>/dev/null || true
