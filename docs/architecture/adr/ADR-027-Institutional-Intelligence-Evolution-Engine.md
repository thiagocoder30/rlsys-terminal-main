# ADR-027 — Institutional Intelligence Evolution Engine (IIEE)

Status: ACCEPTED

Data: 2026-07-28

Autor: RL.SYS CORE Architecture Board

Projeto:
RL.SYS CORE v5.x

Relacionamentos:

ADR-001 — Clean Architecture

ADR-002 — Domain Driven Design

ADR-003 — Thin Client Architecture

ADR-004 — Runtime Event Bus

ADR-005 — Decision Ledger

ADR-006 — Intelligence Runtime

ADR-007 — Quantitative Engine Pipeline

ADR-008 — Adaptive Intelligence

ADR-009 — Ensemble Decision Engine

ADR-010 — Strategy Recommendation Engine

ADR-011 — Session Performance

ADR-012 — Market Regime Detection

ADR-013 — Dynamic Strategy Weight Calibration

ADR-014 — Shadow Paper Trading

ADR-015 — Decision Replay

ADR-016 — Institutional Knowledge Base

ADR-017 — Institutional Learning Engine

ADR-023 — Intelligence Feedback Governance

ADR-024 — Decision Replay & Explainability

ADR-025 — Institutional Knowledge Base

ADR-026 — Institutional Learning Engine

---

# Contexto

Após a consolidação das camadas de:

• Performance

• Market Regime

• Dynamic Strategy Weight Calibration

• Shadow Paper Trading

• Feedback Governance

• Decision Replay

• Institutional Knowledge Base

• Institutional Learning Engine

o RL.SYS CORE já possui capacidade de observar, registrar, explicar e aprender continuamente.

Entretanto, ainda não existe uma camada responsável por medir a evolução global da inteligência institucional ao longo do tempo.

Hoje existem indicadores isolados.

Não existe uma visão consolidada da maturidade operacional do sistema.

A arquitetura necessita de um mecanismo institucional capaz de responder perguntas como:

- A inteligência do sistema está evoluindo ou degradando?
- O aprendizado institucional está produzindo ganhos reais?
- O conhecimento acumulado está aumentando a qualidade das decisões?
- A estabilidade operacional melhora ao longo das sessões?
- A capacidade adaptativa está crescendo?

Esta responsabilidade não pertence ao Runtime nem aos motores quantitativos.

Ela constitui uma nova camada institucional de observação estratégica.

---

# Decisão

Será criada a Sprint-035:

Institutional Intelligence Evolution Engine (IIEE)

Esta camada será exclusivamente observacional.

Ela consolidará indicadores provenientes de todas as camadas institucionais anteriores para produzir um índice global de evolução da inteligência do RL.SYS CORE.

O IIEE nunca modificará decisões.

Nunca alterará pesos.

Nunca recalibrará motores.

Nunca influenciará recomendações.

Sua responsabilidade será exclusivamente medir, consolidar, auditar e expor a evolução institucional.

---

# Estrutura Arquitetural

Criar:

src/application/evolution/

com os seguintes componentes:

InstitutionalEvolutionEngine

EvolutionSnapshot

EvolutionAggregator

EvolutionHistory

EvolutionIndexCalculator

EvolutionReportService

---

# Responsabilidades

InstitutionalEvolutionEngine

- Orquestrador principal.
- Consome eventos do ObservabilityEventBus.
- Coordena toda a camada.

EvolutionAggregator

Responsável por consolidar indicadores provenientes de:

Institutional Learning Engine

Knowledge Base

Feedback Governance

Shadow Engine

Session Performance

Market Regime

Dynamic Strategy Weight Calibration

Decision Replay

EvolutionIndexCalculator

Calcula indicadores institucionais, incluindo:

Institutional Intelligence Index

Learning Efficiency

Knowledge Growth

Adaptive Stability

Decision Quality Trend

Institutional Consistency

Operational Evolution Score

Todos os cálculos devem possuir atualização incremental O(1).

EvolutionSnapshot

Objeto imutável.

Deverá conter:

timestamp

sessionId

institutionalIntelligenceIndex

learningEfficiency

knowledgeGrowth

adaptiveStability

decisionQualityTrend

operationalEvolutionScore

hash SHA-256

Todos os snapshots deverão ser congelados (Object.freeze).

EvolutionHistory

Histórico FIFO.

Capacidade máxima:

100 snapshots.

Complexidade:

O(1).

EvolutionReportService

Camada somente leitura.

Responsável por fornecer DTOs para:

GET /api/operator/evolution

GET /api/operator/evolution/history

---

# Fluxo Arquitetural

Institutional Learning Engine
            │
Knowledge Base
            │
Feedback Governance
            │
Shadow Engine
            │
Session Performance
            │
Market Regime
            │
Dynamic Strategy Weight Calibration
            │
Decision Replay
            │
            ▼
EvolutionAggregator
            │
            ▼
EvolutionIndexCalculator
            │
            ▼
EvolutionSnapshot
            │
            ▼
DecisionLedger (Append Only)
            │
            ▼
EvolutionReportService
            │
            ▼
Operator Console (Thin Client)

---

# Runtime

O Institutional Evolution Engine deverá consumir exclusivamente eventos já existentes:

SESSION_UPDATED

PERFORMANCE_UPDATED

MARKET_REGIME_UPDATED

SHADOW_PERFORMANCE_UPDATED

LEARNING_SNAPSHOT_CREATED

KNOWLEDGE_SNAPSHOT_CREATED

FEEDBACK_EVIDENCE_APPROVED

DECISION_REPLAY_CREATED

Nunca criar um Runtime paralelo.

Nunca executar polling.

Nunca acessar diretamente motores quantitativos.

---

# Decision Ledger

Registrar apenas eventos novos:

EVOLUTION_SNAPSHOT_CREATED

EVOLUTION_INDEX_UPDATED

INSTITUTIONAL_EVOLUTION_UPDATED

Todos contendo:

timestamp

sessionId

hash SHA-256

Nunca modificar registros existentes.

---

# Frontend

Continuará seguindo Thin Client.

Criar apenas DTOs.

Nunca realizar cálculos.

OperatorConsole exibirá:

Institutional Intelligence Index

Operational Evolution

Knowledge Growth

Learning Efficiency

Adaptive Stability

Decision Quality Trend

Todos os valores deverão vir exclusivamente da API.

---

# Restrições Arquiteturais

É proibido:

Modificar IntelligenceRuntime.

Modificar QuantitativeEnginePipeline.

Modificar Adaptive Intelligence.

Modificar Ensemble Decision Engine.

Modificar Strategy Recommendation Engine.

Modificar Shadow Engine.

Modificar Replay Engine.

Modificar Knowledge Base.

Modificar Learning Engine.

Modificar Feedback Governance.

Modificar DSWC.

Modificar Market Regime.

Executar operações financeiras.

Criar conexões externas.

Executar qualquer cálculo no frontend.

---

# Requisitos Não Funcionais

Atualização incremental O(1).

Snapshots imutáveis.

Decision Ledger Append Only.

Sem dependências circulares.

100% compatível com Paper Trading Only.

Zero impacto sobre o Runtime principal.

---

# Consequências

Benefícios:

• Visão institucional consolidada da evolução da inteligência.

• Auditoria longitudinal da maturidade operacional.

• Indicadores executivos para evolução contínua.

• Base para futuras camadas de governança estratégica.

Custos:

• Nova camada observacional.

• Novos DTOs.

• Novos snapshots.

• Ampliação controlada do EventBus.

---

# Critérios de Aceitação

A Sprint-035 será considerada homologada apenas se:

✓ IntelligenceRuntime permanecer Single Point of Execution.

✓ QuantitativeEnginePipeline permanecer intacto.

✓ Nenhuma lógica quantitativa for movida para o frontend.

✓ RuntimeEventBus permanecer unidirecional.

✓ DecisionLedger permanecer Append Only.

✓ Snapshots permanecerem imutáveis.

✓ Frontend permanecer Thin Client.

✓ Paper Trading Only permanecer ativo.

✓ ProductionMoneyAllowed permanecer false.

✓ Build TypeScript sem erros.

✓ Vitest 100% aprovado.

✓ Madge sem dependências circulares.

✓ Todos os indicadores forem calculados exclusivamente no backend.
