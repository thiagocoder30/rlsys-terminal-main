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
