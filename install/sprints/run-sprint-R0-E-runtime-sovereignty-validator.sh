#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "====================================================="
echo "RL.SYS CORE - SPRINT R0-E"
echo "RUNTIME SOVEREIGNTY VALIDATOR"
echo "====================================================="

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

ARCH_DIR="$REPO_ROOT/docs/architecture"
SRC_DIR="$REPO_ROOT/src"

OUT_FILE="$ARCH_DIR/RUNTIME_SOVEREIGNTY_VALIDATION_REPORT.md"

LOG_DIR="/sdcard/Download/RL_SYS/sprint_logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/R0-E-runtime-sovereignty-validator.log"

echo "[1/7] Resolving repository root..."
echo "Repo: $REPO_ROOT" | tee "$LOG_FILE"

echo "[2/7] Preparing output directories..."
mkdir -p "$ARCH_DIR"

echo "[3/7] Scanning for enforcement bypass risks..."

ENFORCEMENT_COUNT=$(grep -R "RuntimeEnforcementOrchestrator" "$SRC_DIR" | wc -l || true)
DECISION_BYPASS=$(grep -R "DecisionEngine" "$SRC_DIR" | grep -v "RuntimeEnforcementOrchestrator" | wc -l || true)
SESSION_BYPASS=$(grep -R "Session" "$SRC_DIR" | grep -v "RuntimeEnforcementOrchestrator" | wc -l || true)

echo "[4/7] Building sovereignty report..."

cat > "$OUT_FILE" << EOF
# RL.SYS CORE - RUNTIME SOVEREIGNTY VALIDATION REPORT

Generated: auto

---

## 1. Enforcement Presence Scan

RuntimeEnforcementOrchestrator references found:
$ENFORCEMENT_COUNT

---

## 2. Decision Layer Isolation Check

Potential decision-only usage outside enforcement boundary:
$DECISION_BYPASS

---

## 3. Session Layer Isolation Check

Potential session layer activity outside enforcement boundary:
$SESSION_BYPASS

---

## 4. Sovereignty Interpretation

### Rule Definition (from R0-D contract)

- RuntimeEnforcementOrchestrator must be final execution authority
- No execution path may bypass enforcement layer
- Decision and session layers are non-authoritative

---

## 5. Risk Classification

EOF

echo "[5/7] Evaluating sovereignty risk..."

if [ "$ENFORCEMENT_COUNT" -eq 0 ]; then
  echo "RISK: CRITICAL - No enforcement layer detected" >> "$OUT_FILE"
elif [ "$DECISION_BYPASS" -gt 50 ] || [ "$SESSION_BYPASS" -gt 50 ]; then
  echo "RISK: HIGH - Possible sovereignty bypass patterns" >> "$OUT_FILE"
elif [ "$DECISION_BYPASS" -gt 0 ] || [ "$SESSION_BYPASS" -gt 0 ]; then
  echo "RISK: MEDIUM - Indirect execution coupling detected" >> "$OUT_FILE"
else
  echo "RISK: LOW - No obvious sovereignty violations detected" >> "$OUT_FILE"
fi

cat >> "$OUT_FILE" << EOF

---

## 6. Enforcement Compliance Status

- Enforcement Layer Present: YES/NO (see count above)
- Decision Isolation: ANALYZED
- Session Isolation: ANALYZED

---

## 7. Recommendation

- Maintain single execution authority model
- Ensure no direct execution occurs outside enforcement layer
- Refactor any direct Decision→Execution coupling into Session→Enforcement flow

---

EOF

echo "[6/7] Writing snapshot..."

cat > "$LOG_DIR/R0-E-snapshot.txt" << EOF
REPO: $REPO_ROOT
STATUS: COMPLETED
REPORT: $OUT_FILE
EOF

echo "[7/7] Done."

echo "====================================================="
echo "SPRINT R0-E COMPLETED"
echo "OUTPUT:"
echo "$OUT_FILE"
echo "LOG:"
echo "$LOG_FILE"
echo "====================================================="
