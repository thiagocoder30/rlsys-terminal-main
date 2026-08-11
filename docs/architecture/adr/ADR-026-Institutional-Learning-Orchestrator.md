# ADR-026 — Institutional Learning Orchestrator Architecture (ILOA)

Status: ACCEPTED

Data: 2026-07-28

Autores:
RL.SYS CORE Architecture Board

---

# Contexto

Após a conclusão das seguintes arquiteturas:

ADR-019 — Live Session Architecture

ADR-020 — Market Regime Detection

ADR-021 — Dynamic Strategy Weight Calibration

ADR-022 — Shadow Paper Trading Simulation

ADR-023 — Intelligence Feedback Governance

ADR-024 — Advanced Decision Replay

ADR-025 — Institutional Knowledge Base

o RL.SYS CORE já possui capacidade institucional para:

• executar decisões;
• acompanhar sessões;
• detectar regimes;
• calibrar pesos;
• simular operações;
• validar evidências;
• reconstruir decisões;
• catalogar conhecimento institucional.

Entretanto, todas essas camadas permanecem independentes.

Ainda não existe uma arquitetura responsável por transformar todo esse conhecimento em aprendizado institucional contínuo.

É necessária uma camada superior responsável por consolidar evidências históricas, conhecimento institucional e feedback validado sem alterar qualquer motor quantitativo.

Essa camada constitui o Institutional Learning Orchestrator (ILOA).

---

# Decisão

Será criada uma nova camada institucional denominada:

Institutional Learning Orchestrator (ILOA)

Sua responsabilidade será exclusivamente observacional.

O ILOA NÃO poderá:

• alterar o IntelligenceRuntime;
• alterar o QuantitativeEnginePipeline;
• alterar Recommendation Engine;
• alterar Market Regime;
• alterar Session Performance;
• alterar Shadow Engine;
• alterar Replay Engine;
• alterar Knowledge Base;
• alterar pesos do DSWC;
• alterar motores matemáticos;
• alterar regras estatísticas;
• criar decisões.

Sua função será apenas consolidar conhecimento institucional validado.

---

# Objetivos

Responder continuamente:

"O que o RL.SYS aprendeu até agora?"

e

"Quais conhecimentos podem ser considerados institucionalmente confiáveis?"

---

# Responsabilidades

O ILOA deverá:

• consumir snapshots existentes;

• consolidar evidências;

• consolidar padrões;

• consolidar feedback aprovado;

• consolidar replay histórico;

• consolidar conhecimento catalogado;

• produzir indicadores institucionais;

• publicar relatórios consolidados.

Jamais produzir decisões operacionais.

---

# Fontes de Informação

O ILOA poderá consumir exclusivamente:

SessionPerformanceSnapshot

MarketRegimeSnapshot

StrategyWeightSnapshot

ShadowPerformanceSnapshot

EvidenceSnapshot

DecisionReplaySnapshot

KnowledgeSnapshot

Nenhuma outra fonte será permitida.

---

# Fluxo Arquitetural

Session Performance
        │
Market Regime
        │
Dynamic Calibration
        │
Shadow Engine
        │
Feedback Governance
        │
Replay Engine
        │
Knowledge Base
        │
        ▼
Institutional Learning Orchestrator
        │
        ▼
Institutional Learning Snapshot
        │
        ▼
Decision Ledger (Append Only)
        │
        ▼
Operator Console (Thin Client)

---

# Eventos Consumidos

O ILOA poderá consumir apenas:

SESSION_PERFORMANCE_UPDATED

MARKET_REGIME_UPDATED

STRATEGY_WEIGHT_UPDATED

SHADOW_PERFORMANCE_UPDATED

FEEDBACK_APPROVED

REPLAY_COMPLETED

KNOWLEDGE_UPDATED

Nenhum outro evento.

---

# Eventos Produzidos

Poderá produzir exclusivamente:

INSTITUTIONAL_LEARNING_UPDATED

LEARNING_SNAPSHOT_CREATED

LEARNING_SUMMARY_UPDATED

Todos gravados no DecisionLedger.

---

# Snapshot Institucional

Cada snapshot deverá conter minimamente:

timestamp

sessionId

knowledgeScore

evidenceScore

replayScore

shadowScore

calibrationScore

performanceScore

overallLearningIndex

learningStability

hash SHA-256

Todos os snapshots deverão ser imutáveis.

---

# Requisitos Arquiteturais

Atualização incremental O(1).

Sem reprocessamento histórico.

Sem loops retroativos.

Sem alterar snapshots anteriores.

Append Only obrigatório.

---

# Frontend

O Frontend permanecerá Thin Client.

Receberá exclusivamente DTOs.

Nenhum cálculo será realizado no React.

---

# Governança

Mantém obrigatoriamente:

✓ IntelligenceRuntime como Single Point of Execution.

✓ QuantitativeEnginePipeline intacto.

✓ Adaptive Intelligence intacta.

✓ EnsembleDecisionEngine intacto.

✓ Market Regime Engine intacto.

✓ Session Performance intacto.

✓ Shadow Engine intacto.

✓ Replay Engine intacto.

✓ Knowledge Base intacta.

✓ DecisionLedger Append Only.

✓ SnapshotManager imutável.

✓ RuntimeTelemetry desacoplado.

✓ RuntimeEventBus unidirecional.

✓ Paper Trading Only.

✓ ProductionMoneyAllowed=false.

---

# Consequências

Positivas

• Consolidação institucional do conhecimento.

• Evolução organizada da plataforma.

• Base para inteligência estratégica.

• Maior rastreabilidade.

• Aprendizado institucional contínuo.

Negativas

• Pequeno aumento no consumo de memória para snapshots consolidados.

• Necessidade de sincronização entre múltiplas camadas observacionais.

Esses impactos são considerados aceitáveis.

---

# Relação com ADRs anteriores

ADR-019 — Live Session

ADR-020 — Market Regime

ADR-021 — Dynamic Calibration

ADR-022 — Shadow Simulation

ADR-023 — Feedback Governance

ADR-024 — Decision Replay

ADR-025 — Knowledge Base

Esta ADR cria a camada imediatamente superior de consolidação institucional.

---

# Sprint vinculada

SPRINT-034

Institutional Learning Orchestrator (ILOA)

---

Fim da ADR-026
