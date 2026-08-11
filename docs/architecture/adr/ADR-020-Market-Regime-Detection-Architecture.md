# ADR-020 — Market Regime Detection Architecture

Status: ACCEPTED

Data: 2026-07-27

Autor: RL.SYS CORE Architecture

Versão: 1.0

---

# Contexto

Após a conclusão das ADR-012 até ADR-019, o RL.SYS CORE passou a possuir uma arquitetura institucional completa para operação em Paper Trading.

A plataforma atualmente é composta pelas seguintes camadas:

Operator Console

↓

Operator Workflow

↓

IntelligenceRuntime

↓

QuantitativeEnginePipeline

↓

Adaptive Intelligence

↓

Ensemble Decision Engine

↓

Strategy Recommendation Engine

↓

Session Performance Layer

↓

Decision Ledger

O sistema já é capaz de:

• sincronizar uma fita histórica;

• executar Burn-In;

• realizar PreFlight;

• manter uma sessão viva;

• atualizar continuamente seus motores matemáticos;

• recomendar estratégias;

• recomendar stake;

• explicar decisões;

• registrar todas as decisões no Decision Ledger;

• avaliar continuamente a qualidade operacional da sessão.

Entretanto, ainda falta uma camada responsável por responder uma pergunta fundamental:

"Em qual tipo de mesa estamos operando?"

Atualmente os motores trabalham sobre os dados disponíveis, porém não existe uma classificação institucional do contexto estatístico da mesa.

---

# Problema

O Recommendation Engine recebe informações produzidas pelos motores quantitativos, porém desconhece o comportamento global da mesa.

Isso impede que o sistema diferencie situações como:

• mesa altamente tendencial;

• mesa predominantemente reversiva;

• mesa equilibrada;

• mesa caótica;

• mesa com baixa informação estatística.

Sem essa camada, todas as recomendações são produzidas sem uma classificação explícita do regime operacional.

---

# Decisão

Será criada uma nova camada denominada:

Market Regime Detection Layer (MRDL)

Esta camada será exclusivamente observacional.

Sua responsabilidade será identificar continuamente o regime estatístico atual da mesa utilizando apenas indicadores já produzidos pelo Runtime.

O MRDL não poderá modificar decisões.

O MRDL não poderá recalcular modelos matemáticos.

O MRDL não poderá substituir qualquer motor existente.

---

# Objetivos

A nova camada deverá:

• classificar continuamente o regime da mesa;

• detectar mudanças de regime;

• medir estabilidade do regime;

• medir persistência temporal;

• informar quais famílias de estratégias são naturalmente favorecidas;

• produzir snapshots imutáveis;

• disponibilizar DTOs para o Operator Console;

• registrar mudanças no Decision Ledger;

• publicar eventos institucionais.

---

# Responsabilidades

O Market Regime Detection Layer será responsável apenas por classificação de contexto.

Não pertence a esta camada:

• cálculo de probabilidades;

• cálculo de Markov;

• cálculo de Entropia;

• cálculo de Z-Score;

• consenso;

• Adaptive Intelligence;

• Recommendation;

• Stake;

• Money Management.

---

# Princípios Arquiteturais

A nova camada deverá obedecer:

Clean Architecture

Domain Driven Design

Dependency Inversion

Single Responsibility

Open/Closed Principle

Single Point of Execution

Paper Trading Only

---

# Dependências Permitidas

O MRDL poderá consumir exclusivamente outputs já produzidos pelo sistema.

Exemplos:

Operational VIX

Operational Entropy

Adaptive Confidence

Consensus Score

Recommendation Confidence

Strategy Ranking

Operational Stability

Session Performance

É proibido consumir diretamente algoritmos internos.

---

# Dependências Proibidas

O MRDL não poderá depender diretamente de:

Markov Engine

Shannon Engine

ZScore Engine

Adaptive Engine

Ensemble Engine

Recommendation Engine

Stake Engine

Decision Engine

---

# Componentes

A arquitetura passa a incorporar:

MarketRegimeEngine

RegimeClassifier

RegimeTransitionDetector

StrategyEligibilityMatrix

RegimeSnapshot

Todos pertencentes à camada:

src/application/regime

Nenhum componente deverá ser criado na camada Domain.

---

# Classificação de Regime

O sistema deverá classificar continuamente a mesa em um dos seguintes estados:

TRENDING

Mesa apresenta forte persistência.

---

MEAN_REVERSION

Mesa apresenta predominância de reversão.

---

BALANCED

Mesa apresenta equilíbrio estatístico.

---

CHAOTIC

Mesa apresenta elevada instabilidade operacional.

---

LOW_INFORMATION

Mesa não possui contexto suficiente para classificação confiável.

---

# Persistência

Além do regime atual deverão ser mantidos:

Regime anterior

Tempo no regime

Número de transições

Persistência

Estabilidade

Confiança da classificação

---

# Strategy Eligibility Matrix

Cada regime deverá possuir uma matriz institucional indicando:

Estratégias favorecidas

Estratégias neutras

Estratégias penalizadas

Essa matriz não toma decisões.

Ela apenas informa contexto para o Recommendation Engine.

---

# Regime Snapshot

Cada snapshot deverá conter:

Timestamp

Current Regime

Previous Regime

Confidence

Stability

Persistence

Operational VIX

Operational Entropy

Consensus

Adaptive Confidence

Eligible Strategies

Snapshot Hash

Todos os snapshots serão imutáveis.

---

# Runtime

A camada consumirá apenas eventos já existentes.

ROUND_PROCESSED

SESSION_UPDATED

Emitirá:

MARKET_REGIME_UPDATED

REGIME_TRANSITION

---

# Decision Ledger

Toda mudança relevante deverá registrar:

MARKET_REGIME_CHANGED

REGIME_TRANSITION

REGIME_SNAPSHOT_CREATED

Todos os registros continuarão:

Append-Only

SHA-256

Auditáveis

Imutáveis

---

# Operator Console

O frontend continuará atuando exclusivamente como Thin Client.

Receberá apenas DTOs.

O novo painel deverá exibir:

Regime Atual

Tempo no Regime

Estabilidade

Persistência

Confiança

Estratégias Elegíveis

Nenhuma lógica quantitativa poderá existir no React.

---

# Performance

Toda atualização deverá ocorrer de forma incremental.

É proibido:

reprocessar toda a fita;

duplicar cálculos;

executar múltiplos pipelines.

A atualização deverá preservar complexidade O(1).

---

# Compatibilidade

Esta ADR não altera:

IntelligenceRuntime

QuantitativeEnginePipeline

Adaptive Intelligence

Ensemble Decision Engine

Strategy Recommendation Engine

Stake Recommendation Service

Session Performance Layer

Decision Ledger

Snapshot Manager

Runtime Telemetry

Runtime Event Bus

Paper Trading Only

Operator Workflow

Todas as ADRs anteriores permanecem válidas.

---

# Benefícios

A plataforma passa a distinguir claramente:

Contexto da Mesa

↓

Motores Matemáticos

↓

Recomendação

↓

Avaliação da Sessão

Isso aumenta:

consistência;

explicabilidade;

observabilidade;

auditabilidade;

qualidade das recomendações.

---

# Consequências

Novos DTOs.

Novos Snapshots.

Novos Eventos.

Novas APIs REST.

Novo painel institucional.

Nenhuma alteração nos motores quantitativos.

---

# Governança

Fica institucionalmente definido que toda classificação de contexto estatístico deverá ocorrer exclusivamente na Market Regime Detection Layer.

É expressamente proibido mover essa responsabilidade para:

IntelligenceRuntime

QuantitativeEnginePipeline

Adaptive Intelligence

Ensemble Decision Engine

Recommendation Engine

Frontend

A Market Regime Detection Layer atuará exclusivamente como observadora institucional, preservando integralmente os princípios de Clean Architecture, Domain-Driven Design, Zero-Defect, Single Point of Execution e Paper Trading Only.
