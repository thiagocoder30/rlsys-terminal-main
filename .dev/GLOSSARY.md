# RL.SYS
## Institutional Glossary

Version: 1.0.0

Status:
Official

---

# Purpose

This glossary defines the official vocabulary used throughout the RL.Sys platform.

All AI agents must use these definitions consistently.

If a term is not defined here, new definitions must be approved before adoption.

---

# Architecture

Architecture

The institutional structure governing the organization of the system.

Architecture always has authority over implementation.

---

Domain

The business layer.

Contains deterministic business rules.

Never depends on infrastructure.

---

Application

Coordinates business workflows.

Implements use cases.

Never contains business rules that belong to the Domain.

---

Infrastructure

Implements persistence, runtime services, adapters and integrations.

---

Presentation

User interaction layer.

Includes:

CLI

Terminal

Dashboard

PWA

API

---

# Decision

Decision

The result produced by the Decision Engine after evaluating all available evidence.

---

Decision Engine

Responsible for evaluating strategies and producing deterministic decisions.

---

Decision Pipeline

The complete sequence from evidence collection to final governed decision.

---

Decision Session

A single execution cycle containing all evaluated evidence and generated decisions.

---

Decision Snapshot

Immutable representation of a governed decision.

---

Decision Context

All information available when a decision is evaluated.

---

# Governance

Governance

The institutional process that validates whether a decision may proceed.

---

Governance Rule

A deterministic rule that evaluates operational conditions.

---

Governance Snapshot

Immutable record of governance evaluation.

---

Governance Enforcement

Component responsible for preventing invalid execution.

---

Operational Gate

Final operational status produced by governance.

Possible values include:

NO_GO

SIGNAL

RESEARCH

UNKNOWN

---

NO_GO

Execution is forbidden.

---

SIGNAL

Execution is permitted according to governance.

---

RESEARCH

Execution allowed only for research purposes.

---

# Strategy

Strategy

A deterministic operational methodology.

Strategies never guarantee outcomes.

They only define execution criteria.

---

Kelly Engine

The institutional strategy evaluation program currently under development.

---

Strategy Registry

Institutional catalogue of available strategies.

---

Strategy Ranking

Ordered evaluation of candidate strategies.

---

# Execution

Execution

The operational act performed after governance approval.

---

Execution Gateway

Single authorized entry point for execution.

---

Execution Audit

Immutable record describing every execution attempt.

---

Execution Session

A runtime session containing one or more governed executions.

---

# Runtime

Runtime

The live operational environment.

---

Runtime Adapter

Transforms institutional decisions into executable runtime structures.

---

Runtime Enforcement

Guarantees that runtime cannot bypass governance.

---

Runtime Audit

Execution records generated during runtime.

---

# Audit

Audit

Institutional evidence describing what happened, when, why and under which conditions.

---

Audit Event

Single immutable audit record.

---

Audit Trail

Chronological sequence of audit events.

---

Traceability

Ability to reconstruct every decision.

---

# Risk

Risk

Quantitative operational uncertainty.

---

Risk Score

Normalized value representing evaluated operational risk.

---

Confidence Score

Normalized value representing confidence in the evaluated decision.

---

# Learning

Learning

Offline improvement process.

Learning never changes historical decisions.

---

Replay

Re-execution of historical sessions.

---

Paper Trading

Execution simulation without operational consequences.

---

# Quality

Deterministic

Always produces identical outputs for identical inputs.

---

Explainable

Every decision must provide explicit reasons.

---

Observable

Internal behavior can be inspected.

---

Auditable

Every action can be reconstructed.

---

Traceable

Every state transition has recorded evidence.

---

# AI

AI Agent

Artificial intelligence system collaborating with the project.

---

Architect Agent

Defines architecture.

Does not implement business logic.

---

Coder Agent

Implements code following architecture.

---

Reviewer Agent

Verifies correctness.

---

Auditor Agent

Verifies institutional compliance.

---

# Institutional Principles

Architecture before implementation.

Governance before execution.

Testing before delivery.

Documentation before completion.

Determinism before optimization.

Institutional quality before development speed.
