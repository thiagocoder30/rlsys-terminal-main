#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "====================================================="
echo "RL.SYS CORE - SPRINT R0-P"
echo "EXECUTION TRUTH ENGINE"
echo "====================================================="

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

SRC_DIR="$REPO_ROOT/src"
ARCH_DIR="$REPO_ROOT/docs/architecture"

LOG_DIR="/sdcard/Download/RL_SYS/sprint_logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/R0-P-execution-truth.log"

OUT_FILE="$ARCH_DIR/RL_SYS_EXECUTION_TRUTH_REPORT.md"

TRACE_DIR="$LOG_DIR/execution_truth"
mkdir -p "$TRACE_DIR"

TRACE_FILE="$TRACE_DIR/truth_trace.txt"
> "$TRACE_FILE"

echo "[1/10] Resolving repository root..."
echo "Repo: $REPO_ROOT" | tee "$LOG_FILE"

echo "[2/10] Scanning declared architecture..."

DECLARED_MODULES=$(find "$SRC_DIR" -type f -name "*.ts" -o -name "*.js" | wc -l || true)

echo "[3/10] Detecting runtime entry points..."

ENTRY_POINTS=$(grep -R --line-number "bootstrap\|start\|init\|run\|execute" "$SRC_DIR" | wc -l || true)

echo "[4/10] Detecting enforcement hooks..."

ENFORCEMENT=$(grep -R --line-number "RuntimeEnforcementOrchestrator" "$SRC_DIR" | wc -l || true)

echo "[5/10] Building execution probability map (static proxy)..."

DECISION=$(grep -R --line-number "StrategyDecisionEngine" "$SRC_DIR" | wc -l || true)
RISK=$(grep -R --line-number "Risk" "$SRC_DIR" | wc -l || true)
SESSION=$(grep -R --line-number "Session" "$SRC_DIR" | wc -l || true)
LEDGER=$(grep -R --line-number "Ledger" "$SRC_DIR" | wc -l || true)

echo "[6/10] Generating execution truth comparison..."

cat > "$OUT_FILE" << EOF
# RL.SYS CORE - EXECUTION TRUTH ENGINE REPORT

---

## 1. Declared Architecture Surface

Total Source Files:
$DECLARED_MODULES

---

## 2. Runtime Entry Points (Potential)

Detected Entry Points:
$ENTRY_POINTS

---

## 3. Enforcement Presence

RuntimeEnforcementOrchestrator references:
$ENFORCEMENT

---

## 4. Structural Influence Map

- Decision Layer References: $DECISION
- Risk Layer References: $RISK
- Session Layer References: $SESSION
- Ledger Layer References: $LEDGER

---

## 5. Execution Truth Interpretation

This report DOES NOT assume execution.

It compares:

DECLARED ARCHITECTURE vs STRUCTURAL CONNECTIVITY

---

## 6. Critical Insight

If a module is not referenced in runtime flow paths,
it is considered:

"ARCHITECTURE-ONLY (NON-EXECUTED)"

---

## 7. Limitation

This system cannot yet observe real runtime execution traces.

It operates on static structural inference only.

---

## 8. Truth Model Status

- Static Truth Model: ACTIVE
- Runtime Truth Model: NOT AVAILABLE
- Hybrid Validation: PARTIAL

---

## 9. Recommendation

Next evolution required:

R0-Q → REAL RUNTIME INSTRUMENTATION LAYER

EOF

echo "[7/10] Writing trace data..."

echo "MODULES=$DECLARED_MODULES" >> "$LOG_FILE"
echo "ENTRY_POINTS=$ENTRY_POINTS" >> "$LOG_FILE"
echo "ENFORCEMENT=$ENFORCEMENT" >> "$LOG_FILE"

echo "[8/10] Writing structural trace..."

echo "---- EXECUTION TRUTH TRACE ----" >> "$TRACE_FILE"
grep -R --line-number "Decision\|Risk\|Session\|Ledger" "$SRC_DIR" >> "$TRACE_FILE" || true

echo "[9/10] Finalizing snapshot..."

cat > "$TRACE_DIR/snapshot.txt" << EOF
MODE: EXECUTION_TRUTH_STATIC
STATUS: COMPLETED
REAL_RUNTIME: NOT_INSTRUMENTED
EOF

echo "[10/10] Done."

echo "====================================================="
echo "SPRINT R0-P COMPLETED"
echo "OUTPUT:"
echo "$OUT_FILE"
echo "TRACE:"
echo "$TRACE_FILE"
echo "LOG:"
echo "$LOG_FILE"
echo "====================================================="
