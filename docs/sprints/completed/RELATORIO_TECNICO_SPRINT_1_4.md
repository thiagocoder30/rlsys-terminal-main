# RELATÓRIO TÉCNICO — SPRINT 1.4

## Edge Persistence Analysis

Esta Sprint adiciona análise de sobrevivência temporal do edge aparente.

### Entregas

- `EdgePersistenceAnalyzer`
- `PersistenceResearchService`
- curvas de sobrevivência por janela
- medição de decay e half-life
- estabilidade por janelas
- consistência out-of-sample
- endpoint `/api/research/persistence/evaluate`
- testes automatizados de persistência

### Decisão de governança

Mesmo quando há persistência moderada ou forte, o gate operacional permanece bloqueado. Persistência é evidência de pesquisa, não autorização para stake.

### Próxima Sprint

Sprint 1.5 — Research Reporting Layer.
