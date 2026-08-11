# RL.SYS CORE CONTEXT

## Purpose

RL.SYS is an institutional research and decision-support platform.

## Architecture Principles

- Domain Driven Design
- Clean Architecture
- Immutable contracts
- Explicit interfaces
- Auditability
- Governance before execution

## Main Layers

src/domain
- Business rules
- Engines
- Mathematical models

src/application
- Use cases
- Services
- Orchestration

src/infrastructure
- External integrations
- Persistence

src/presentation
- CLI/UI adapters

## Development Rules

- Never introduce hidden business logic
- Prefer readonly contracts
- Separate contracts from implementations
- Every important decision must be auditable
- Tests are mandatory for new capabilities
