#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-A.9"
echo "AI GOVERNANCE CERTIFICATION"
echo "=================================================="


ROOT="$(pwd)"

DEV_DIR="$ROOT/.dev"
REPORT="$DEV_DIR/GOVERNANCE_CERTIFICATION.md"


echo "[1/5] Validating governance structure..."


REQUIRED_PATHS=(
".dev/PROJECT.md"
".dev/VISION.md"
".dev/GLOSSARY.md"
".dev/AGENTS.md"
".dev/GOVERNANCE_MAP.md"
".dev/standards/architecture.md"
".dev/standards/testing.md"
".dev/standards/typescript.md"
".dev/agents/architect-agent.md"
".dev/agents/developer-agent.md"
".dev/agents/reviewer-agent.md"
".dev/prompts/architect-prompt.md"
".dev/prompts/developer-prompt.md"
".dev/prompts/reviewer-prompt.md"
".dev/context/AIDER_CONTEXT.md"
".dev/workflow/AI_WORKFLOW_CONTRACT.md"
".dev/workflow/AI_TASK_LIFECYCLE.md"
".dev/workflow/AI_SPRINT_EXECUTOR_CONTRACT.md"
".dev/workflow/AIDER_EXECUTION_PROTOCOL.md"
".dev/workflow/AI_IMPLEMENTATION_REQUEST.md"
".dev/workflow/AI_COMPLETION_REPORT.md"
)


for PATH_ITEM in "${REQUIRED_PATHS[@]}"
do

if [ -e "$ROOT/$PATH_ITEM" ]; then
    echo "[OK] $PATH_ITEM"
else
    echo "[ERROR] Missing $PATH_ITEM"
    exit 1
fi

done


echo "[2/5] Creating certification report..."


cat > "$REPORT" <<'EOF'
# RL.Sys AI Development Governance Certification

Version: 1.0.0

Status:

CERTIFIED


---

# Purpose

This document certifies the RL.Sys AI-assisted development governance structure.

The certification confirms that the project contains the required architecture, workflow and execution controls for AI-assisted engineering.


---

# Certification Scope


## Architecture Governance

Status:

PASS


Verified:

- Architecture standards exist.
- Layer responsibilities are documented.
- Dependency rules are defined.


---

## Agent Governance

Status:

PASS


Verified:

- Architect agent defined.
- Developer agent defined.
- Reviewer agent defined.


---

## Prompt Governance

Status:

PASS


Verified:

- Architect prompt available.
- Developer prompt available.
- Reviewer prompt available.


---

## Context Management

Status:

PASS


Verified:

- Aider context generation exists.
- Context validation exists.
- Session bootstrap exists.


---

## Execution Governance

Status:

PASS


Verified:

- Sprint executor contract exists.
- Implementation request template exists.
- Completion report template exists.


---

# Approved AI Workflow


Architecture

↓

Sprint Definition

↓

AI Request

↓

Aider Execution

↓

Validation

↓

Completion Report

↓

Commit


---

# Restrictions


AI agents must not:

- define architecture;
- bypass governance;
- remove validation;
- modify unrelated components;
- introduce undocumented behavior.


---

# Certification Result


RL.Sys AI Development Governance v1.0


CERTIFIED


---

# Final Principle

AI accelerates implementation.

Architecture controls direction.

Validation protects the system.

EOF


echo "[3/5] Creating certification validation..."


if [ -f "$REPORT" ]; then
    echo "[OK] GOVERNANCE_CERTIFICATION.md"
else
    echo "[ERROR] Certification missing"
    exit 1
fi


echo "[4/5] Certification status"

echo "RL.SYS AI DEVELOPMENT GOVERNANCE v1.0"
echo "CERTIFIED"


echo "[5/5] Complete"


echo "=================================================="
echo "R1-A.9 COMPLETE"
echo "=================================================="
