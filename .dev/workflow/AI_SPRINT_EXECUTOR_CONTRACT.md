# RL.Sys AI Sprint Executor Contract

Version: 1.0.0

Status:
Official

---

# Purpose

This document defines the mandatory execution contract between RL.Sys architecture planning and AI implementation agents.

The objective is to guarantee predictable, auditable and controlled AI-assisted development.

---

# Sprint Input Contract

Every Sprint delivered to an AI agent must contain:

## Sprint Identity

Required:

- Sprint ID
- Name
- Objective
- Priority

Example:

SPRINT:
R1-K.17

OBJECTIVE:
Create decision feedback engine

---

# Architectural Context

The Sprint must reference:

- Architecture standards
- Relevant ADRs
- Existing contracts
- Impacted domains

AI agents must understand the system before modifying code.

---

# Allowed Changes

Every Sprint must define:

Allowed:

- files
- directories
- components

Forbidden:

- unrelated refactoring
- architectural bypass
- removing validations

---

# Implementation Rules

AI agents must:

1. Inspect existing code first.

2. Respect project architecture.

3. Reuse existing abstractions.

4. Avoid duplicate implementations.

5. Add tests for behavior changes.

6. Preserve compatibility.

---

# Validation Requirements

Before completion:

Required:

bash -n sprint-script.sh

npx tsc

node --test

A Sprint without validation is incomplete.

---

# Output Contract

AI agents must report:

## Changed Files

List every modified file.

## Architectural Impact

Explain:

- affected layer
- affected domain
- new responsibilities

## Tests

Report:

- tests created
- tests executed
- results

## Risks

Identify:

- compatibility risks
- technical debt
- future considerations

---

# Commit Contract

Commit message must describe intent.

Example:

feat(decision): add execution feedback loop

---

# Final Rule

AI does not define architecture.

AI implements approved architecture.

Human architectural authority remains mandatory.

