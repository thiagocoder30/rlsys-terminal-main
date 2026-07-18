#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-A.8"
echo "AIDER EXECUTION PROTOCOL"
echo "=================================================="

ROOT="$(pwd)"

WORKFLOW_DIR="$ROOT/.dev/workflow"
BOOTSTRAP_DIR="$ROOT/.dev/scripts/bootstrap"


echo "[1/5] Validating directories..."

mkdir -p "$WORKFLOW_DIR"
mkdir -p "$BOOTSTRAP_DIR"


echo "[2/5] Creating Aider execution protocol..."


cat > "$WORKFLOW_DIR/AIDER_EXECUTION_PROTOCOL.md" <<'EOF'
# RL.Sys Aider Execution Protocol

Version: 1.0.0

Status:
Official

---

# Purpose

This document defines the mandatory workflow for using Aider as the implementation agent for RL.Sys.

Aider executes approved architecture.

Aider does not define architecture.

---

# Execution Philosophy

The development process follows:

Architecture

↓

Sprint Definition

↓

AI Implementation Request

↓

Aider Execution

↓

Validation

↓

Completion Report

↓

Commit

---

# Session Initialization

Before starting Aider:

Required:

1. Update project context.

Command:

bash .dev/scripts/bootstrap/prepare-aider-context.sh


2. Validate context.

Command:

bash .dev/scripts/bootstrap/validate-aider-context.sh


3. Confirm repository status.

Command:

git status

---

# Aider Input Requirements

Every Aider session must receive:

Required documents:

- .dev/context/AIDER_CONTEXT.md
- .dev/PROJECT.md
- .dev/VISION.md
- .dev/standards/architecture.md
- .dev/standards/testing.md
- AI_IMPLEMENTATION_REQUEST.md

---

# Implementation Rules

Aider must:

- inspect existing implementation first;
- modify only approved files;
- preserve architecture;
- avoid unnecessary refactoring;
- create tests when behavior changes;
- maintain backward compatibility.

---

# Forbidden Actions

Aider must never:

- redesign architecture without approval;
- remove validation;
- bypass domain boundaries;
- delete tests to solve failures;
- introduce undocumented behavior.

---

# Validation Sequence

Every implementation must execute:

1.

bash -n sprint-script.sh


2.

npx tsc


3.

node --test


4.

git diff review


Only after successful validation may a commit be created.

---

# Completion Report

Every execution must produce:

AI_COMPLETION_REPORT.md

Containing:

- implemented changes;
- modified files;
- architecture impact;
- tests executed;
- validation results;
- risks.

---

# Final Rule

Aider is an implementation accelerator.

Architecture authority remains with RL.Sys engineering governance.

EOF


echo "[3/5] Creating Aider session bootstrap..."


cat > "$BOOTSTRAP_DIR/start-aider-session.sh" <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS AIDER SESSION BOOTSTRAP"
echo "=================================================="


echo "[1/4] Updating context..."

bash .dev/scripts/bootstrap/prepare-aider-context.sh


echo "[2/4] Validating context..."

bash .dev/scripts/bootstrap/validate-aider-context.sh


echo "[3/4] Repository status"

git status


echo "[4/4] Aider ready"

echo ""
echo "Load context:"
echo ".dev/context/AIDER_CONTEXT.md"
echo ""
echo "Follow:"
echo ".dev/workflow/AIDER_EXECUTION_PROTOCOL.md"

EOF


chmod +x "$BOOTSTRAP_DIR/start-aider-session.sh"


echo "[4/5] Validation"


if [ -f "$WORKFLOW_DIR/AIDER_EXECUTION_PROTOCOL.md" ]; then
    echo "[OK] AIDER_EXECUTION_PROTOCOL.md"
else
    echo "[ERROR] Missing protocol"
    exit 1
fi


if [ -x "$BOOTSTRAP_DIR/start-aider-session.sh" ]; then
    echo "[OK] start-aider-session.sh"
else
    echo "[ERROR] Missing bootstrap"
    exit 1
fi


echo "[5/5] Complete"

echo "=================================================="
echo "R1-A.8 COMPLETE"
echo "=================================================="
