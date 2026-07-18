#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-A.4"
echo "AI DEVELOPMENT TEMPLATES"
echo "=================================================="


ROOT="$(pwd)"

TEMPLATES="$ROOT/.dev/templates"


echo "[1/6] Validating templates directory..."

mkdir -p "$TEMPLATES"


echo "[2/6] Creating feature request template..."


cat > "$TEMPLATES/feature-request-template.md" <<'EOF'
# RL.SYS Feature Request

## Objective

Describe the capability to be implemented.

---

## Architectural Context

Affected domain:

Affected layer:

Reason for change:

---

## Expected Behavior

Describe the required behavior.

---

## Files

Expected files:

New files:

Modified files:

---

## Constraints

Must preserve:

Must avoid:

---

## Validation

Required tests:

Compilation:

Expected result:

---

## Aider Instruction

Implement only the approved specification.

Do not redesign architecture.

EOF



echo "[3/6] Creating bug fix template..."


cat > "$TEMPLATES/bug-fix-template.md" <<'EOF'
# RL.SYS Bug Fix

## Problem

Describe the observed failure.

---

## Reproduction

Steps:

Expected behavior:

Actual behavior:

---

## Root Cause Analysis

Cause:

Affected component:

---

## Solution

Approved correction:

---

## Regression Protection

Required test:

---

## Aider Instruction

Fix only the identified problem.

Preserve existing contracts.

EOF



echo "[4/6] Creating refactor template..."


cat > "$TEMPLATES/refactor-template.md" <<'EOF'
# RL.SYS Refactor Request

## Objective

Improve internal structure without changing behavior.

---

## Motivation

Why this refactor exists:

---

## Current Problem

Technical debt:

Complexity:

Maintenance issue:

---

## Expected Result

Improvement:

Preserved behavior:

---

## Validation

Existing tests:

New tests:

---

## Aider Instruction

Refactor safely.

Do not modify external contracts.

EOF



echo "[5/6] Creating architecture change template..."


cat > "$TEMPLATES/architecture-change-template.md" <<'EOF'
# RL.SYS Architecture Change

## ADR Reference

ADR:

---

## Context

Current situation:

Problem:

---

## Decision

Approved architectural decision:

---

## Impact

Affected domains:

Affected layers:

Migration requirements:

---

## Risks

Possible failures:

Mitigation:

---

## Aider Instruction

Implementation must follow ADR.

No architectural deviation allowed.

EOF



echo "[6/6] Creating sprint package template..."


cat > "$TEMPLATES/sprint-package-template.md" <<'EOF'
# RL.SYS Sprint Implementation Package

Sprint:

Version:

Status:

---

# Objective

---

# Architecture Impact

---

# Implementation Tasks

1.

2.

3.

---

# Files

Create:

Modify:

Remove:

---

# Tests Required

---

# Validation Pipeline

bash -n

chmod

Sprint execution

npx tsc

node --test

---

# Commit Message

Expected:

---

# Aider Execution Rules

Follow RL.Sys architecture.

Read .dev standards before coding.

Do not create undocumented behavior.

EOF



echo "[VALIDATION]"


for FILE in \
feature-request-template.md \
bug-fix-template.md \
refactor-template.md \
architecture-change-template.md \
sprint-package-template.md

do

    if [ -f "$TEMPLATES/$FILE" ]; then
        echo "[OK] $FILE"
    else
        echo "[ERROR] Missing $FILE"
        exit 1
    fi

done


echo "=================================================="
echo "R1-A.4 COMPLETE"
echo "=================================================="
