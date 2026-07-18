RL.SYS

Git Standards

Version: 1.0.0

Status: Official

---

Purpose

This document defines the mandatory Git standards for RL.Sys.

The repository is considered a critical architectural asset.

Version control is not only a mechanism for storing code changes.

It represents the historical memory of the system, architectural decisions and engineering evolution.

Every commit must preserve traceability, clarity and system integrity.

---

Git Philosophy

RL.Sys follows the principle:

Intent → Implementation → Validation → Documentation → Commit

A change must be understandable by another engineer without depending on external explanations.

The repository must always represent the current verified state of the system.

---

Branch Standards

Branches must represent a clear development context.

Recommended naming patterns:

Feature development:

feature/name-description

Bug correction:

fix/name-description

Architectural evolution:

architecture/name-description

Sprint execution:

sprint/R1-K.xx-description

---

Branch Responsibilities

Each branch must have:

- clear purpose
- limited scope
- related implementation
- validation evidence

Avoid mixing unrelated changes in the same branch.

A branch must represent a coherent engineering objective.

---

Commit Standards

Commits must describe the architectural intent of the change.

Commit messages must follow:

type(scope): description

Examples:

feat(decision): add governance execution gateway

fix(runtime): correct execution trace validation

docs(architecture): update runtime topology document

test(decision): add governance regression coverage

---

Commit Types

Allowed commit types:

feat

New capability or behavior.

fix

Correction of existing behavior.

docs

Documentation changes.

test

Testing changes.

refactor

Internal restructuring without behavior change.

chore

Maintenance operations.

architecture

Architectural decisions and structural changes.

---

Commit Requirements

A commit must:

- contain related changes only
- compile successfully when applicable
- preserve existing behavior unless intentionally changed
- include tests when behavior changes
- contain clear intent

Avoid commits that mix:

- unrelated features
- temporary debugging code
- generated artifacts without purpose
- incomplete implementations

---

Sprint Commit Model

Every Sprint should produce a traceable commit.

Expected sequence:

Sprint implementation

↓

Compilation

↓

Automated tests

↓

Review

↓

Commit

The commit represents the validated state of that Sprint.

---

Code and Commit Relationship

A commit must represent a stable system state.

Do not commit:

- broken builds
- failing tests
- unfinished migrations
- experimental code without isolation

The repository history must remain trustworthy.

---

Documentation Synchronization

Architectural changes must update related documentation.

Examples:

New component:

Update architecture documentation.

New contract:

Update glossary or standards.

New decision:

Create or update ADR documentation.

Code and documentation must evolve together.

---

AI Assisted Development Rules

AI-generated changes must follow the same Git standards as human-generated changes.

Before committing AI-generated code:

Verify:

- architecture alignment
- compilation
- tests
- documentation impact

AI assistance does not replace engineering responsibility.

---

Commit Review Criteria

Before accepting a commit, verify:

- Is the purpose clear?
- Is the scope controlled?
- Does the code compile?
- Do tests pass?
- Is the architecture preserved?
- Can another engineer understand the change?

---

Forbidden Practices

Never:

- commit directly without validation
- use meaningless messages
- mix unrelated modifications
- bypass tests
- remove history to hide problems
- commit secrets or sensitive data

---

Repository Integrity

The Git repository must remain:

- auditable
- reproducible
- understandable
- maintainable

The history of RL.Sys is part of the architecture.

---

Final Principle

In RL.Sys:

A commit is not only a saved change.

A commit is a verified statement about the evolution of the system.
