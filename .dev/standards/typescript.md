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
