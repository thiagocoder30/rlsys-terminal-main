# RL.SYS
## Architecture Standards

Version: 1.0.0

Status:
Official

---

# Purpose

This document defines mandatory architectural rules for RL.Sys.

Every implementation must respect these principles.

Architecture has authority over code.

---

# Architectural Principles

## 1. Separation of Concerns

Each layer has a defined responsibility.

Responsibilities must never overlap.

---

# Layer Rules

## Domain Layer

Location:

src/domain/

Purpose:

Contains pure business rules.

Allowed:

- Entities
- Value Objects
- Domain Services
- Business Rules

Forbidden:

- File system access
- Database access
- External APIs
- Framework dependencies

---

## Application Layer

Location:

src/application/

Purpose:

Coordinates use cases.

Responsible for:

- workflows
- orchestration
- application services
- adapters

Forbidden:

- UI logic
- infrastructure implementation
- hidden business rules

---

## Infrastructure Layer

Location:

src/infrastructure/

Purpose:

Technical implementations.

Examples:

- persistence
- storage
- external communication
- runtime integrations

---

## Presentation Layer

Location:

src/presentation/

Purpose:

Human interaction.

Examples:

- CLI
- PWA
- API

Presentation must never contain business decisions.

---

# Dependency Direction

Allowed:

Presentation
    |
    v
Application
    |
    v
Domain


Infrastructure may support Application.

Domain must never depend on Infrastructure.

---

# Decision Architecture

All decisions must follow:

Evidence

↓

Evaluation

↓

Governance

↓

Execution Permission

↓

Audit

No component may bypass Governance.

---

# Governance Rule

Every executable action must have:

- Decision ID
- Session ID
- Governance status
- Explanation
- Audit trace

---

# Sprint Rules

Every Sprint must contain:

1. Objective

2. Architectural impact

3. Implementation

4. Tests

5. Validation

6. Documentation

---

# Code Generation Rules

Generated code must:

- follow existing architecture
- avoid unnecessary abstractions
- maintain backward compatibility
- include tests

---

# Change Management

Large architectural changes require:

ADR.

The ADR must explain:

- Context
- Decision
- Alternatives
- Consequences

---

# Forbidden Practices

Never:

- bypass application layer
- put business logic in UI
- create duplicated domain rules
- remove auditability
- hide errors
- introduce undocumented behavior

---

# Final Principle

The system must remain understandable by humans.

Complexity without necessity is considered an architectural defect.
