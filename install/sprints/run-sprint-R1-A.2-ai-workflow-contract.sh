#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-A.2"
echo "AI WORKFLOW CONTRACT"
echo "=================================================="


ROOT="$(pwd)"

WORKFLOW="$ROOT/.dev/workflow"


if [ ! -d "$WORKFLOW" ]; then
    echo "[ERROR] .dev/workflow not found"
    exit 1
fi


echo "[1/4] Creating workflow contract..."


cat > "$WORKFLOW/AI_WORKFLOW_CONTRACT.md" <<'EOF'
# RL.SYS AI Workflow Contract

Version:
1.0.0

Status:
Official


# Purpose

Define the mandatory workflow between AI agents working on RL.Sys.


# Agent Pipeline


ARCHITECT AGENT

Responsible for:

- analysis;
- architecture;
- specifications;
- technical decisions.


        |

        v


DEVELOPER AGENT

Responsible for:

- implementation;
- tests;
- compilation;
- execution.


        |

        v


REVIEWER AGENT

Responsible for:

- validation;
- regression analysis;
- architecture verification.



# Development Flow


## Phase 1 — Specification

The Architect Agent must provide:


- objective;
- context;
- architecture impact;
- affected files;
- implementation rules;
- validation criteria.



## Phase 2 — Implementation

The Developer Agent must:


- read specifications;
- respect standards;
- implement only approved scope;
- create tests;
- execute validation.



## Phase 3 — Review

The Reviewer Agent verifies:


- architecture compliance;
- code quality;
- tests;
- documentation;
- backward compatibility.



# Change Rules


No agent may:


- bypass another agent responsibility;
- modify architecture silently;
- remove validation;
- introduce undocumented behavior.



# Sprint Package Standard


Every Sprint must contain:


1. Objective

2. Architectural Impact

3. Implementation

4. Tests

5. Validation

6. Documentation



# Communication Standard


Agents must communicate:


- what was changed;
- why it was changed;
- risks;
- validation result.



# Final Principle


AI accelerates implementation.

Architecture remains the authority.

EOF



echo "[2/4] Creating handoff template..."


cat > "$WORKFLOW/AGENT_HANDOFF_TEMPLATE.md" <<'EOF'
# RL.Sys Agent Handoff


## Source Agent


## Destination Agent


## Objective


## Context


## Files


## Required Changes


## Validation Required


## Risks


## Completion Evidence

EOF



echo "[3/4] Creating validation checklist..."


cat > "$WORKFLOW/SPRINT_VALIDATION_CHECKLIST.md" <<'EOF'
# RL.Sys Sprint Validation Checklist


Before completion verify:


[ ] Specification exists

[ ] Architecture impact reviewed

[ ] Implementation completed

[ ] Compilation successful

[ ] Tests executed

[ ] Documentation updated

[ ] Commit created


A Sprint is incomplete without validation.

EOF



echo "[4/4] Validation"


for FILE in \
AI_WORKFLOW_CONTRACT.md \
AGENT_HANDOFF_TEMPLATE.md \
SPRINT_VALIDATION_CHECKLIST.md

do

    if [ -f "$WORKFLOW/$FILE" ]; then
        echo "[OK] $FILE"
    else
        echo "[ERROR] Missing $FILE"
        exit 1
    fi

done


echo "=================================================="
echo "R1-A.2 COMPLETE"
echo "=================================================="
