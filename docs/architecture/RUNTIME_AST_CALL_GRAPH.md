# RL.SYS CORE - RUNTIME AST CALL GRAPH ENGINE

Generated: auto

---

## 1. AST Extraction Summary

Total Structural Edges Detected: 25723

---

## 2. Component Call Participation

- Enforcement Paths: 57
- Decision Paths: 138
- Session Paths: 3208

---

## 3. Inferred Call Graph (Canonical)

Decision Layer
    ↓ (function invocation / dependency)
Session Layer
    ↓ (state orchestration)
Runtime State Machine
    ↓ (execution control flow)
RuntimeEnforcementOrchestrator
    ↓ (final execution gate)
Ledger Persistence Layer

---

## 4. Sovereignty Validation (AST-Level)

RULE:
- Any execution path MUST terminate at RuntimeEnforcementOrchestrator
- No direct Decision → Ledger writes allowed
- No Session → Ledger bypass allowed

---

## 5. Structural Risk Analysis

WARNING: Decision layer dominates structural call graph

---

## 6. Limitation Notice

This is a lightweight AST approximation using grep heuristics.

For true AST precision:
- Integrate ts-morph or TypeScript Compiler API
- Build full typed call graph
- Resolve dynamic imports and runtime dispatch

---

## 7. Recommendation

Upgrade to full AST parser for production-grade verification.

