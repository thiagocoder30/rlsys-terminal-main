# RL.SYS CORE - RUNTIME INSTRUMENTATION LAYER REPORT

Generated: auto

---

## 1. Execution Entry Points Detected

Entry Points (approx): 2325

---

## 2. Runtime Component Exposure

- Enforcement Layer Hits: 6
- Decision Layer Hits: 908
- Session Layer Hits: 1918
- Ledger Layer Hits: 434

---

## 3. Instrumentation Model

This layer approximates runtime execution by identifying:

- potential entry points (bootstrap/init/run)
- enforcement invocation presence
- session orchestration paths
- ledger persistence interactions

---

## 4. Runtime Flow Model (Observed Approximation)

Input
  ↓
Decision Engine
  ↓
Session Coordinator
  ↓
Runtime State Machine
  ↓
RuntimeEnforcementOrchestrator
  ↓
Ledger Persistence

---

## 5. Sovereignty Validation Rule

Execution is valid ONLY if:

RuntimeEnforcementOrchestrator appears in final stage of flow.

Any bypass is considered INVALID execution design.

---

## 6. Instrumentation Risk Assessment

HIGH: Decision layer dominates runtime exposure

---

## 7. Limitations

This is a static instrumentation approximation.

True runtime instrumentation requires:
- function interception (proxy / decorators)
- runtime hooks
- execution tracing in Node runtime
- event-level logging

---

## 8. Recommendation

Upgrade to active runtime hooks for full observability.

