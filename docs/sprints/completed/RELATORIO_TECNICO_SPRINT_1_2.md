# Sprint 1.2 — Statistical Significance Engine

## Objetivo
Adicionar uma camada científica para avaliar se desvios observados em datasets de roleta são compatíveis com ruído aleatório ou se merecem investigação quantitativa controlada.

## Entregas
- `StatisticalSignificanceEngine` com chi-square, p-value, entropia, divergências de distribuição, z-scores e intervalos Wilson 95%.
- `HypothesisValidator` para formalizar hipótese nula vs hipótese alternativa.
- `StatisticalResearchService` para orquestrar integridade de dataset + significância estatística.
- Endpoint `/api/research/statistics/evaluate`.
- Testes automatizados cobrindo baseline uniforme, desvio concentrado e gates de hipótese.

## Governança
A Sprint 1.2 não libera execução operacional. Mesmo quando encontra significância estatística, o sistema mantém bloqueio até validação fora da amostra, persistência do edge e backtest institucional.
