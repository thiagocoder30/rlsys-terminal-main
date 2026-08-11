# ADR-019 — Session Performance & Adaptive Calibration Architecture

Status: ACCEPTED

Data: 2026-07-27

Autor: RL.SYS CORE Architecture

Versão: 1.0

---

# Contexto

Após a consolidação das Sprints 019 até 026, o RL.SYS CORE atingiu estabilidade arquitetural suficiente para operar sessões completas em Paper Trading através do fluxo:

Operator
↓

Tape Sync

↓

Burn-In

↓

PreFlight

↓

Live Session

↓

Recommendation Engine

↓

Decision Ledger

↓

Operator HUD

Todos os motores quantitativos encontram-se desacoplados e protegidos pelo princípio do Single Point of Execution.

Entretanto, ainda não existe uma camada institucional responsável por avaliar continuamente a qualidade operacional da sessão.

Atualmente o sistema produz decisões.

Ainda não produz uma avaliação institucional da qualidade dessas decisões ao longo da sessão.

Essa responsabilidade não pertence:

• ao IntelligenceRuntime;

• ao QuantitativeEnginePipeline;

• ao Adaptive Intelligence;

• ao Ensemble Decision Engine;

• ao Strategy Recommendation Engine;

• ao Frontend.

Portanto torna-se necessária uma nova camada exclusivamente observadora.

---

# Problema

Não existe um componente responsável por responder continuamente perguntas como:

• A sessão continua saudável?

• O consenso está melhorando?

• A confiança adaptativa está evoluindo?

• A estratégia dominante está degradando?

• O risco operacional aumentou?

• O operador deveria continuar operando?

Essa responsabilidade não pode contaminar o domínio quantitativo.

---

# Decisão

Será criada uma nova camada institucional denominada:

Session Performance Layer

Esta camada possuirá responsabilidade exclusivamente observacional.

Ela jamais poderá:

• modificar decisões;

• alterar pesos;

• alterar modelos matemáticos;

• alterar o Runtime;

• alterar recomendações.

Sua única função será consolidar indicadores operacionais produzidos pelas demais camadas.

---

# Responsabilidades

A Session Performance Layer deverá:

• consolidar métricas da sessão;

• medir evolução da confiança;

• medir evolução do consenso;

• acompanhar estabilidade operacional;

• acompanhar desempenho das estratégias;

• produzir snapshots imutáveis;

• disponibilizar DTOs para o Operator Console;

• registrar snapshots no Decision Ledger;

• emitir eventos institucionais.

---

# Limites Arquiteturais

A camada NÃO poderá depender diretamente de:

• Markov

• Shannon Entropy

• Z-Score

• Adaptive Intelligence

• Ensemble Engine

• Recommendation Engine

Ela consumirá exclusivamente seus outputs.

Essa regra preserva o princípio da Inversão de Dependência (Dependency Inversion).

---

# Componentes Previstos

A arquitetura passa a incorporar:

SessionPerformanceEngine

StrategyPerformanceTracker

SessionHealthEvaluator

AdaptiveCalibrationMonitor

PerformanceSnapshot

PerformanceHistory

Todos pertencentes à camada Application.

Nenhum componente será criado na camada Domain.

---

# Fluxo Arquitetural

Operator

↓

Runtime

↓

QuantitativeEnginePipeline

↓

Adaptive Intelligence

↓

Ensemble Decision Engine

↓

Recommendation Engine

↓

Session Performance Layer

↓

Decision Ledger

↓

Operator Console

A nova camada posiciona-se após a geração da decisão.

Jamais interfere na decisão.

Apenas observa.

---

# Session Health

A camada classificará continuamente a sessão em um dos estados:

EXCELLENT

GOOD

STABLE

DEGRADED

CRITICAL

A classificação utilizará exclusivamente indicadores já produzidos pelo Runtime.

Nenhum novo algoritmo probabilístico será criado.

---

# Adaptive Calibration

A camada monitorará:

• tendência da confiança;

• estabilidade da confiança;

• evolução temporal;

• consistência entre recomendações.

Esse monitoramento não poderá alterar o Adaptive Engine.

Apenas produzir indicadores.

---

# Performance Snapshot

Cada snapshot deverá conter:

• Timestamp

• Runtime Uptime

• Session Health

• Confidence Trend

• Consensus Trend

• Operational VIX

• Operational Entropy

• Shadow PnL

• Drawdown

• Recommendation Accuracy

• Strategy Ranking

• Average Stake

• Average Recommendation Score

Os snapshots serão imutáveis.

---

# Event Bus

Consumirá:

SESSION_UPDATED

ROUND_PROCESSED

RECOMMENDATION_GENERATED

Emitirá:

SESSION_HEALTH_UPDATED

PERFORMANCE_UPDATED

Os eventos permanecerão unidirecionais.

---

# Decision Ledger

Cada mudança relevante deverá registrar:

PERFORMANCE_SNAPSHOT

SESSION_HEALTH_CHANGED

Todos os registros continuarão:

Append-Only

SHA-256

Auditáveis

Imutáveis

---

# Operator Console

O frontend continuará sendo Thin Client.

Receberá exclusivamente DTOs contendo:

• Session Health

• Confidence Trend

• Consensus Trend

• Recommendation Accuracy

• Strategy Ranking

• Operational Stability

Nenhuma lógica quantitativa poderá existir no React.

---

# Performance

Toda atualização deverá ocorrer de forma incremental.

É proibido:

• reprocessar a fita;

• recalcular toda a sessão;

• duplicar processamento.

A atualização deverá preservar complexidade O(1).

---

# Consequências

Benefícios:

• Maior observabilidade operacional.

• Melhor suporte ao operador.

• Maior rastreabilidade institucional.

• Base para futuras calibrações.

• Total aderência ao Single Point of Execution.

Custos:

• Novos DTOs.

• Novos snapshots.

• Novos eventos institucionais.

• Novas APIs REST.

---

# Compatibilidade

Esta ADR não altera:

• IntelligenceRuntime

• QuantitativeEnginePipeline

• Adaptive Intelligence

• Ensemble Decision Engine

• Recommendation Engine

• Decision Ledger

• Snapshot Manager

• Runtime Telemetry

• Runtime Event Bus

• Paper Trading Only

• Thin Client

Toda a arquitetura existente permanece íntegra.

---

# Governança

Esta ADR torna obrigatória a existência de uma camada observadora institucional para avaliação contínua da qualidade operacional da sessão.

Fica expressamente proibido que essa camada altere decisões quantitativas ou mova lógica para o frontend.

A Session Performance Layer deverá atuar exclusivamente como observadora institucional, preservando integralmente os princípios de Clean Architecture, Domain-Driven Design, Single Point of Execution, Zero-Defect e Paper Trading Only.
