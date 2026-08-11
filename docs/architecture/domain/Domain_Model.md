====================================================================
RL.SYS CORE v5.x
DOMAIN MODEL
Institutional Domain Model
Version: 5.x
Status: APPROVED
====================================================================

PURPOSE

This document defines the official Domain Model of RL.SYS CORE.

It establishes the bounded contexts, domain services, entities,
value objects, application services and architectural boundaries
adopted by the institutional platform.

This document is the Single Source of Truth regarding the domain
structure.

====================================================================
ARCHITECTURAL PRINCIPLES
====================================================================

The entire platform follows:

- Clean Architecture

- Domain Driven Design (DDD)

- SOLID

- Dependency Inversion

- Composition over Inheritance

- Immutable Decision Flow

- Zero Defect Governance

- Public API Frozen

No component may bypass the official Runtime.

====================================================================
SYSTEM OVERVIEW
====================================================================

                           RL.SYS CORE

+--------------------------------------------------------------+
|                      APPLICATION LAYER                        |
+--------------------------------------------------------------+

                     IntelligenceRuntime
                              |
                              |
                              V

+--------------------------------------------------------------+
|                    DECISION APPLICATION                       |
+--------------------------------------------------------------+

DecisionIntelligenceCoordinator

ExplainabilityCoordinator

DecisionAuditLedger

                              |
                              V

+--------------------------------------------------------------+
|                      DOMAIN LAYER                             |
+--------------------------------------------------------------+

QuantitativeEnginePipeline

        |
        +--------------------------------------------------+
        |                    Engines                       |
        +--------------------------------------------------+

MarkovProbabilityEngine

ShannonEntropyEngine

OperationalVixEngine

ZScoreEngine

StrategyRankingEngine

DecisionIntelligenceEngine

ExplainabilityEngine

                              |
                              V

DecisionSummary

DecisionExplanation

                              |
                              V

DecisionAuditLedgerRepository

====================================================================
BOUNDED CONTEXTS
====================================================================

The system is divided into independent bounded contexts.

Each context owns its own responsibilities.

Cross-context communication must occur only through public contracts.

--------------------------------------------------------------------
1. Quantitative Intelligence
--------------------------------------------------------------------

Purpose

Execute statistical and mathematical analysis.

Responsibilities

- Probability estimation

- Entropy analysis

- Volatility analysis

- Statistical deviation

- Strategy ranking

Main Components

QuantitativeEnginePipeline

MarkovProbabilityEngine

ShannonEntropyEngine

OperationalVixEngine

ZScoreEngine

StrategyRankingEngine

Public Contracts

IQuantitativeEngine

IProbabilityEngine

IEntropyEngine

IVixEngine

IZScoreEngine

IStrategyRankingEngine

Outputs

QuantitativeOutput

====================================================================
2. Decision Intelligence
====================================================================

Purpose

Aggregate all quantitative outputs into one immutable decision model.

Responsibilities

- Aggregate quantitative engines

- Produce DecisionSummary

- Preserve immutability

Main Components

DecisionIntelligenceEngine

DecisionSummary

DecisionAnalysis

DecisionEvidence

Public Contract

IDecisionIntelligenceEngine

Output

DecisionSummary

====================================================================
3. Explainability
====================================================================

Purpose

Transform quantitative results into human-readable explanations.

Characteristics

Read-only.

No mathematical calculations.

No statistical recalculation.

No mutation of DecisionSummary.

Main Components

ExplainabilityEngine

ExplainabilityCoordinator

DecisionExplanation

DecisionReason

DecisionEvidenceBundle

DecisionTransparencyReport

DecisionConfidenceBreakdown

Public Contract

IExplainabilityEngine

Output

DecisionExplanation

====================================================================
4. Runtime Integration
====================================================================

Purpose

Provide a single institutional execution entry point for the entire
Decision Intelligence Core.

The Runtime is the official orchestration boundary between external
adapters and the internal domain.

No external component may invoke quantitative engines directly.

Responsibilities

- Receive IntelligenceExecutionContext

- Invoke QuantitativeEnginePipeline

- Invoke DecisionIntelligenceEngine

- Invoke ExplainabilityCoordinator

- Persist the execution in DecisionAuditLedger

- Produce IntelligenceExecutionResult

Main Components

IntelligenceRuntime

IntelligenceExecutionContext

IntelligenceExecutionResult

Characteristics

- Stateless

- Deterministic

- Immutable orchestration

- Single Point of Execution

Outputs

IntelligenceExecutionResult

====================================================================
5. Audit & Governance
====================================================================

Purpose

Guarantee traceability, reproducibility and institutional compliance
for every execution performed by the Runtime.

Responsibilities

- Persist immutable execution records

- Register execution metadata

- Store diagnostics

- Preserve execution evidence

- Support future regulatory audits

Main Components

DecisionAuditLedger

DecisionAuditLedgerRepository

SystemGovernancePolicy

Public Contract

IDecisionAuditLedger

Persistence

JSONL Append-Only Ledger

Characteristics

Immutable

Append-only

Auditable

Reproducible

====================================================================
DOMAIN AGGREGATES
====================================================================

Aggregate

DecisionSummary

Root Entity

DecisionSummary

Contains

DecisionAnalysis

DecisionEvidence

Strategy Rankings

Execution Metadata

Global Confidence

Diagnostics

Invariant

DecisionSummary is immutable after creation.

No downstream component may modify it.

--------------------------------------------------------------------

Aggregate

DecisionExplanation

Root Entity

DecisionExplanation

Contains

DecisionReason

DecisionEvidenceBundle

DecisionTransparencyReport

DecisionConfidenceBreakdown

Invariant

DecisionExplanation is always generated from an existing
DecisionSummary.

It never produces new quantitative calculations.

--------------------------------------------------------------------

Aggregate

IntelligenceExecutionResult

Root Entity

IntelligenceExecutionResult

Contains

DecisionSummary

DecisionExplanation

Audit Metadata

Runtime Metadata

Execution Status

Invariant

Represents one complete execution cycle.

====================================================================
APPLICATION SERVICES
====================================================================

QuantitativeEnginePipeline

Responsibilities

Execute all quantitative engines.

Produce standardized QuantitativeOutput objects.

Never perform orchestration outside quantitative execution.

--------------------------------------------------------------------

DecisionIntelligenceCoordinator

Responsibilities

Coordinate the DecisionIntelligenceEngine.

Translate application requests into immutable domain outputs.

Never execute statistical calculations directly.

--------------------------------------------------------------------

ExplainabilityCoordinator

Responsibilities

Coordinate ExplainabilityEngine.

Transform DecisionSummary into DecisionExplanation.

Never mutate DecisionSummary.

--------------------------------------------------------------------

IntelligenceRuntime

Responsibilities

Act as the official Runtime.

Coordinate the complete institutional execution flow.

Guarantee execution order.

Guarantee audit persistence.

Guarantee deterministic execution.

====================================================================
PUBLIC CONTRACTS
====================================================================

Frozen Contracts

IQuantitativeEngine

IProbabilityEngine

IEntropyEngine

IVixEngine

IZScoreEngine

IStrategyRankingEngine

IDecisionIntelligenceEngine

IExplainabilityEngine

IDecisionAuditLedger

These contracts are governed by the PUBLIC API FROZEN policy.

Structural modifications are prohibited.

Future evolution shall occur only through backward-compatible,
additive changes.

====================================================================
PRIMARY DOMAIN OBJECTS
====================================================================

QuantitativeInput

Institutional input model for quantitative execution.

Used by every quantitative engine.

--------------------------------------------------------------------

QuantitativeOutput

Standardized output produced by every quantitative engine.

Contains

Engine Name

Execution Metadata

Confidence

Metrics

Diagnostics

Result

--------------------------------------------------------------------

DecisionSummary

Official immutable decision package.

Produced only by DecisionIntelligenceEngine.

Consumed by:

ExplainabilityEngine

DecisionAuditLedger

IntelligenceRuntime

External adapters

--------------------------------------------------------------------

DecisionExplanation

Institutional transparency artifact.

Produced exclusively by ExplainabilityEngine.

Never replaces DecisionSummary.

Never modifies DecisionSummary.

--------------------------------------------------------------------

IntelligenceExecutionContext

Institutional Runtime input.

Represents one execution request.

--------------------------------------------------------------------

IntelligenceExecutionResult

Institutional Runtime output.

Represents one fully completed execution lifecycle.

====================================================================
DEPENDENCY RULES
====================================================================

Allowed Dependency Flow

Presentation
        |
        V
Application
        |
        V
Domain
        |
        V
Infrastructure (through abstractions only)

No dependency inversion violations are permitted.

The Domain Layer shall never depend on:

- CLI
- OCR
- Live Feed
- HUD
- Database
- External APIs
- Python
- AI Providers

====================================================================
EXECUTION FLOW
====================================================================

Official execution flow

External Adapter
        |
        V
IntelligenceRuntime
        |
        V
QuantitativeEnginePipeline
        |
        +----------------------------------------------+
        |                                              |
        V                                              V
Quantitative Engines                           QuantitativeOutput
        |
        V
DecisionIntelligenceEngine
        |
        V
DecisionSummary (Immutable)
        |
        +------------------------------+
        |                              |
        V                              V
ExplainabilityCoordinator      DecisionAuditLedger
        |                              |
        V                              V
DecisionExplanation             Audit Persistence
        |
        V
IntelligenceExecutionResult
        |
        V
Presentation Layer

This is the only officially supported execution flow.

====================================================================
ARCHITECTURAL INVARIANTS
====================================================================

The following invariants shall always remain true.

1.

DecisionSummary is immutable.

2.

Explainability is a downstream bounded context.

3.

Explainability consumes DecisionSummary in READ-ONLY mode.

4.

Explainability never recalculates quantitative engines.

5.

Explainability never changes scores, rankings or probabilities.

6.

Quantitative engines never know Explainability exists.

7.

DecisionIntelligenceEngine never depends on Explainability.

8.

Runtime is the Single Point of Execution.

9.

DecisionAuditLedger stores only finalized executions.

10.

All external integrations shall enter through
IntelligenceRuntime.

====================================================================
PUBLIC API FROZEN
====================================================================

The following public contracts are frozen.

IQuantitativeEngine

IProbabilityEngine

IEntropyEngine

IVixEngine

IZScoreEngine

IStrategyRankingEngine

IDecisionIntelligenceEngine

IExplainabilityEngine

IDecisionAuditLedger

QuantitativeInput

QuantitativeOutput

DecisionSummary

DecisionExplanation

Breaking changes are prohibited.

Future evolution must occur through optional,
backward-compatible extensions.

====================================================================
COMPUTATIONAL COMPLEXITY
====================================================================

QuantitativeEnginePipeline

Time

O(n)

Where n is the size of the analyzed sequence.

------------------------------------------------------------

DecisionIntelligenceEngine

Time

O(n)

Aggregates outputs produced by the quantitative engines.

------------------------------------------------------------

ExplainabilityEngine

Time

O(n)

Processes finalized analytical results.

No statistical recomputation.

------------------------------------------------------------

IntelligenceRuntime

Time

O(1)

Pure orchestration.

Overall execution complexity remains the aggregation of
the quantitative engines.

------------------------------------------------------------

DecisionAuditLedger

Append

O(1)

JSONL Append-Only persistence.

====================================================================
GOVERNANCE POLICIES
====================================================================

Zero Defect Governance

Every modification shall preserve backward compatibility.

Architecture Freeze

Approved architectural boundaries cannot be modified
without a new ADR.

PUBLIC API FROZEN

Public contracts are immutable.

Single Point of Execution

Every execution shall start at IntelligenceRuntime.

Read-Only Explainability

The Explainability bounded context shall never mutate
DecisionSummary.

Immutable Decision

DecisionSummary is the official institutional decision artifact.

====================================================================
CURRENT ARCHITECTURE STATUS
====================================================================

Core Quantitative Engines

IMPLEMENTED

Decision Intelligence

IMPLEMENTED

Explainability (XAI)

IMPLEMENTED

Runtime Integration

IMPLEMENTED

Audit Trail

IMPLEMENTED

Governance

IMPLEMENTED

Public API Freeze

ACTIVE

Architecture Freeze

ACTIVE

====================================================================
ARCHITECTURAL COMPLIANCE
====================================================================

Clean Architecture

APPROVED

Domain Driven Design

APPROVED

SOLID

APPROVED

Dependency Inversion

APPROVED

Circular Dependencies

APPROVED

Technical Debt

NONE DETECTED

====================================================================
FINAL STATEMENT
====================================================================

The RL.SYS CORE v5.x architecture is formally consolidated.

The IntelligenceRuntime is the official Single Point of Execution.

DecisionSummary remains strictly immutable.

Explainability is a downstream bounded context.

XAI does not recalculate quantitative engines.

All institutional execution flows shall pass through the
IntelligenceRuntime before being exposed to external adapters.

Status

APPROVED

Version

5.x

End of Document
