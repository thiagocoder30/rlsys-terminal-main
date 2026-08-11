# ADR-032 — Institutional AI Decision Layer (IADL)

Status: ACCEPTED

Data: 2026-07-28

Autores:
RL.SYS CORE Architecture Board

---

# Contexto

Após a consolidação das camadas institucionais de governança, conhecimento, aprendizado, evolução, simulação prospectiva, inteligência multi-sessão, inteligência de portfólio e governança da evolução das estratégias, o RL.SYS CORE passa a possuir diversas fontes independentes de inteligência institucional.

Entretanto, essas camadas permanecem descentralizadas.

Existe a necessidade de uma camada final capaz de sintetizar todas essas evidências institucionais em uma visão única para o operador, sem interferir em qualquer mecanismo quantitativo responsável pela geração das recomendações operacionais.

Esta camada deverá representar exclusivamente a inteligência institucional consolidada do sistema.

Em nenhuma hipótese poderá substituir, alterar ou influenciar os motores quantitativos existentes.

---

# Decisão

Será criada a Institutional AI Decision Layer (IADL).

A IADL será a última camada institucional do RL.SYS CORE.

Ela será exclusivamente observacional.

Não produzirá sinais operacionais.

Não executará estratégias.

Não modificará pesos.

Não alterará parâmetros.

Não recalibrará modelos.

Sua responsabilidade será sintetizar todas as evidências produzidas pelas camadas institucionais anteriores.

---

# Objetivos

A IADL deverá responder perguntas como:

"Qual é o estado geral da inteligência institucional do RL.SYS CORE?"

"As recomendações atuais possuem forte sustentação institucional?"

"Existe consenso entre todas as camadas?"

"Qual o nível de confiança institucional da decisão?"

"A qualidade das evidências é suficiente?"

"A arquitetura considera seguro manter a operação?"

---

# Fontes de Dados

A IADL consumirá exclusivamente dados provenientes de:

Feedback Governance

Decision Replay

Institutional Knowledge Base

Institutional Learning Engine

Institutional Intelligence Evolution Engine

Predictive Scenario Simulation

Multi-Session Intelligence

Portfolio Intelligence Layer

Strategy Evolution Governance

Shadow Paper Trading

Session Performance

Market Regime

Dynamic Strategy Weight Calibration

Decision Ledger

Nenhuma nova fonte poderá ser criada.

---

# Responsabilidades

A camada deverá produzir indicadores institucionais consolidados.

No mínimo:

Institutional Confidence

Institutional Health

Institutional Readiness

Institutional Consensus

Evidence Quality

Evidence Stability

Knowledge Coverage

Learning Index

Evolution Index

Portfolio Health

Portfolio Diversification

Strategy Maturity

Prediction Confidence

Replay Consistency

Shadow Accuracy

Overall Institutional Intelligence Score

---

# Responsabilidades NÃO Permitidas

A IADL NÃO poderá:

executar trades;

gerar sinais;

executar apostas;

alterar pesos;

recalibrar modelos;

escrever parâmetros quantitativos;

modificar Recommendation Engine;

modificar Ensemble Engine;

modificar Adaptive Intelligence;

interferir no IntelligenceRuntime.

---

# Arquitetura Esperada

Criar:

src/application/institutional-ai/

com:

InstitutionalDecisionSnapshot.ts

InstitutionalDecisionAggregator.ts

InstitutionalDecisionEngine.ts

InstitutionalConfidenceCalculator.ts

InstitutionalConsensusCalculator.ts

InstitutionalHealthCalculator.ts

InstitutionalDecisionHistory.ts

InstitutionalDecisionReportService.ts

---

# Modelo Arquitetural

Todas as camadas institucionais

↓

Institutional Decision Aggregator

↓

Institutional Decision Engine

↓

Institutional Decision Snapshot

↓

Decision Ledger

↓

REST API

↓

Thin Client

---

# Fluxo

Observability Event Bus

↓

Institutional Decision Aggregator

↓

Institutional Confidence Calculator

↓

Institutional Consensus Calculator

↓

Institutional Health Calculator

↓

Institutional Decision Engine

↓

Institutional Decision Snapshot

↓

Decision Ledger

↓

Institutional Decision Report Service

↓

Operator Console

---

# EventBus

Consumir apenas:

LEARNING_SNAPSHOT_CREATED

EVOLUTION_SNAPSHOT_CREATED

KNOWLEDGE_UPDATED

PREDICTIVE_SCENARIO_CREATED

MULTI_SESSION_UPDATED

PORTFOLIO_UPDATED

STRATEGY_EVOLUTION_UPDATED

SHADOW_PERFORMANCE_UPDATED

SESSION_PERFORMANCE_UPDATED

MARKET_REGIME_UPDATED

Nunca publicar eventos para motores quantitativos.

---

# Decision Ledger

Adicionar eventos:

INSTITUTIONAL_DECISION_UPDATED

INSTITUTIONAL_CONFIDENCE_UPDATED

INSTITUTIONAL_CONSENSUS_UPDATED

INSTITUTIONAL_HEALTH_UPDATED

Todos assinados por SHA-256.

Append Only obrigatório.

---

# API

Adicionar:

GET /api/operator/institutional

GET /api/operator/institutional/history

A API será exclusivamente Read-Only.

---

# Frontend

Adicionar painel:

INSTITUTIONAL AI DECISION LAYER

Indicadores mínimos:

Overall Intelligence Score

Institutional Confidence

Institutional Consensus

Institutional Health

Operational Readiness

Evidence Quality

Knowledge Coverage

Prediction Confidence

Portfolio Health

Strategy Maturity

Learning Index

Evolution Index

Replay Consistency

Shadow Accuracy

O frontend continuará sendo Thin Client.

Nenhum cálculo será permitido.

---

# Restrições Arquiteturais

Permanecem obrigatórios:

IntelligenceRuntime como Single Point of Execution.

Paper Trading Only.

ProductionMoneyAllowed=false.

DecisionLedger Append Only.

Snapshots imutáveis.

RuntimeTelemetry desacoplado.

ObservabilityEventBus unidirecional.

Zero lógica quantitativa no frontend.

Zero dependências circulares.

Zero alteração dos motores quantitativos.

---

# Consequências

A conclusão da IADL encerra a construção da camada institucional do RL.SYS CORE.

Toda nova funcionalidade futura deverá consumir ou publicar informações dentro desta arquitetura consolidada.

A partir desta ADR, o RL.SYS CORE passa a possuir uma camada única de Inteligência Institucional responsável por sintetizar, explicar e qualificar o estado global do sistema, preservando integralmente a independência dos motores quantitativos responsáveis pelas recomendações operacionais.

---

# Estado Final da Arquitetura

Operator

↓

Thin Client

↓

Institutional AI Decision Layer

↓

Strategy Evolution Governance

↓

Portfolio Intelligence

↓

Multi-Session Intelligence

↓

Predictive Scenario Simulation

↓

Institutional Intelligence Evolution

↓

Institutional Learning

↓

Institutional Knowledge Base

↓

Decision Replay

↓

Feedback Governance

↓

Shadow Paper Trading

↓

Session Performance

↓

Recommendation Engine

↓

Quantitative Pipeline

↓

IntelligenceRuntime

Single Point of Execution

Fim da arquitetura institucional do RL.SYS CORE v5.x.
