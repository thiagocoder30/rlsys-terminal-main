# ADR-024 — Decision Replay & Explainability Architecture (DREA)

Status: ACCEPTED

Data: 2026-07-28

Autores:
RL.SYS CORE Architecture

---

# Contexto

Após a conclusão das seguintes camadas institucionais:

SPRINT-027
Session Performance Engine

↓

SPRINT-028
Market Regime Detection Engine

↓

SPRINT-029
Dynamic Strategy Weight Calibration

↓

SPRINT-030
Shadow Paper Trading Simulation Engine

↓

SPRINT-031
Intelligence Feedback Governance Loop

o RL.SYS CORE passou a possuir um conjunto completo de evidências auditadas.

Até este ponto o sistema é capaz de:

• gerar recomendações;

• simular decisões;

• medir desempenho;

• detectar regime;

• calibrar pesos;

• validar evidências.

Entretanto ainda não existe uma capacidade institucional para responder, de forma determinística e auditável:

"Por que exatamente esta decisão foi tomada?"

e

"Como a decisão evoluiu desde a entrada até sua recomendação final?"

Essa ausência reduz a capacidade de auditoria profunda, investigação operacional, revisão pós-sessão e explicabilidade institucional.

---

# Decisão

Será criada uma nova camada institucional denominada:

Decision Replay & Explainability Engine (DREA)

Esta camada terá responsabilidade exclusiva de reconstruir cronologicamente qualquer decisão operacional emitida pelo RL.SYS CORE.

O Replay será estritamente observacional.

Nenhuma decisão será recalculada.

Nenhum motor será executado novamente.

Nenhuma recomendação será modificada.

O Replay apenas reconstruirá a cadeia causal registrada no DecisionLedger.

---

# Objetivos

Permitir:

• replay completo de qualquer decisão;

• timeline institucional da decisão;

• reconstrução da sequência de eventos;

• explicabilidade completa;

• auditoria pós-operação;

• investigação de divergências;

• geração de relatórios institucionais.

---

# Fora do Escopo

Esta arquitetura NÃO implementa:

aprendizado;

recalibração;

otimização;

alteração de pesos;

mudança de estratégias;

nova inferência;

execução financeira;

reprocessamento quantitativo.

---

# Princípios Arquiteturais

A arquitetura seguirá:

Clean Architecture

DDD

SOLID

CQRS

Append Only

Immutable Snapshots

Thin Client

Paper Trading Only

Single Point of Execution

---

# Componentes Esperados

Nova camada:

src/application/replay/

composta por:

DecisionReplayEngine

DecisionTimelineBuilder

DecisionExplanationEngine

DecisionReplaySnapshot

ReplayHistory

ReplayReportService

---

# Responsabilidades

DecisionReplayEngine

Responsável por orquestrar o replay.

Nunca executa motores quantitativos.

Nunca modifica estados.

Opera exclusivamente sobre registros históricos.

---

DecisionTimelineBuilder

Reconstrói a sequência completa:

Operator Input

↓

Runtime

↓

Recommendation

↓

Market Regime

↓

Strategy Weight

↓

Shadow Result

↓

Feedback Validation

↓

Decision Ledger

↓

Replay

---

DecisionExplanationEngine

Responsável por produzir explicações estruturadas.

Cada decisão deverá possuir:

motivo principal;

fatores favoráveis;

fatores desfavoráveis;

estado do regime;

nível de consenso;

nível de confiança;

VIX;

Entropia;

Shadow Performance;

Feedback Status;

peso dinâmico da estratégia.

As explicações devem ser determinísticas.

Jamais utilizar IA generativa.

---

DecisionReplaySnapshot

Snapshot imutável contendo:

decisionId

sessionId

timestamp

timeline

explanation

hash SHA-256

---

ReplayHistory

Histórico incremental.

Capacidade fixa.

Atualização O(1).

---

ReplayReportService

Serviço de consulta.

Responsável por disponibilizar:

Replay individual.

Histórico.

Timeline.

Explicações.

---

# Fontes Permitidas

DecisionLedger

Session Performance

Market Regime

Dynamic Strategy Weight

Shadow Paper Trading

Feedback Governance

Operator Session

Nenhuma outra fonte poderá ser utilizada.

---

# Event Bus

Consumir apenas eventos já existentes.

Jamais criar novo pipeline paralelo.

Toda reconstrução deverá ocorrer após o processamento completo da decisão.

---

# Decision Ledger

Registrar apenas eventos observacionais:

DECISION_REPLAY_CREATED

DECISION_EXPLAINED

DECISION_TIMELINE_BUILT

Todos em Append Only.

Nenhum evento poderá ser alterado.

---

# HTTP

A camada deverá expor futuramente:

GET /api/operator/replay

GET /api/operator/replay/{decisionId}

GET /api/operator/replay/history

---

# Frontend

O frontend continuará sendo Thin Client.

Receberá apenas DTOs.

Nenhum cálculo.

Nenhuma reconstrução.

Nenhuma lógica.

---

# Segurança

Replay não poderá:

alterar recomendações;

alterar snapshots;

alterar ledger;

executar runtime;

alterar pesos;

executar estratégias;

executar Shadow Trading.

Replay é somente leitura.

---

# Consequências Positivas

Auditoria institucional completa.

Explicabilidade determinística.

Investigação pós-sessão.

Rastreabilidade integral.

Maior transparência.

Base sólida para documentação regulatória.

---

# Consequências Negativas

Maior volume de snapshots.

Maior consumo de armazenamento do Ledger.

Maior volume de consultas históricas.

Todos considerados aceitáveis.

---

# Dependências

Esta ADR depende de:

ADR-019
Session Performance

ADR-020
Market Regime

ADR-021
Dynamic Strategy Weight Calibration

ADR-022
Shadow Paper Trading

ADR-023
Intelligence Feedback Governance

---

# Sprint Relacionada

Esta ADR será implementada exclusivamente pela:

SPRINT-032

Advanced Decision Replay Engine

---

# Hard Rules

IntelligenceRuntime permanece Single Point of Execution.

QuantitativeEnginePipeline permanece intacto.

Nenhuma lógica quantitativa poderá ser movida para o frontend.

DecisionLedger permanece Append Only.

Snapshots permanecem imutáveis.

RuntimeTelemetry permanece desacoplado.

RuntimeEventBus permanece unidirecional.

Paper Trading Only permanece obrigatório.

ProductionMoneyAllowed permanece false.

Replay é exclusivamente observacional.

Nenhum motor quantitativo poderá ser reexecutado durante o Replay.

---

Fim da ADR-024
