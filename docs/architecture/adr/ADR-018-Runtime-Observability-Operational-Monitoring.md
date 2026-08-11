# ADR-018 — Runtime Observability & Operational Monitoring

**Status:** Accepted

**Data:** 2026-07-26

**Autores:** RL.SYS Architecture Board

**Sprint relacionada:** Sprint-019 — Runtime Observability & Operational Monitoring

---

# Contexto

As ADR-012 até ADR-017 consolidaram a arquitetura institucional do Runtime do RL.SYS.

Durante esse processo foram estabelecidos:

- Clean Architecture
- Domain Driven Design (DDD)
- SOLID
- Single Point of Execution
- Runtime Session Manager
- Decision Ledger
- Snapshot Manager
- Recovery Pipeline
- Tactical Engine Boundary
- Runtime Adapters

O núcleo quantitativo encontra-se centralizado no IntelligenceRuntime.

Entretanto, ainda não existe uma camada institucional de observabilidade capaz de fornecer métricas, diagnósticos, telemetria e monitoramento operacional sem interferir na execução do Runtime.

Essa capacidade é indispensável para ambientes Enterprise e constitui requisito para auditoria, operação contínua e futuras implantações distribuídas.

---

# Problema

O Runtime executa corretamente, porém não disponibiliza uma visão institucional sobre:

- saúde operacional;
- desempenho do pipeline;
- eventos internos;
- alertas;
- métricas históricas;
- comportamento das sessões.

Sem essa camada, problemas operacionais exigem inspeção manual de logs, dificultando diagnóstico e governança.

---

# Decisão

Instituir uma camada oficial denominada Runtime Observability.

Essa camada será completamente desacoplada da lógica quantitativa.

Seu papel será exclusivamente observar, registrar, consolidar métricas e disponibilizar informações para monitoramento.

Ela nunca poderá alterar decisões, modificar estados do domínio ou interferir na execução do Runtime.

Toda observabilidade será estritamente Read Only.

---

# Princípios Arquiteturais

A camada de Observabilidade deverá obedecer aos seguintes princípios:

- Single Responsibility Principle
- Open/Closed Principle
- Dependency Inversion
- Clean Architecture
- Domain Driven Design
- Event Driven Architecture
- Imutabilidade dos registros
- Separação completa entre execução e monitoramento

---

# Componentes Institucionais

## RuntimeMetricsCollector

Responsável pela coleta contínua de métricas operacionais.

Deverá registrar, no mínimo:

- Runtime Uptime
- CPU Time
- Memory Usage
- Decision Count
- Average Decision Time
- Average Pipeline Time
- Active Sessions
- Finished Sessions
- Locked Sessions
- Recoveries
- Snapshots
- Heartbeats
- Runtime Errors
- Runtime Warnings

---

## RuntimeEventBus

Barramento institucional responsável pela publicação de eventos internos.

Eventos mínimos:

- RuntimeStarted
- RuntimeStopped
- SessionCreated
- SessionRecovered
- SessionLocked
- SessionFinished
- DecisionExecuted
- SnapshotCreated
- SnapshotRecovered
- HeartbeatTimeout
- RuntimeWarning
- RuntimeError
- HealthChecked

Todo evento deverá possuir:

- EventId
- Timestamp UTC
- CorrelationId
- RuntimeVersion
- SessionId (quando aplicável)

---

## RuntimeDiagnostics

Serviço responsável pela inspeção institucional do Runtime.

Deverá disponibilizar:

- Runtime Status
- Pipeline Status
- Session Status
- Snapshot Status
- Ledger Status
- Telemetry Status
- Build Version
- Warnings
- Errors
- Health Summary

---

## RuntimePerformanceMonitor

Responsável por consolidar indicadores de desempenho.

Deverá produzir estatísticas como:

- Average
- Median
- Minimum
- Maximum
- P95
- P99

Para:

- Pipeline
- Decision
- Engine
- Snapshot
- Recovery
- Heartbeat

---

## RuntimeAlertManager

Responsável por geração automática de alertas.

Alertas mínimos:

- Pipeline lento
- Heartbeat perdido
- Latência elevada
- Recovery excessivo
- Consumo elevado de memória
- Ledger inconsistente
- Snapshot inválido
- Sessão bloqueada

---

# Endpoints Institucionais

A infraestrutura deverá disponibilizar:

GET /runtime/metrics

GET /runtime/events

GET /runtime/diagnostics

GET /runtime/performance

GET /runtime/alerts

Todos deverão ser exclusivamente Read Only.

Nenhum endpoint poderá alterar qualquer estado do Runtime.

---

# Restrições

É proibido:

- modificar QuantitativeEnginePipeline;
- alterar algoritmos quantitativos;
- modificar Decision Engine;
- modificar Explainability Engine;
- alterar Runtime Session Manager;
- alterar Decision Ledger;
- alterar Snapshot Manager;
- alterar Domain Layer.

A observabilidade apenas consome informações.

Nunca produz decisões.

Nunca altera estados.

---

# Dependências

A camada deverá depender exclusivamente de contratos.

Nenhum componente poderá depender diretamente de implementações concretas do domínio.

Toda comunicação deverá ocorrer através de interfaces.

---

# Testes Obrigatórios

A Sprint deverá incluir testes para:

- Runtime Metrics
- Runtime Diagnostics
- Runtime Event Bus
- Runtime Alerts
- Runtime Performance

Além disso:

- Build deverá permanecer verde.
- Todos os testes existentes deverão permanecer aprovados.
- Madge deverá continuar retornando:

"No circular dependency found."

---

# Consequências

Benefícios:

- Diagnóstico operacional imediato.
- Observabilidade institucional.
- Telemetria consolidada.
- Base para dashboards.
- Base para monitoramento distribuído.
- Preparação para ambientes de alta disponibilidade.
- Maior rastreabilidade para auditorias.

Custos:

- Pequeno aumento na complexidade da infraestrutura.
- Novos componentes de monitoramento.
- Necessidade de manutenção da camada de métricas.

---

# Conclusão

A partir desta ADR, toda capacidade de monitoramento do RL.SYS passa a ser oficialmente centralizada na Runtime Observability Layer.

Essa camada constitui parte da infraestrutura institucional e deverá permanecer permanentemente desacoplada da lógica quantitativa, preservando o IntelligenceRuntime como único ponto oficial de execução (Single Point of Execution).
