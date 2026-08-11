# RL.SYS CORE v5.x - Architecture Baseline V5

## Visão Geral
Este documento estabelece o congelamento arquitetural (Architecture Freeze) do RL.SYS CORE v5.x.
O sistema segue os princípios de Clean Architecture e Domain Driven Design (DDD) com foco em proteção patrimonial e análise quantitativa (Decision Intelligence).

## Camadas Arquiteturais

### 1. Domain (`src/domain`)
- **Responsabilidade**: Entidades, contratos, regras de negócio e Value Objects.
- **Acoplamento**: Totalmente desacoplado de bibliotecas externas e frameworks de infraestrutura.
- **Governança**: Define as regras imutáveis de "Paper Trading" obrigatório e "Hard Stops" (BankrollSafetyGate).

### 2. Application (`src/application`)
- **Responsabilidade**: Casos de uso e orquestração de fluxos (LivePaperOrchestrator, etc.).
- **Acoplamento**: Interage apenas com o domínio e utiliza contratos para inversão de dependência da infraestrutura.

### 3. Infrastructure (`src/infrastructure`)
- **Responsabilidade**: Integrações externas, persistência local/JSONL (DecisionAuditLedger), e motores Python para captura (OCR/Gemini SDK).
- **Acoplamento**: Implementa os contratos definidos no domínio.

### 4. Presentation (`src/presentation`)
- **Responsabilidade**: Interfaces de terminal (CLI), Heads-Up Display (HUD) e PWA para o operador.
- **Acoplamento**: Consome os casos de uso da camada de Application.

## Diretrizes de Governança Zero Defect
- O sistema opera primariamente em **Paper Trading**.
- A execução financeira de risco real está **bloqueada** através de restrições rígidas (`SystemGovernancePolicy`).
- O **DecisionAuditLedger** garante trilha imutável (JSONL + SHA-256) das análises estatísticas e alertas gerados.

## Risco Institucional
- **Drawdown Máximo Diário**: -15%
- **Profit Lock Diário**: +25%
- Componentes responsáveis: `BankrollSafetyGate`, `DailyRiskLockRecoveryCoordinator`.

*(Congelamento oficial realizado na Sprint 001)*
