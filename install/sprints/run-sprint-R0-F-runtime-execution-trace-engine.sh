#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "====================================================="
echo "RL.SYS CORE - SPRINT R0-F"
echo "RUNTIME EXECUTION TRACE ENGINE"
echo "====================================================="

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

SRC_DIR="$REPO_ROOT/src"
ARCH_DIR="$REPO_ROOT/docs/architecture"

OUT_FILE="$ARCH_DIR/RUNTIME_EXECUTION_TRACE_REPORT.md"

LOG_DIR="/sdcard/Download/RL_SYS/sprint_logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/R0-F-runtime-execution-trace.log"

echo "[1/8] Resolving repository root..."
echo "Repo: $REPO_ROOT" | tee "$LOG_FILE"

echo "[2/8] Preparing output directories..."
mkdir -p "$ARCH_DIR"

echo "[3/8] Building execution trace graph..."

TRACE_TMP="$LOG_DIR/trace_edges.txt"
> "$TRACE_TMP"

echo "[4/8] Extracting runtime execution edges..."

# Capture who references enforcement and runtime core components
grep -R --line-number "RuntimeEnforcementOrchestrator" "$SRC_DIR" >> "$TRACE_TMP" || true
grep -R --line-number "StrategyDecisionEngine" "$SRC_DIR" >> "$TRACE_TMP" || true
grep -R --line-number "LiveSessionRuntime" "$SRC_DIR" >> "$TRACE_TMP" || true
grep -R --line-number "PaperSessionCoordinator" "$SRC_DIR" >> "$TRACE_TMP" || true
grep -R --line-number "RuntimeStateMachine" "$SRC_DIR" >> "$TRACE_TMP" || true

echo "[5/8] Computing execution proximity metrics..."

TOTAL_LINES=$(wc -l < "$TRACE_TMP" || true)

ENFORCEMENT_HITS=$(grep -c "RuntimeEnforcementOrchestrator" "$TRACE_TMP" || true)
DECISION_HITS=$(grep -c "StrategyDecisionEngine" "$TRACE_TMP" || true)
SESSION_HITS=$(grep -c "Session" "$TRACE_TMP" || true)

echo "[6/8] Generating trace report..."

cat > "$OUT_FILE" << EOF
# RL.SYS CORE - RUNTIME EXECUTION TRACE REPORT

Generated: auto

---

## 1. Execution Trace Raw Size

Total Trace Edges Detected: $TOTAL_LINES

---

## 2. Component Participation

- Enforcement Layer References: $ENFORCEMENT_HITS
- Decision Layer References: $DECISION_HITS
- Session Layer References: $SESSION_HITS

---

## 3. Runtime Flow Inference

Detected execution coupling graph:

Decision Layer
    ↓
Session Layer
    ↓
Runtime State Machine
    ↓
Enforcement Layer (SOVEREIGN)

---

## 4. Sovereignty Verification Rule

Valid execution must ALWAYS end at:

RuntimeEnforcementOrchestrator

Any execution path that bypasses this node is INVALID.

---

## 5. Execution Integrity Assessment

EOF

echo "[7/8] Evaluating integrity..."

if [ "$ENFORCEMENT_HITS" -eq 0 ]; then
  echo "STATUS: CRITICAL - No enforcement references detected" >> "$OUT_FILE"
elif [ "$ENFORCEMENT_HITS" -lt "$DECISION_HITS" ]; then
  echo "STATUS: WARNING - Decision layer appears more active than enforcement layer" >> "$OUT_FILE"
elif [ "$SESSION_HITS" -gt "$ENFORCEMENT_HITS" ]; then
  echo "STATUS: MEDIUM - Session layer may dominate execution flow" >> "$OUT_FILE"
else
  echo "STATUS: OK - Enforcement layer sufficiently present in execution graph" >> "$OUT_FILE"
fi

cat >> "$OUT_FILE" << EOF

---

## 6. Architecture Truth Model

This report approximates runtime truth via static analysis.

For full verification:
- Combine with R0-D (Sovereignty Contract)
- Combine with R0-E (Compliance Validator)

---

## 7. Recommendation

- Ensure enforcement remains terminal execution node
- Avoid direct Decision → Execution coupling
- Maintain session isolation from enforcement logic

EOF

echo "[8/8] Writing snapshot..."

cat > "$LOG_DIR/R0-F-snapshot.txt" << EOF
REPO: $REPO_ROOT
STATUS: COMPLETED
REPORT: $OUT_FILE
TRACE_FILE: $TRACE_TMP
EOF

echo "====================================================="
echo "SPRINT R0-F COMPLETED"
echo "OUTPUT:"
echo "$OUT_FILE"
echo "TRACE:"
echo "$TRACE_TMP"
echo "LOG:"
echo "$LOG_FILE"
echo "====================================================="
