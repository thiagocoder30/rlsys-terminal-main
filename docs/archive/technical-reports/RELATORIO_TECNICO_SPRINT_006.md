# RELATORIO TECNICO - SPRINT 006

## Objetivo
Conectar o ranking bayesiano de estratégias ao fluxo institucional de decisão live, criando um orquestrador determinístico que consolida estratégia recomendada, estado da sessão, governança de risco e decisão final sem liberar stake real.

## Decisão Arquitetural
Foi criado o `DecisionOrchestrator` como uma camada de composição de domínio. Ele não depende de HTTP, UI, banco de dados, Gemini ou qualquer detalhe de infraestrutura. O orquestrador utiliza composição explícita entre `StrategyRankingEngine` e `StrategyDecisionEngine`, mantendo o ranking separado das regras de governança.

A decisão segue Clean Architecture: candidatos de estratégia entram como dados de domínio, o ranking seleciona a melhor hipótese, a decisão institucional avalia risco e bankroll, e o orquestrador publica um relatório único para camadas superiores.

## Entregas
- `DecisionOrchestrator`
- `DecisionOrchestratorReport`
- `RecommendedStrategySnapshot`
- Integração entre `StrategyRankingEngine` e `StrategyDecisionEngine`
- Bloqueio por `LiveSessionControlFrame` quando a sessão ainda não está pronta
- Resultado tipado com `Result<DecisionOrchestratorReport, DomainError>`
- Testes unitários para sinal de pesquisa, sessão não pronta e erro tipado

## Complexidade
- Ranking de estratégias: `O(n log n)` devido à ordenação dos candidatos.
- Regras de decisão: `O(r)`, onde `r` é o número de regras institucionais.
- Espaço: `O(n + r)`.

A implementação é compatível com o alvo Helio P22 / 2GB RAM porque evita recursão, trabalha com arrays pequenos e delega cálculos pesados para camadas especializadas.

## Governança
A Sprint não autoriza apostas reais. Mesmo quando há `recommendedStrategy` e `operationalGate = SIGNAL`, o relatório mantém:

```txt
execution.mode = RESEARCH_ONLY
execution.liveStakeFraction = 0
governance.liveStakeAllowed = false
```

O objetivo é expor uma recomendação auditável para pesquisa e operação assistida, preservando o bloqueio operacional real até fases futuras de validação.

## Resultado Esperado
O RL.SYS passa a ter uma decisão centralizada:

```txt
Strategy Candidates
→ Bayesian Ranking
→ Recommended Strategy
→ Institutional Decision
→ Live Session Guard
→ Research-only Orchestrated Report
```

Essa Sprint prepara o core para futuras camadas de explicabilidade, interface operacional e replay de sessão sem refatorar o núcleo.
