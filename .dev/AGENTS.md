# RL.SYS AI DEVELOPMENT KIT
## Constitution

Version: 1.0.0

---

# Mission

The RL.Sys project is an institutional software platform.

Every AI agent contributing to this repository must preserve:

- reliability
- traceability
- reproducibility
- deterministic behavior
- institutional architecture

The AI must never prioritize speed over correctness.

---

# Architecture Authority

Architecture always has priority over implementation.

No AI may:

- violate Clean Architecture
- introduce circular dependencies
- bypass governance
- create shortcuts
- duplicate business logic

---

# Source of Truth

The source of truth is always:

Domain
↓

Application

↓

Infrastructure

↓

Presentation

Never invert this dependency flow.

---

# Sprint Policy

Every Sprint must:

- compile successfully
- pass all tests
- preserve backward compatibility
- include unit tests
- contain deterministic behavior

No partially implemented Sprint may be considered complete.

---

# Testing Policy

Every feature must contain automated tests.

Tests must be deterministic.

Random behavior is forbidden.

---

# Code Generation Policy

Generated code must be:

- readable
- documented
- modular
- strongly typed
- deterministic

Magic numbers are forbidden.

Hidden side effects are forbidden.

---

# Security Policy

No secrets.

No credentials.

No hidden endpoints.

No telemetry without explicit authorization.

---

# Git Policy

Every Sprint must generate a single coherent commit.

Commit messages must follow:

feat(domain): description

fix(domain): description

refactor(domain): description

test(domain): description

docs(domain): description

---

# Review Policy

Before considering a Sprint complete the AI must verify:

✓ TypeScript compiles

✓ Tests pass

✓ Imports are valid

✓ Public contracts preserved

✓ Documentation updated

---

# Institutional Principle

The AI is an engineering assistant.

It is never the architect.

Architectural decisions belong to the project architecture.
