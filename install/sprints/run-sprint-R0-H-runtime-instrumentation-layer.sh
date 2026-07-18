#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "====================================================="
echo "RL.SYS CORE - SPRINT R0-H"
echo "RUNTIME INSTRUMENTATION LAYER"
echo "====================================================="

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

SRC_DIR="$REPO_ROOT/src"
ARCH_DIR="$REPO_ROOT/docs/architecture"

OUT_FILE="$ARCH_DIR/RUNTIME_INSTRUMENTATION_REPORT.md"

LOG_DIR="/sdcard/Download/RL_SYS/sprint_logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/R0-H-runtime-instrumentation.log"

TRACE_DIR="$LOG_DIR/runtime_traces"
mkdir -p "$TRACE_DIR"

echo "[1/10] Resolving repository root..."
echo "Repo: $REPO_ROOT" | tee "$LOG_FILE"

echo "[2/10] Preparing directories..."
mkdir -p "$ARCH_DIR"

echo "[3/10] Scanning execution-sensitive points..."

TARGETS=(
"RuntimeEnforcementOrchestrator"
"StrategyDecisionEngine"
"LiveSessionRuntime"
"PaperSessionCoordinator"
"RuntimeStateMachine"
"PaperTradingLedger"
)

TRACE_FILE="$TRACE_DIR/execution_trace_runtime.txt"
> "$TRACE_FILE"

echo "[4/10] Building instrumentation map (static proxy hooks)..."

for t in "${TARGETS[@]}"; do
  echo "---- $t ----" >> "$TRACE_FILE"
  grep -R --line-number "$t" "$SRC_DIR" >> "$TRACE_FILE" || true
done

echo "[5/10] Detecting execution entry points..."

ENTRY_POINTS=$(grep -R --line-number "main\|bootstrap\|init\|start\|run" "$SRC_DIR" | wc -l || true)

echo "[6/10] Detecting enforcement hooks..."

ENFORCEMENT_HITS=$(grep -R --line-number "RuntimeEnforcementOrchestrator" "$SRC_DIR" | wc -l || true)

DECISION_HITS=$(grep -R --line-number "Decision" "$SRC_DIR" | wc -l || true)

SESSION_HITS=$(grep -R --line-number "Session" "$SRC_DIR" | wc -l || true)

LEDGER_HITS=$(grep -R --line-number "Ledger" "$SRC_DIR" | wc -l || true)

echo "[7/10] Generating instrumentation report..."

cat > "$OUT_FILE" << EOF
# RL.SYS CORE - RUNTIME INSTRUMENTATION LAYER REPORT

Generated: auto

---

## 1. Execution Entry Points Detected

Entry Points (approx): $ENTRY_POINTS

---

## 2. Runtime Component Exposure

- Enforcement Layer Hits: $ENFORCEMENT_HITS
- Decision Layer Hits: $DECISION_HITS
- Session Layer Hits: $SESSION_HITS
- Ledger Layer Hits: $LEDGER_HITS

---

## 3. Instrumentation Model

This layer approximates runtime execution by identifying:

- potential entry points (bootstrap/init/run)
- enforcement invocation presence
- session orchestration paths
- ledger persistence interactions

---

## 4. Runtime Flow Model (Observed Approximation)

Input
  ↓
Decision Engine
  ↓
Session Coordinator
  ↓
Runtime State Machine
  ↓
RuntimeEnforcementOrchestrator
  ↓
Ledger Persistence

---

## 5. Sovereignty Validation Rule

Execution is valid ONLY if:

RuntimeEnforcementOrchestrator appears in final stage of flow.

Any bypass is considered INVALID execution design.

---

## 6. Instrumentation Risk Assessment

EOF

echo "[8/10] Evaluating runtime integrity..."

if [ "$ENFORCEMENT_HITS" -eq 0 ]; then
  echo "CRITICAL: No enforcement layer detected in runtime instrumentation scan" >> "$OUT_FILE"
elif [ "$DECISION_HITS" -gt "$ENFORCEMENT_HITS" ]; then
  echo "HIGH: Decision layer dominates runtime exposure" >> "$OUT_FILE"
elif [ "$SESSION_HITS" -gt "$ENFORCEMENT_HITS" ]; then
  echo "MEDIUM: Session layer may influence execution flow too strongly" >> "$OUT_FILE"
else
  echo "OK: Enforcement layer present in execution-critical paths" >> "$OUT_FILE"
fi

cat >> "$OUT_FILE" << EOF

---

## 7. Limitations

This is a static instrumentation approximation.

True runtime instrumentation requires:
- function interception (proxy / decorators)
- runtime hooks
- execution tracing in Node runtime
- event-level logging

---

## 8. Recommendation

Upgrade to active runtime hooks for full observability.

EOF

echo "[9/10] Writing snapshot..."

cat > "$LOG_DIR/R0-H-snapshot.txt" << EOF
REPO: $REPO_ROOT
STATUS: COMPLETED
MODE: RUNTIME_INSTRUMENTATION
TRACE: $TRACE_FILE
REPORT: $OUT_FILE
EOF

echo "[10/10] Done."

echo "====================================================="
echo "SPRINT R0-H COMPLETED"
echo "OUTPUT:"
echo "$OUT_FILE"
echo "TRACE:"
echo "$TRACE_FILE"
echo "LOG:"
echo "$LOG_FILE"
echo "====================================================="
