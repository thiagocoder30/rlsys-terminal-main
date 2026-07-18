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

