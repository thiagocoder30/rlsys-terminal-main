#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "====================================================="
echo "RL.SYS CORE - SPRINT R0-D"
echo "RUNTIME AUTHORITY CONTRACT"
echo "====================================================="

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

ARCH_DIR="$REPO_ROOT/docs/architecture"
OUT_FILE="$ARCH_DIR/RUNTIME_AUTHORITY_CONTRACT.md"

LOG_DIR="/sdcard/Download/RL_SYS/sprint_logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/R0-D-runtime-authority-contract.log"

echo "[1/6] Repository root resolved..."
echo "Repo: $REPO_ROOT" | tee "$LOG_FILE"

echo "[2/6] Ensuring architecture directory..."
mkdir -p "$ARCH_DIR"

echo "[3/6] Generating Runtime Authority Contract..."

cat > "$OUT_FILE" << 'EOF'
# RL.SYS CORE - RUNTIME AUTHORITY CONTRACT

Generated: auto

---

## 1. Objective

Define the single authoritative execution model for RL.SYS CORE runtime system,
resolving ambiguity between ADR, topology, and domain execution layers.

---

## 2. Authority Layers (Canonical Hierarchy)

### 2.1 Conceptual Authority
- RuntimeKernel

Role:
- High-level orchestration abstraction
- Descriptive only
- Does NOT execute or enforce runtime decisions

---

### 2.2 Decision Authority
- StrategyDecisionEngine
- AnalyticsDecisionEngine

Role:
- Produce probabilistic and contextual decisions
- Suggest actions only
- Cannot enforce execution

---

### 2.3 Session Authority
- LiveSessionRuntime
- PaperSessionCoordinator

Role:
- Manage lifecycle of execution sessions
- Maintain state consistency
- Request execution approval
- Cannot override enforcement layer

---

### 2.4 Execution Authority (SOVEREIGN LAYER)

- RuntimeEnforcementOrchestrator

Role:
- Final execution gatekeeper
- Enforces runtime constraints
- Validates compliance with baseline rules
- Accepts or rejects all execution flows

THIS IS THE SINGLE SOURCE OF EXECUTION TRUTH.

---

## 3. Conflict Resolution Rules

1. Enforcement layer ALWAYS overrides other layers
2. Session layer cannot bypass enforcement
3. Decision layer cannot execute directly
4. Kernel layer is non-operational (conceptual only)

---

## 4. Runtime Flow (Canonical)

Decision → Session → Enforcement → Ledger

Execution is valid ONLY if approved by RuntimeEnforcementOrchestrator.

---

## 5. ADR Alignment Policy

If ADR conflicts with runtime behavior:

- Runtime Authority Contract prevails
- ADR must be updated via refactoring sprint
- No silent divergence allowed

---

## 6. Stability Guarantee

This contract ensures:

- Single execution authority
- No dual-runtime ambiguity
- Deterministic execution flow
- Clear separation of concerns

EOF

echo "[4/6] Checking runtime references..."

grep -R "RuntimeKernel" -n "$ARCH_DIR" >> "$LOG_FILE" || true
grep -R "RuntimeEnforcementOrchestrator" -n "$REPO_ROOT/src" >> "$LOG_FILE" || true

echo "[5/6] Snapshot saved..."

cat > "$LOG_DIR/R0-D-snapshot.txt" << EOF
REPO: $REPO_ROOT
ARCH_FILE: $OUT_FILE
STATUS: GENERATED
MODE: RUNTIME_AUTHORITY_CONTRACT
EOF

echo "[6/6] Done."

echo "====================================================="
echo "SPRINT R0-D COMPLETED"
echo "OUTPUT:"
echo "$OUT_FILE"
echo "LOG:"
echo "$LOG_FILE"
echo "====================================================="
