#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

echo "[SPRINT 427] RUNTIME SNAPSHOT RECONSTRUCTION ENGINE START"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

FLAGS="$ROOT/install/sprints/flags"
LOGS="$ROOT/install/sprints/logs"

mkdir -p "$FLAGS"
mkdir -p "$LOGS"
mkdir -p /sdcard/Download

LOG_FILE="$LOGS/sprint-427-runtime-snapshot-reconstruction.log"

exec > >(tee "$LOG_FILE")
exec 2>&1

echo "[427] ROOT=$ROOT"
echo "[427] LOADING ARTIFACTS..."

CONVERGENCE="$FLAGS/RUNTIME_CONVERGENCE_REPORT.json"
DECISION="$FLAGS/RUNTIME_EXECUTION_DECISION_REPORT.json"
WINDOW="$FLAGS/RUNTIME_ENTRY_WINDOW_DYNAMICS_REPORT.json"
REGIME="$FLAGS/RUNTIME_REGIME_VALIDATION_SIGNAL_INTEGRITY_REPORT.json"
DECAY="$FLAGS/RUNTIME_EXECUTION_DECAY_TIMING_REPORT.json"

OUTPUT="$FLAGS/RUNTIME_SYSTEM_SNAPSHOT.json"

MISSING=()

[ -f "$CONVERGENCE" ] || MISSING+=("CONVERGENCE")
[ -f "$DECISION" ] || MISSING+=("DECISION")
[ -f "$WINDOW" ] || MISSING+=("WINDOW")
[ -f "$REGIME" ] || MISSING+=("REGIME")
[ -f "$DECAY" ] || MISSING+=("DECAY")

if [ ${#MISSING[@]} -gt 0 ]; then

cat > "$OUTPUT" << EOF
{
  "generatedAt":"$(date -Iseconds)",
  "status":"INCOMPLETE",
  "missing":[
$(printf '"%s",\n' "${MISSING[@]}" | sed '$ s/,$//')
  ]
}
EOF

STATUS="INCOMPLETE"
SCORE=0

else

jq -s '
{
  generatedAt:(now|strftime("%Y-%m-%dT%H:%M:%SZ")),
  model:"RUNTIME_SYSTEM_SNAPSHOT_V1",

  convergence: .[0],
  decision: .[1],
  window: .[2],
  regime: .[3],
  decay: .[4],

  synthesis:{
    convergenceScore:
      (.[0].convergence.score // 0),

    decisionScore:
      (.[1].decision.score // 0),

    windowConfidence:
      (.[2].window.confidence // 0),

    regimeState:
      (.[3].regime.state // "UNKNOWN"),

    decayScore:
      (.[4].scoring.decayedScore // 0)
  }
}
' \
"$CONVERGENCE" \
"$DECISION" \
"$WINDOW" \
"$REGIME" \
"$DECAY" \
> "$OUTPUT"

STATUS="SNAPSHOT_REBUILT"
SCORE=100

fi

CHECKSUM=$(sha256sum "$OUTPUT" | awk '{print $1}')
SIZE=$(wc -c < "$OUTPUT")

cat > "$LOGS/receipt_RUNTIME_427.json" << EOF
{
  "generatedAt":"$(date -Iseconds)",
  "sprint":"427",
  "artifact":"RUNTIME_SYSTEM_SNAPSHOT",
  "checksum":"$CHECKSUM",
  "sizeBytes":$SIZE,
  "status":"$STATUS"
}
EOF

cp "$OUTPUT" \
"/sdcard/Download/RUNTIME_SYSTEM_SNAPSHOT.json"

cp "$LOGS/receipt_RUNTIME_427.json" \
"/sdcard/Download/receipt_RUNTIME_427.json"

echo ""
echo "=============================="
echo "[SPRINT 427 RESULT]"
echo "SNAPSHOT SCORE: $SCORE"
echo "STATUS: $STATUS"
echo "OUTPUT: $OUTPUT"
echo "RECEIPT: $LOGS/receipt_RUNTIME_427.json"
echo "LOG: $LOG_FILE"
echo "=============================="
echo ""

echo "[SPRINT 427] COMPLETE"

git add "$OUTPUT" 2>/dev/null || true
git add "$LOGS/receipt_RUNTIME_427.json" 2>/dev/null || true

git commit -m "Sprint 427 - Runtime Snapshot Reconstruction Engine" 2>/dev/null || true
