# ADR-025 — Institutional Knowledge Base Architecture

Status: ACCEPTED

Data: 2026-07-28

Autor: RL.SYS Architecture Board

Projeto: RL.SYS CORE v5.x

Relacionamentos:

ADR-019 — Session Performance & Adaptive Calibration Architecture

ADR-020 — Market Regime Detection Architecture

ADR-021 — Dynamic Strategy Weight Calibration Architecture

ADR-022 — Shadow Paper Trading Simulation Architecture

ADR-023 — Intelligence Feedback Governance Architecture

ADR-024 — Decision Replay & Explainability Architecture

Implementação:

SPRINT-033 — Institutional Knowledge Base (IKB)

---

# 1. Contexto

Após a conclusão das Sprints 027 até 032, o RL.SYS CORE passou a possuir uma cadeia institucional completa composta por:

• Session Performance Engine

• Market Regime Detection Engine

• Dynamic Strategy Weight Calibration

• Shadow Paper Trading

• Intelligence Feedback Governance

• Advanced Decision Replay

Todo o ciclo operacional passou a ser:

Decisão

↓

Observação

↓

Simulação

↓

Validação

↓

Replay

Entretanto, ainda não existe uma camada responsável por consolidar conhecimento institucional permanente.

Hoje os componentes produzem evidências, porém essas evidências permanecem distribuídas em diversos snapshots e registros do DecisionLedger.

É necessária uma camada capaz de organizar esse conhecimento sem alterar nenhum motor existente.

---

# 2. Problema

O sistema atualmente consegue responder:

"O que aconteceu?"

"Como aconteceu?"

Mas ainda não responde:

"O que aprendemos institucionalmente?"

A ausência dessa camada dificulta:

• consolidação de padrões;

• comparação entre sessões;

• evolução institucional;

• geração de conhecimento reutilizável;

• preparação para motores futuros de aprendizado.

---

# 3. Decisão

Será criada uma nova camada denominada:

Institutional Knowledge Base (IKB)

A Knowledge Base será exclusivamente observacional.

Ela NÃO participa do Runtime.

Ela NÃO interfere em decisões.

Ela NÃO altera pesos.

Ela NÃO altera estratégias.

Ela NÃO altera recomendações.

Sua responsabilidade é apenas consolidar conhecimento institucional.

---

# 4. Objetivos

A camada deverá:

• consolidar padrões recorrentes;

• consolidar regimes vencedores;

• consolidar estratégias vencedoras;

• consolidar relações entre VIX, Entropy e Consensus;

• consolidar conhecimento proveniente do Shadow Trading;

• consolidar conhecimento aprovado pela Governança;

• organizar todo o conhecimento institucional para consultas futuras.

---

# 5. Restrições Arquiteturais

Permanecem obrigatoriamente intactos:

IntelligenceRuntime

QuantitativeEnginePipeline

Adaptive Intelligence

EnsembleDecisionEngine

MarketRegimeEngine

SessionPerformanceEngine

Dynamic Strategy Weight Calibration

Shadow Paper Trading

Feedback Governance

Decision Replay

DecisionLedger

SnapshotManager

RuntimeTelemetry

RuntimeEventBus

Frontend Thin Client

Paper Trading Only

ProductionMoneyAllowed=false

---

# 6. Arquitetura

Será criada:

src/application/knowledge/

Com os seguintes componentes previstos:

KnowledgeSnapshot

KnowledgePattern

KnowledgeCatalog

KnowledgeIndexer

KnowledgeAggregator

KnowledgeReportService

Todos deverão ser implementados exclusivamente por composição.

Nenhum componente poderá modificar motores existentes.

---

# 7. Fontes de Conhecimento

A Knowledge Base poderá consumir apenas:

DecisionLedger

Replay Snapshots

Feedback Snapshots

Shadow Snapshots

Performance Snapshots

Market Regime Snapshots

Calibration Snapshots

Nenhuma outra fonte será utilizada.

---

# 8. Princípios

Toda informação deverá ser:

Imutável

Auditável

Determinística

Append Only

Hash SHA-256

Versionada

Toda consolidação deverá ocorrer incrementalmente.

Jamais será permitido reprocessar toda a história.

---

# 9. Modelo Operacional

Fluxo institucional:

Decision

↓

Ledger

↓

Snapshots

↓

Knowledge Aggregator

↓

Knowledge Base

↓

Consultas

A Knowledge Base nunca alimentará diretamente nenhum motor decisório.

---

# 10. Performance

Atualizações:

O(1)

Consultas:

O(1)

Catálogo:

Indexado

Histórico:

Janela deslizante

Capacidade configurável.

---

# 11. Integração HTTP

A camada disponibilizará futuramente endpoints REST para consulta institucional.

Esses endpoints serão exclusivamente leitura.

---

# 12. Frontend

O React continuará atuando como Thin Client.

Receberá apenas DTOs.

Nenhuma lógica poderá ser executada no cliente.

---

# 13. Segurança

Toda informação institucional deverá permanecer:

Append Only

Hash SHA-256

Object.freeze()

Auditável

Determinística

---

# 14. Consequências

Benefícios:

• criação de memória institucional;

• preparação para aprendizado supervisionado;

• desacoplamento entre conhecimento e decisão;

• maior auditabilidade;

• maior rastreabilidade;

• preparação para motores futuros de Learning.

Custos:

• aumento moderado do armazenamento de snapshots;

• necessidade de indexação incremental.

---

# 15. Roadmap

Esta ADR fundamenta exclusivamente:

SPRINT-033 — Institutional Knowledge Base

A próxima etapa (ADR-026) utilizará esta base para implementar o Institutional Learning Engine, mantendo a filosofia institucional:

Observar

↓

Validar

↓

Armazenar

↓

Aprender

Sem violar o princípio do Single Point of Execution do IntelligenceRuntime.
