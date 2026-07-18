# RL.Sys Aider Context

Generated automatically.

---

# Project Identity

# RL.SYS
## Project Definition

Version: 1.0.0

---

# Vision

RL.Sys is an institutional decision intelligence platform.

Its purpose is not to predict randomness.

Its purpose is to evaluate operational conditions, measure risk, govern decisions and execute deterministic workflows with complete auditability.

Every execution must be explainable.

Every decision must be reproducible.

Every component must be observable.

---

# Core Principles

• Deterministic execution

• Explainable decisions

• Complete audit trail

• Modular architecture

• Test-first development

• Institutional code quality

---

# Architectural Style

The project follows Clean Architecture.

Dependency flow:

Presentation
↓

Infrastructure
↓

Application
↓

Domain

Only inward dependencies are allowed.

---

# Main Domains

Current institutional domains include:

• Decision

• Strategy

• Governance

• Execution

• Audit

• Risk

• Paper Trading

• Learning

• Runtime

• Security

Future domains may be added without violating existing contracts.

---

# Layer Responsibilities

Domain

Business rules.

Pure logic.

No infrastructure.

---

Application

Use cases.

Orchestration.

DTOs.

Services.

---

Infrastructure

Persistence.

Adapters.

External integrations.

Filesystem.

Runtime services.

---

Presentation

CLI.

Dashboard.

Terminal.

API.

PWA.

---

# Development Rules

Business logic belongs to Domain.

Application coordinates.

Infrastructure implements.

Presentation displays.

Never invert responsibilities.

---

# Quality Gates

Every Sprint must satisfy:

✓ TypeScript compilation

✓ Unit tests

✓ Deterministic behavior

✓ Architectural compliance

✓ Documentation update

---

# Project Goal

The long-term objective is to evolve RL.Sys into a fully auditable institutional decision platform with deterministic execution, governance enforcement and complete operational traceability.

---

# Vision

# RL.SYS
## Vision Statement

Version: 1.0.0

Status:
Official

---

# Vision

RL.Sys is an institutional Decision Intelligence Platform.

Its mission is to assist human decision making through deterministic analysis, governance and complete operational traceability.

RL.Sys does not attempt to predict random events.

Instead, it evaluates operational conditions and determines whether an action should be permitted according to institutional governance rules.

Every recommendation must be explainable.

Every execution must be auditable.

Every decision must be reproducible.

---

# Purpose

RL.Sys exists to transform operational uncertainty into governed decision processes.

The platform continuously evaluates evidence, applies deterministic rules and produces decisions that can always be reconstructed.

---

# Long-Term Objectives

The platform shall evolve into a complete Decision Intelligence ecosystem capable of:

• Decision Governance

• Risk Assessment

• Runtime Enforcement

• Execution Control

• Auditability

• Explainability

• Learning

• Paper Trading

• Enterprise Supervision

Every capability must preserve institutional quality.

---

# Core Values

Reliability

Determinism

Transparency

Traceability

Integrity

Governance

Security

Modularity

Auditability

Maintainability

---

# What RL.Sys Is

RL.Sys is:

• a Decision Intelligence Platform

• a Governance Engine

• a Risk Evaluation Platform

• an Explainable Decision System

• an Institutional Architecture

---

# What RL.Sys Is Not

RL.Sys is not:

• a prediction engine

• a gambling bot

• an autonomous betting system

• a random signal generator

• an AI that replaces human judgment

The final operational decision always belongs to the operator.

---

# Architectural Philosophy

Architecture has authority over implementation.

Institutional consistency has priority over development speed.

Every Sprint must improve the architecture.

No Sprint may compromise existing guarantees.

---

# Engineering Philosophy

Code must be:

Simple

Deterministic

Observable

Testable

Explainable

Strongly Typed

Modular

Reusable

Every component must have a single responsibility.

---

# AI Collaboration

Artificial Intelligence is an engineering assistant.

AI proposes.

Architecture decides.

Governance validates.

Tests verify.

Only then is software accepted.

---

# Future

The long-term objective is to transform RL.Sys into an institutional platform where every decision is:

Governed

Auditable

Explainable

Reproducible

Trustworthy

without sacrificing simplicity, maintainability or architectural integrity.

---

# Glossary

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

---

# Agent Rules

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

---

# Architecture Standards

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

---

# Testing Standards

RL.SYS

Testing Standards

Version: 1.0.0

Status: Official

---

Purpose

This document defines the mandatory testing standards for RL.Sys.

Every implementation change must include validation.

A feature is not considered complete only because the code compiles.

A feature is complete when behavior is verified.

---

Testing Philosophy

RL.Sys follows the engineering principle:

Implementation → Compilation → Automated Validation → Behavior Confirmation → Commit

The objective is not only to create working code, but to preserve system stability, predictability and maintainability.

---

Required Validation Pipeline

Every Sprint implementation must follow the validation sequence below.

---

1. Syntax Validation

Before executing installation scripts, syntax must be verified.

Shell scripts must be validated before execution.

Example command:

bash -n install/sprints/run-sprint-name.sh

Syntax failures must be resolved before continuing.

---

2. Permission Validation

Executable Sprint files must have correct permissions.

Example command:

chmod +x install/sprints/run-sprint-name.sh

A Sprint installer without execution permission is not considered ready.

---

3. Sprint Execution

The Sprint installer must execute successfully.

Example command:

bash install/sprints/run-sprint-name.sh

Expected results:

- required files created
- expected directories updated
- compilation completed
- no unexpected failures

---

4. TypeScript Compilation

Every TypeScript modification requires compilation validation.

Command:

npx tsc

Compilation errors block Sprint completion.

Broken contracts must never be ignored.

---

5. Automated Tests

Every behavior change requires automated tests.

Tests must validate:

- expected behavior
- failure scenarios
- edge conditions
- backward compatibility

Example command:

node --test tests/component-name.test.js

Compilation success alone is not enough.

---

Test Types

Unit Tests

Unit tests validate isolated components.

Examples:

- services
- engines
- adapters
- validators

They must verify:

- inputs
- outputs
- business behavior
- error conditions

---

Integration Tests

Integration tests validate cooperation between system components.

Examples:

- decision pipeline
- runtime execution
- persistence flow
- governance chain

They verify that system contracts remain valid.

---

Test Naming Standards

Test names must describe the behavior being validated.

Examples:

decision-governance-enforcement.test.js

decision-execution-gateway.test.js

decision-execution-audit-bridge.test.js

Avoid generic names.

Examples:

test1.js

sample.test.js

---

Test Structure

Tests should follow:

Arrange

Preparation of the scenario.

Act

Execution of the behavior.

Assert

Verification of the expected result.

Tests must validate behavior instead of implementation details.

---

Regression Protection

Every bug fix must include a regression test.

A fixed problem without a test may return in future changes.

The test suite represents institutional memory.

---

Sprint Completion Criteria

A Sprint is complete only when:

- implementation exists
- compilation succeeds
- tests pass
- changes are committed
- repository state is understood

---

AI Implementation Rules

AI agents working on RL.Sys must:

1. Create tests whenever behavior changes.

2. Validate generated code through compilation.

3. Execute tests before declaring completion.

4. Report failures honestly.

5. Never remove tests to bypass failures.

---

Forbidden Practices

Never:

- skip validation
- commit failing code
- ignore compiler errors
- replace automated tests with manual verification only
- modify behavior without validation

---

Continuous Improvement

Testing standards evolve with the architecture.

New patterns must be documented before becoming mandatory.

---

Final Principle

In RL.Sys:

Verified behavior is the only accepted behavior.

Code without validation is incomplete.

---

# TypeScript Standards

RL.SYS

TypeScript Standards

Version: 1.0.0

Status:
Official

---

Purpose

This document defines the mandatory TypeScript development standards for RL.Sys.

All TypeScript code generated, modified, or reviewed inside the project must follow these rules.

Architecture and maintainability have priority over implementation speed.

---

Core Principles

TypeScript code must prioritize:

- Readability
- Explicit behavior
- Strong typing
- Deterministic execution
- Maintainability
- Testability

Simple and understandable code is preferred over unnecessary abstraction.

---

Type Safety

Strict typing is mandatory.

Avoid:

- "any"
- implicit types in public contracts
- unsafe type casting
- hidden nullable values
- dynamic objects without contracts

Prefer:

- interfaces
- explicit return types
- readonly properties
- typed DTOs
- domain contracts

Example:

interface DecisionResult {
  readonly decisionId: string;
  readonly allowed: boolean;
}

---

Naming Conventions

Classes

Use PascalCase.

Example:

class DecisionGovernanceEngine {}

---

Interfaces

Use descriptive names.

Example:

interface DecisionSnapshot {}

Do not use prefixes:

interface IDecisionSnapshot {}

---

Methods

Use camelCase.

Examples:

evaluateDecision()

createAuditEvent()

validateGovernance()

---

Constants

Use uppercase with underscore separation.

Example:

const MAX_RISK_SCORE = 1.0;

---

Class Design

Classes must have a single responsibility.

Avoid:

- large classes with multiple purposes
- hidden state changes
- unrelated methods
- excessive inheritance

Prefer:

- composition
- small focused services
- explicit dependencies

---

Immutability

Prefer immutable structures.

Use "readonly" whenever possible.

Example:

interface GovernanceSnapshot {

  readonly decisionId: string;

  readonly operationalGate: string;

  readonly allowed: boolean;

}

---

Constructors

Constructors must initialize dependencies only.

Avoid:

- business decisions
- external calls
- complex calculations

Example:

Good:

constructor(
  private readonly adapter: DecisionAdapter
) {}

---

Business Logic Location

Business rules must not exist in:

- UI components
- controllers
- CLI handlers
- infrastructure adapters

Business logic belongs to:

- Domain layer
- Application layer

---

Error Handling

Errors must be explicit and traceable.

Avoid:

try {

}
catch {

}

Errors should contain:

- context
- reason
- operation information

Every important failure must be diagnosable.

---

Async Standards

Prefer:

async/await

Avoid unnecessary promise chains.

Example:

const result = await service.execute();

---

DTO Standards

DTOs represent contracts only.

DTOs must not contain:

- business rules
- calculations
- persistence logic

---

Dependency Rules

Classes must receive dependencies explicitly.

Avoid:

- global state
- hidden imports for execution behavior
- static mutable state

Prefer dependency injection.

---

Export Standards

Exports must be intentional.

Avoid uncontrolled exports.

Every public component must have a clear purpose.

---

Comments

Comments must explain:

- why something exists
- architectural decisions
- non-obvious constraints

Avoid comments that only repeat the code.

Bad:

// Increment counter
counter++;

Good:

// Counter is incremented to preserve execution ordering in audit replay.
counter++;

---

Testing Compatibility

Every important component must be independently testable.

Avoid:

- environment dependency
- filesystem dependency inside business logic
- hidden initialization

---

AI Code Generation Rules

AI-generated code must:

1. Follow existing project architecture.
2. Reuse existing abstractions.
3. Avoid duplicate implementations.
4. Include tests when behavior changes.
5. Preserve backward compatibility.

---

Review Criteria

Before accepting TypeScript changes, verify:

- Is responsibility clear?
- Is typing explicit?
- Is behavior deterministic?
- Is testing possible?
- Does it respect architecture?

---

Final Principle

TypeScript code in RL.Sys must be predictable, explainable, maintainable and understandable by another engineer without depending on AI interpretation.

---

# AI Workflow Contract

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

---

Context ready for Aider.
