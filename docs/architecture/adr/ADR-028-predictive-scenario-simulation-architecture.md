# ADR-028 — Predictive Scenario Simulation Architecture

Status: ACCEPTED

Data: 2026-07-28

Autor: RL.SYS CORE Architecture Board

Sprint relacionada:
SPRINT-036 — Predictive Scenario Simulation

---

# Contexto

Após a conclusão das seguintes camadas institucionais:

• Shadow Paper Trading Simulation Engine
• Intelligence Feedback Governance
• Advanced Decision Replay Engine
• Institutional Knowledge Base
• Institutional Learning Engine
• Institutional Intelligence Evolution Engine

o RL.SYS CORE passa a possuir conhecimento suficiente para realizar simulações prospectivas de cenários sem interferir na operação do Runtime.

A arquitetura institucional determina que toda previsão seja realizada exclusivamente por observação, utilizando dados históricos já auditados e consolidados, preservando o IntelligenceRuntime como único executor operacional.

Esta ADR estabelece a arquitetura oficial da camada Predictive Scenario Simulation.

---

# Problema

Atualmente o sistema consegue responder:

"O que aconteceu?"

"O que aprendemos?"

"O quanto evoluímos?"

Entretanto ainda não consegue responder:

"O que provavelmente acontecerá caso o cenário atual permaneça?"

ou

"Quais são os cenários possíveis para os próximos giros?"

Sem esta camada a inteligência permanece retrospectiva.

---

# Decisão

Será criada uma nova camada institucional denominada:

Predictive Scenario Simulation Engine (PSSE)

Esta camada será exclusivamente observacional.

Ela nunca poderá:

• gerar recomendações;

• alterar pesos;

• alterar estratégias;

• modificar motores quantitativos;

• substituir qualquer decisão do IntelligenceRuntime.

Sua responsabilidade será apenas construir projeções estatísticas futuras baseadas em conhecimento institucional consolidado.

---

# Objetivos

A nova camada deverá:

• construir cenários prospectivos;

• estimar probabilidade de ocorrência;

• comparar múltiplos cenários;

• medir confiança das projeções;

• registrar todas as previsões no DecisionLedger;

• fornecer informações exclusivamente consultivas ao operador.

---

# Restrições Arquiteturais

Continuam obrigatórios:

IntelligenceRuntime

Single Point of Execution.

QuantitativeEnginePipeline

Permanece intacto.

Adaptive Intelligence

Permanece intacta.

StrategyRecommendationEngine

Permanece intacto.

MarketRegimeEngine

Permanece intacto.

SessionPerformanceEngine

Permanece intacto.

Dynamic Strategy Weight Calibration

Permanece intacta.

Feedback Governance

Permanece intacta.

Decision Replay

Permanece intacto.

Knowledge Base

Permanece intacta.

Learning Engine

Permanece intacto.

Evolution Engine

Permanece intacto.

Shadow Paper Trading

Permanece intacto.

DecisionLedger

Append Only.

RuntimeTelemetry

Desacoplado.

RuntimeEventBus

Unidirecional.

SnapshotManager

Imutável.

Frontend

Thin Client.

Paper Trading Only

Obrigatório.

ProductionMoneyAllowed=false

Obrigatório.

---

# Estrutura Esperada

src/application/predictive/

Arquivos previstos:

PredictiveScenarioEngine.ts

ScenarioGenerator.ts

ScenarioProbabilityCalculator.ts

ScenarioSnapshot.ts

ScenarioHistory.ts

PredictiveReportService.ts

---

# Responsabilidades

## PredictiveScenarioEngine

Orquestrar toda a simulação prospectiva.

Consumir exclusivamente eventos existentes.

Jamais produzir recomendações.

---

## ScenarioGenerator

Construir cenários possíveis considerando:

• regime atual;

• performance recente;

• evolução institucional;

• conhecimento consolidado;

• replay histórico.

---

## ScenarioProbabilityCalculator

Calcular probabilidades para cada cenário.

As probabilidades deverão ser normalizadas.

---

## ScenarioSnapshot

Representar um cenário previsto.

Snapshots deverão ser:

• imutáveis;

• auditáveis;

• assinados com SHA-256.

---

## ScenarioHistory

Manter histórico FIFO.

Capacidade fixa.

Atualização O(1).

---

## PredictiveReportService

Disponibilizar DTOs para consulta.

Nenhum cálculo será realizado no frontend.

---

# Integração

A camada deverá consumir somente eventos existentes.

Eventos permitidos:

PERFORMANCE_UPDATED

MARKET_REGIME_UPDATED

LEARNING_UPDATED

KNOWLEDGE_UPDATED

EVOLUTION_UPDATED

SESSION_UPDATED

ROUND_PROCESSED

Nenhum novo fluxo paralelo poderá ser criado.

---

# Fluxo Arquitetural

Knowledge Base

↓

Learning Engine

↓

Evolution Engine

↓

Predictive Scenario Engine

↓

Scenario Snapshot

↓

DecisionLedger

↓

Operator API

↓

Thin Client

---

# Decision Ledger

Registrar:

PREDICTIVE_SCENARIO_CREATED

SCENARIO_SNAPSHOT_CREATED

SCENARIO_CONFIDENCE_UPDATED

Todos os registros deverão possuir:

timestamp

sessionId

scenarioId

confidence

hash SHA-256

---

# HTTP

Endpoints previstos:

GET /api/operator/predictive

GET /api/operator/predictive/history

---

# Frontend

Novo painel institucional:

PREDICTIVE SCENARIO SIMULATION

Indicadores mínimos:

• cenário dominante;

• confiança;

• distribuição de probabilidades;

• horizonte previsto;

• estabilidade da previsão.

O React deverá apenas renderizar DTOs.

Nenhum cálculo poderá existir no frontend.

---

# Princípios

Esta camada não substitui o Recommendation Engine.

Ela não influencia decisões.

Ela apenas fornece capacidade prospectiva institucional.

Toda previsão é consultiva.

Toda execução continua pertencendo exclusivamente ao IntelligenceRuntime.

---

# Consequências

Benefícios:

• inteligência prospectiva;

• maior capacidade analítica;

• preparação para inteligência multi-sessão;

• preservação completa da arquitetura institucional.

Custos:

• aumento do volume de snapshots;

• crescimento do histórico auditável;

• necessidade de validação estatística contínua.

Esses custos são aceitáveis frente ao ganho institucional.

---

# Roadmap

ADR-028

SPRINT-036

Predictive Scenario Simulation

↓

ADR-029

SPRINT-037

Multi-Session Intelligence

↓

ADR-030

SPRINT-038

Portfolio Intelligence Layer

↓

ADR-031

SPRINT-039

Strategy Evolution Governance

↓

ADR-032

SPRINT-040

Institutional AI Decision Layer

---

# Aprovação

Esta ADR estabelece oficialmente a arquitetura da camada Predictive Scenario Simulation e passa a integrar o conjunto de ADRs institucionais do RL.SYS CORE.

Status:

ACCEPTED
