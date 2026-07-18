# RUNTIME TOPOLOGY

Generated: Tue Jun 23 21:22:32 -03 2026

## Critical Components

- PaperTestOperatorConsole
- LivePaperOrchestrator
- paper-operational-cli-mode-engine
- StrategyDecisionEngine

## Runtime Flow

PaperTestOperatorConsole
  -> LivePaperOrchestrator
     -> Analytics Engines
     -> Ledger
     -> Runtime Enforcement

paper-operational-cli-mode-engine
  -> Session Engines
  -> Risk Engines
  -> Bankroll Engines

StrategyDecisionEngine
  -> Decision Logic
