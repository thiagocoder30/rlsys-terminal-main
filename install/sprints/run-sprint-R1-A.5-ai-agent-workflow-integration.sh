#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-A.5"
echo "AI AGENT WORKFLOW INTEGRATION"
echo "=================================================="


ROOT="$(pwd)"

WORKFLOW="$ROOT/.dev/workflow"


echo "[1/5] Validating workflow directory..."

mkdir -p "$WORKFLOW"


echo "[2/5] Creating Aider execution protocol..."


cat > "$WORKFLOW/AIDER_EXECUTION_PROTOCOL.md" <<'EOF'
# RL.Sys Aider Execution Protocol

Version: 1.0.0

Status:
Official

---

# Purpose

Defines the mandatory execution rules for Aider when modifying RL.Sys.

Aider is an implementation agent.

Architectural decisions remain controlled by the project governance process.

---

# Required Context

Before implementation Aider must read:

- .dev/PROJECT.md
- .dev/VISION.md
- .dev/GLOSSARY.md
- .dev/AGENTS.md
- .dev/standards/architecture.md
- .dev/standards/testing.md
- .dev/standards/typescript.md

---

# Implementation Rules

Aider must:

- preserve architecture
- reuse existing abstractions
- avoid duplicated logic
- create tests for behavior changes
- respect existing contracts

---

# Forbidden Actions

Aider must never:

- redesign architecture without approval
- remove tests
- bypass validation
- create undocumented behavior
- modify unrelated files

---

# Completion Criteria

Implementation is complete only after:

- compilation succeeds
- tests pass
- changes are reviewed
- commit is created
EOF



echo "[3/5] Creating AI lifecycle workflow..."


cat > "$WORKFLOW/AI_TASK_LIFECYCLE.md" <<'EOF'
# RL.Sys AI Task Lifecycle

Version: 1.0.0

---

# Lifecycle

## 1. Architecture

Responsible:

Architect Agent

Output:

- decision
- design
- affected components


---

## 2. Specification

Responsible:

Human + Architect

Output:

Sprint Package


---

## 3. Implementation

Responsible:

Aider

Input:

- Sprint Package
- Existing standards


---

## 4. Validation

Responsible:

Developer Agent

Checks:

- compilation
- automated tests
- regression


---

## 5. Review

Responsible:

Reviewer Agent

Checks:

- architecture compliance
- maintainability
- security


---

## 6. Commit

Only validated changes become part of RL.Sys history.
EOF



echo "[4/5] Creating change approval flow..."


cat > "$WORKFLOW/CHANGE_APPROVAL_FLOW.md" <<'EOF'
# RL.Sys Change Approval Flow

Version: 1.0.0

---

# Change Categories

## Feature

Requires:

- feature template
- tests
- validation


## Bug Fix

Requires:

- reproduction
- root cause
- regression test


## Refactor

Requires:

- behavior preservation
- existing tests


## Architecture Change

Requires:

- ADR
- approval before implementation

---

# Approval Principle

No code change has authority over architecture.

Architecture defines acceptable implementation.
EOF



echo "[5/5] Creating pre implementation checklist..."


cat > "$WORKFLOW/PRE_IMPLEMENTATION_CHECKLIST.md" <<'EOF'
# RL.Sys Pre Implementation Checklist

Before coding:

[ ] Objective understood

[ ] Architecture impact identified

[ ] Correct template selected

[ ] Existing components reviewed

[ ] Tests planned

[ ] Validation commands defined


Before commit:

[ ] TypeScript compilation successful

[ ] Automated tests successful

[ ] No unrelated changes

[ ] Documentation updated
EOF



echo "[VALIDATION]"


for FILE in \
AIDER_EXECUTION_PROTOCOL.md \
AI_TASK_LIFECYCLE.md \
CHANGE_APPROVAL_FLOW.md \
PRE_IMPLEMENTATION_CHECKLIST.md

do

    if [ -f "$WORKFLOW/$FILE" ]; then
        echo "[OK] $FILE"
    else
        echo "[ERROR] Missing $FILE"
        exit 1
    fi

done


echo "=================================================="
echo "R1-A.5 COMPLETE"
echo "=================================================="
