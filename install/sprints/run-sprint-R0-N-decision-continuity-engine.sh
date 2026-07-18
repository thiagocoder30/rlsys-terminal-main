#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "====================================================="
echo "RL.SYS CORE - SPRINT R0-N"
echo "DECISION CONTINUITY ENGINE"
echo "====================================================="

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

ARCH_DIR="$REPO_ROOT/docs/architecture"
STATE_FILE="$ARCH_DIR/RL_SYS_STATE.json"

LOG_DIR="/sdcard/Download/RL_SYS/sprint_logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/R0-N-decision-continuity.log"

OUT_FILE="$ARCH_DIR/RL_SYS_DECISION_CONTINUITY_REPORT.md"

echo "[1/8] Resolving repository root..."
echo "Repo: $REPO_ROOT" | tee "$LOG_FILE"

echo "[2/8] Loading STATE MANIFEST..."

if [ ! -f "$STATE_FILE" ]; then
  echo "ERROR: STATE MANIFEST NOT FOUND" | tee -a "$LOG_FILE"
  exit 1
fi

STATE_CONTENT=$(cat "$STATE_FILE")

echo "[3/8] Parsing last sprint..."

LAST_SPRINT=$(grep -o '"lastSprint"[[:space:]]*:[[:space:]]*"[^"]*"' "$STATE_FILE" | cut -d'"' -f4)

echo "[4/8] Analyzing architecture status..."

R0_L_STATUS=$(grep -o '"R0-L"[[:space:]]*:[[:space:]]*"[^"]*"' "$STATE_FILE" | cut -d'"' -f4 || true)

echo "[5/8] Determining system evolution stage..."

NEXT_SPRINT="UNKNOWN"

if [ "$LAST_SPRINT" = "R0-M" ]; then
  NEXT_SPRINT="R0-N"
elif [ "$LAST_SPRINT" = "R0-L" ]; then
  NEXT_SPRINT="R0-M"
else
  NEXT_SPRINT="R0-M"
fi

echo "[6/8] Generating decision continuity report..."

cat > "$OUT_FILE" << EOF
# RL.SYS CORE - DECISION CONTINUITY ENGINE REPORT

---

## 1. Current System State

Last Sprint Executed:
$LAST_SPRINT

---

## 2. System Interpretation

The system is operating in:

STATE-BASED CONTINUITY MODE

This means:
- execution is no longer isolated
- each sprint depends on previous state
- system can resume from last known point

---

## 3. Continuity Decision

Next Suggested Sprint:
$NEXT_SPRINT

---

## 4. Reasoning

The system uses STATE_MANIFEST to determine progression path.
Continuity is preserved across sessions without chat memory.

---

## 5. Architectural Impact

This is the first layer where RL.SYS CORE becomes:

SELF-ORIENTING (not autonomous, but state-driven)

---

## 6. Recommendation

Proceed to next sprint based on continuity graph.

EOF

echo "[7/8] Writing logs..."

echo "LAST_SPRINT=$LAST_SPRINT" >> "$LOG_FILE"
echo "NEXT_SPRINT=$NEXT_SPRINT" >> "$LOG_FILE"

echo "[8/8] Done."

echo "====================================================="
echo "SPRINT R0-N COMPLETED"
echo "OUTPUT:"
echo "$OUT_FILE"
echo "LOG:"
echo "$LOG_FILE"
echo "====================================================="
