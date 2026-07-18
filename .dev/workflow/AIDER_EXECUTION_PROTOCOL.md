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
