# ADR-030 — Portfolio Intelligence Layer Architecture

Status: ACCEPTED

Data: 2026-07-28

Autores:
RL.SYS CORE Architecture Board

---

# Contexto

Após a conclusão das seguintes camadas institucionais:

- Shadow Paper Trading Simulation Engine
- Intelligence Feedback Governance
- Decision Replay & Explainability
- Institutional Knowledge Base
- Institutional Learning Engine
- Institutional Intelligence Evolution Engine
- Predictive Scenario Simulation Engine
- Multi-Session Intelligence Engine

o RL.SYS CORE passa a possuir uma quantidade significativa de inteligência distribuída.

Entretanto, toda essa inteligência ainda está organizada em torno de estratégias individuais.

Ainda não existe uma camada capaz de responder perguntas institucionais como:

- Qual estratégia mais contribui para o resultado global?
- Existe excesso de concentração em poucas estratégias?
- O conjunto de estratégias está equilibrado?
- O portfólio institucional tornou-se mais resiliente?
- O risco está distribuído adequadamente?
- Existe excesso de dependência de determinado regime?

Essa visão consolidada caracteriza uma arquitetura de Portfolio Intelligence.

---

# Problema

Hoje o sistema conhece cada estratégia individualmente.

Ainda não conhece o comportamento do conjunto.

Sem essa camada torna-se impossível produzir indicadores institucionais como:

- Diversificação
- Concentração
- Correlação
- Eficiência Global
- Robustez
- Resiliência
- Dependência de Regime

O operador continua vendo dezenas de indicadores separados.

Falta uma visão única do portfólio.

---

# Decisão

Será criada a camada:

Portfolio Intelligence Layer (PIL)

A nova camada será exclusivamente observacional.

Ela jamais poderá:

- alterar decisões;
- alterar pesos;
- alterar recomendações;
- alterar estratégias;
- alterar o runtime;
- alterar o pipeline quantitativo.

Sua responsabilidade será consolidar informações produzidas pelas camadas anteriores.

---

# Objetivos

Produzir visão institucional do portfólio.

Calcular:

- Contribution Index
- Portfolio Stability
- Portfolio Diversification
- Portfolio Concentration
- Strategy Correlation
- Regime Exposure
- Portfolio Health Score
- Portfolio Confidence Index

Responder:

"Como está o portfólio institucional como um todo?"

e não:

"Como está uma estratégia específica?"

---

# Arquitetura

Será criada a camada:

src/application/portfolio/

contendo:

PortfolioIntelligenceEngine

PortfolioAggregator

PortfolioCorrelationEngine

PortfolioDiversificationCalculator

PortfolioHealthCalculator

PortfolioSnapshot

PortfolioHistory

PortfolioReportService

---

# Fluxo Arquitetural

Market Regime
        │
        ▼
Dynamic Strategy Weight Calibration
        │
        ▼
Shadow Paper Trading
        │
        ▼
Performance Engine
        │
        ▼
Knowledge Base
        │
        ▼
Learning Engine
        │
        ▼
Evolution Engine
        │
        ▼
Predictive Simulation
        │
        ▼
Multi-Session Intelligence
        │
        ▼
Portfolio Intelligence Layer

---

# Entradas

A camada poderá consumir exclusivamente eventos existentes.

Exemplos:

SESSION_FINISHED

PERFORMANCE_UPDATED

SHADOW_PERFORMANCE_UPDATED

LEARNING_SNAPSHOT_CREATED

EVOLUTION_SNAPSHOT_CREATED

PREDICTIVE_SCENARIO_CREATED

MULTI_SESSION_UPDATED

Nunca deverá criar um fluxo paralelo.

---

# Saídas

Gerar:

PortfolioSnapshot

PortfolioHealth

PortfolioMetrics

PortfolioCorrelation

PortfolioDiversification

PortfolioRiskDistribution

PortfolioContribution

Todos imutáveis.

Todos assinados via SHA-256.

Todos registrados no DecisionLedger.

---

# Decision Ledger

Registrar exclusivamente eventos:

PORTFOLIO_SNAPSHOT_CREATED

PORTFOLIO_UPDATED

PORTFOLIO_HEALTH_UPDATED

PORTFOLIO_CORRELATION_UPDATED

PORTFOLIO_DIVERSIFICATION_UPDATED

Modelo Append-Only obrigatório.

---

# Runtime

A camada será Subscriber.

Nunca Publisher principal.

Consumirá eventos através do ObservabilityEventBus.

Não poderá modificar nenhum evento.

---

# HTTP

Expor:

GET /api/operator/portfolio

GET /api/operator/portfolio/history

GET /api/operator/portfolio/health

---

# Frontend

Adicionar painel:

PORTFOLIO INTELLIGENCE

Exibir:

Portfolio Health

Diversification

Concentration

Strategy Contribution

Regime Exposure

Portfolio Confidence

Correlation

Risk Distribution

Frontend permanece Thin Client.

Nenhum cálculo permitido no React.

---

# Restrições

É proibido:

- alterar Recommendation Engine;
- alterar IntelligenceRuntime;
- alterar Strategy Weights;
- alterar Market Regime;
- alterar Shadow Engine;
- alterar Learning Engine;
- alterar Evolution Engine;
- alterar Predictive Engine;
- alterar Multi-Session Engine;
- alterar qualquer decisão operacional.

Paper Trading Only permanece obrigatório.

ProductionMoneyAllowed=false permanece obrigatório.

---

# Consequências

Positivas

- Consolidação institucional do portfólio.
- Visão única para operadores.
- Base para governança de estratégias.
- Base para evolução institucional.
- Preparação para Institutional AI Decision Layer.

Negativas

- Pequeno aumento no consumo de memória para snapshots.
- Maior quantidade de eventos de auditoria.
- Necessidade de manutenção dos indicadores de portfólio.

---

# Roadmap

Esta ADR implementa:

Sprint-038 — Portfolio Intelligence Layer

Próxima ADR:

ADR-031 — Strategy Evolution Governance Architecture

Posteriormente:

ADR-032 — Institutional AI Decision Layer Architecture

---

# Compatibilidade

Esta ADR preserva integralmente:

✓ IntelligenceRuntime como Single Point of Execution.

✓ Quantitative Pipeline.

✓ Clean Architecture.

✓ Domain Driven Design.

✓ Thin Client.

✓ RuntimeEventBus unidirecional.

✓ RuntimeTelemetry desacoplado.

✓ DecisionLedger Append-Only.

✓ Snapshots imutáveis.

✓ Paper Trading Only.

✓ ProductionMoneyAllowed=false.

✓ Zero impacto sobre motores quantitativos existentes.

Fim da ADR-030.
