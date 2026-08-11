# ADR-021 — Institutional Decision Lifecycle & Decision Quality Gate (DQG)

- Status: APPROVED
- Data: 2026-07-27
- Plataforma: RL.SYS CORE v5.x
- Tipo: Architecture Decision Record
- Relacionadas:
  - ADR-019 — Session Performance & Adaptive Calibration
  - ADR-020 — Market Regime Detection Engine
  - ADR-012 até ADR-018
- Próxima Sprint: Sprint-029

---

# 1. Contexto

Após a conclusão da Sprint-028, o RL.SYS CORE já possui uma cadeia institucional extremamente robusta:

• Tape Sync
• Burn-In
• PreFlight
• Intelligence Runtime
• Quantitative Engine Pipeline
• Adaptive Intelligence
• Ensemble Decision Engine
• Session Performance Engine
• Market Regime Detection Engine
• Strategy Recommendation Engine
• Decision Ledger
• Runtime Telemetry

Entretanto, ainda existe um ponto importante de governança institucional.

Hoje o sistema consegue responder:

- A mesa está boa?
- O regime é favorável?
- Existe consenso?
- Qual estratégia é recomendada?
- Qual stake sugerida?

Mas ainda não existe um mecanismo institucional responsável por responder:

"Esta decisão possui qualidade suficiente para ser apresentada ao operador?"

Essa decisão hoje ainda é consequência indireta dos motores existentes.

Arquiteturalmente ela deve tornar-se uma etapa explícita do pipeline institucional.

---

# 2. Problema

Nem toda recomendação produzida pelos motores deve chegar ao operador.

Mesmo quando:

- PreFlight aprovado;
- Adaptive positivo;
- Ensemble convergente;
- Regime conhecido;
- Estratégia elegível;

a decisão pode apresentar baixa qualidade operacional.

Exemplos:

- consenso apenas moderado;
- confiança elevada porém instável;
- VIX crescente;
- Entropia deteriorando;
- sessão entrando em degradação;
- regime em transição;
- Adaptive perdendo calibração.

Hoje esses fatores aparecem distribuídos.

Não existe um "Gate Final".

---

# 3. Decisão

Fica criado oficialmente o componente institucional:

# Decision Quality Gate (DQG)

Responsabilidade única:

Avaliar a qualidade operacional da decisão antes que ela seja apresentada ao operador.

O DQG NÃO cria decisões.

O DQG NÃO altera motores quantitativos.

O DQG NÃO altera probabilidades.

O DQG NÃO interfere na matemática.

Sua única função é decidir:

"A decisão produzida merece chegar ao operador?"

---

# 4. Princípios

O DQG será:

- determinístico;
- puro;
- imutável;
- auditável;
- desacoplado;
- observacional.

Não poderá:

- recalcular Markov;
- recalcular Shannon;
- recalcular Ensemble;
- recalcular Adaptive;
- recalcular Regime.

Consumirá apenas snapshots produzidos anteriormente.

---

# 5. Entradas

O DQG poderá consumir:

DecisionRecommendation

Adaptive Snapshot

Consensus Snapshot

Regime Snapshot

Performance Snapshot

PreFlight Snapshot

Runtime Snapshot

Operational VIX

Entropy

Session Health

Decision History

Recommendation History

---

# 6. Saída

O componente produzirá um único objeto institucional.

DecisionQualitySnapshot

Campos mínimos:

Decision Score

Decision Grade

Decision Confidence

Approval Status

Quality Reasons

Blocking Reasons

Warning Reasons

Approval Timestamp

Decision Hash

---

# 7. Decision Grades

A plataforma passa a reconhecer oficialmente:

EXCELLENT

VERY_GOOD

GOOD

ACCEPTABLE

WEAK

POOR

REJECTED

Essas categorias são qualitativas.

Não representam probabilidade.

Não representam expectativa matemática.

Representam qualidade operacional institucional.

---

# 8. Approval Status

O operador somente poderá visualizar decisões classificadas como:

APPROVED

Todas as demais deverão retornar:

HOLD

ou

BLOCK

dependendo das Hard Rules existentes.

---

# 9. Fluxo Oficial

Tape

↓

Burn-In

↓

PreFlight

↓

Quantitative Engine

↓

Adaptive

↓

Ensemble

↓

Market Regime

↓

Recommendation Engine

↓

Session Performance

↓

Decision Quality Gate

↓

Decision Ledger

↓

Operator Console

---

# 10. Decision Ledger

Toda decisão deverá registrar:

DECISION_QUALITY_EVALUATED

com:

SHA-256

timestamp

grade

score

approval

reason

---

# 11. Runtime Event Bus

Novos eventos oficiais:

DECISION_QUALITY_EVALUATED

DECISION_APPROVED

DECISION_HELD

DECISION_BLOCKED

---

# 12. API

Novos endpoints REST:

GET /api/operator/decision-quality

GET /api/operator/decision-quality/history

GET /api/operator/decision-grade

---

# 13. HUD

O Operator Console passa a possuir novo painel:

DECISION QUALITY

Indicadores:

Grade

Score

Approval

Warnings

Reasons

Última Avaliação

---

# 14. Governança

O DQG NÃO pode:

alterar stake;

alterar estratégia;

alterar probabilidades;

alterar pesos;

alterar consenso;

alterar Adaptive;

alterar Regime;

alterar Recommendation.

Ele apenas valida.

---

# 15. Performance

Atualizações:

O(1)

Snapshots imutáveis.

Sem reprocessamento histórico.

Sem loops retroativos.

---

# 16. Auditoria

Todos os snapshots deverão ser:

imutáveis;

versionados;

hash SHA-256;

append-only.

---

# 17. Compatibilidade

Mantém integral compatibilidade com:

ADR-012

ADR-013

ADR-014

ADR-015

ADR-016

ADR-017

ADR-018

ADR-019

ADR-020

Nenhum componente existente deverá ser modificado em seu comportamento matemático.

O DQG atua exclusivamente como camada institucional superior de validação.

---

# 18. Restrições Arquiteturais

Permanece obrigatório:

- IntelligenceRuntime como Single Point of Execution.

- QuantitativeEnginePipeline permanece inalterado.

- Adaptive Intelligence permanece inalterada.

- Ensemble permanece inalterado.

- Market Regime permanece inalterado.

- Recommendation Engine permanece inalterado.

- Session Performance permanece inalterado.

- Decision Ledger Append Only.

- RuntimeTelemetry desacoplado.

- RuntimeEventBus unidirecional.

- Frontend Thin Client.

- Nenhuma lógica quantitativa no React.

- Paper Trading Only obrigatório.

---

# 19. Critério de Aceitação

A Sprint-029 somente será considerada homologada quando:

✓ existir o Decision Quality Gate;

✓ existir o DecisionQualitySnapshot;

✓ existir auditoria SHA-256;

✓ existir painel Decision Quality;

✓ existir histórico REST;

✓ existir cobertura completa de testes;

✓ Build TypeScript limpo;

✓ Vitest sem regressões;

✓ Madge sem dependências circulares;

✓ nenhuma alteração dos motores quantitativos;

✓ preservação integral da arquitetura institucional do RL.SYS CORE.
