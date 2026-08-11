# ADR-017 — Runtime Session Lifecycle & Decision Ledger

- Status: Accepted
- Data: 2026-07-26
- Versão: 1.0
- Autor: RL.SYS Architecture Board

## Contexto

As ADR-013, ADR-014, ADR-015, ADR-016 e ADR-016.1 consolidaram o IntelligenceRuntime como o único ponto institucional de execução da inteligência quantitativa.

Entretanto, ainda não existe uma especificação formal para o ciclo de vida das sessões de execução, persistência de estado operacional, recuperação após falhas, snapshots, telemetria e trilha institucional de decisões.

Sem essa padronização existe risco de:

- perda de contexto operacional;
- divergência entre frontend e backend;
- inconsistência na auditoria;
- impossibilidade de reconstrução completa de uma sessão;
- dificuldade de investigação operacional.

Esta ADR estabelece o protocolo institucional de gerenciamento do ciclo de vida do Runtime.

---

# Decisão

O Runtime passa a possuir um ciclo de vida institucional único denominado Runtime Session Lifecycle.

Toda execução deverá obrigatoriamente ocorrer dentro de uma Runtime Session.

Nenhuma decisão poderá existir fora de uma sessão.

---

# Arquitetura

Presentation

↓

Runtime Adapter

↓

IntelligenceRuntime

↓

Quantitative Pipeline

↓

Decision Engine

↓

Explainability

↓

Decision Ledger

↓

Telemetry

↓

Snapshot Manager

---

# Runtime Session

Cada sessão deverá possuir obrigatoriamente:

- SessionId (UUID)
- RuntimeVersion
- CreatedAt (UTC)
- UpdatedAt (UTC)
- Status
- Bankroll
- Provider
- ActiveStrategy
- RuntimeState
- SnapshotVersion

Status possíveis:

- CREATED
- ACTIVE
- PAUSED
- LOCKED
- FINISHED
- RECOVERED

---

# Runtime Session Manager

Será responsável por:

- criar sessão;
- recuperar sessão;
- restaurar snapshots;
- controlar heartbeat;
- controlar timeout;
- finalizar sessão;
- disponibilizar consulta institucional.

---

# Snapshot Manager

Após cada decisão aprovada deverá ser produzido um Snapshot institucional.

O Snapshot deverá conter obrigatoriamente:

- SessionId
- Timestamp UTC
- RuntimeVersion
- CurrentBankroll
- PeakBankroll
- Drawdown
- Cooldown
- OperationalVIX
- ActiveStrategy
- StrategyWeights
- ShadowPnL
- BurnIn
- LockState
- OracleState

Snapshots deverão ser imutáveis.

---

# Decision Ledger

Toda decisão produzida pelo IntelligenceRuntime deverá gerar um registro permanente.

Fluxo obrigatório:

TacticalExecutionRequest

↓

IntelligenceRuntime

↓

DecisionSummary

↓

DecisionExplanation

↓

DecisionLedgerEntry

O Ledger deverá ser Append Only.

Nenhuma alteração posterior será permitida.

---

# Auditoria

Cada registro deverá possuir:

- DecisionId
- SessionId
- Timestamp UTC
- RuntimeVersion
- DecisionSummary
- DecisionExplanation
- SHA-256 Integrity Hash

Toda alteração deverá gerar novo registro.

Jamais modificar registros existentes.

---

# Runtime Telemetry

O Runtime deverá disponibilizar métricas institucionais.

Métricas mínimas:

- Runtime Uptime
- Pipeline Latency
- Decision Count
- Decisions per Minute
- Memory Usage
- Snapshot Count
- Recovery Count
- Active Sessions

Telemetria não poderá interferir na execução.

---

# Health Endpoints

O Runtime deverá disponibilizar:

GET /health

GET /runtime

GET /runtime/version

GET /runtime/status

GET /runtime/session

GET /runtime/telemetry

Todos deverão ser Read Only.

---

# Recovery

Após reinicialização do Runtime:

1. localizar último Snapshot válido;
2. validar integridade;
3. reconstruir estado;
4. restaurar Runtime Session;
5. reiniciar Heartbeat;
6. continuar operação.

Caso a integridade falhe:

- bloquear sessão;
- registrar auditoria;
- solicitar nova sessão.

---

# Heartbeat

Cada sessão deverá emitir Heartbeat periódico.

Caso o intervalo máximo seja excedido:

ACTIVE

↓

TIMEOUT

↓

LOCKED

↓

RECOVERY

---

# Governança

Nenhum Adapter poderá modificar:

- Snapshot;
- DecisionSummary;
- DecisionExplanation;
- Ledger.

Somente o IntelligenceRuntime possui autoridade para gerar esses objetos.

---

# Dependências

Esta ADR complementa:

ADR-013 — Intelligence Runtime

ADR-014 — Operational End-to-End Validation

ADR-015 — Runtime Adapters Layer

ADR-016 — Tactical Engine Boundary Definition

ADR-016.1 — Tactical Engine Boundary Enforcement

---

# Consequências

Positivas

- Runtime totalmente rastreável.
- Recuperação institucional de sessões.
- Auditoria completa.
- Snapshot imutável.
- Telemetria padronizada.
- Redução de inconsistências entre frontend e backend.

Negativas

- Maior número de artefatos persistidos.
- Maior complexidade do Runtime.
- Necessidade de políticas de retenção de snapshots.

---

# Próxima Sprint

Sprint-018

Runtime Session & Decision Ledger Integration

Objetivos:

- implementar Runtime Session Manager;
- implementar Snapshot Manager;
- implementar Decision Ledger;
- implementar Runtime Telemetry;
- implementar Recovery Pipeline;
- implementar Health Endpoints;
- adicionar testes institucionais;
- validar ausência de dependências circulares;
- validar recuperação completa de sessão.

Fim da ADR-017.
