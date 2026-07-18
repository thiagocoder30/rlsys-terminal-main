# Sprint 2.1 — Institutional Backtesting Engine

## Objetivo
Adicionar uma camada institucional de backtesting capaz de avaliar estratégia fora da amostra, comparar contra baseline, medir stress scenarios, drawdown surface e risco de ruína proxy.

## Entregas
- `InstitutionalBacktestEngine`
- `InstitutionalBacktestService`
- endpoint `/api/backtest/institutional/evaluate`
- comparação contra baseline `RANDOM_SECTOR`
- walk-forward por janelas treino/teste
- stress scenarios por multiplicador de stake
- drawdown surface
- risk-of-ruin proxy
- testes automatizados

## Governança
O `operationalGate` permanece `BLOCKED`. A saída é evidência de pesquisa e não autorização automática de aposta.

## Validação esperada
`npm run check` deve compilar TypeScript e executar todos os testes.
