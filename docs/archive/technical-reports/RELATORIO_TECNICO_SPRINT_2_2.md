# RELATÓRIO TÉCNICO — SPRINT 2.2

## Advanced Walk-Forward & Out-of-Sample Validation

Esta sprint adiciona uma camada institucional de validação fora da amostra para reduzir risco de overfitting.

## Entregas

- `AdvancedWalkForwardValidator`
- `AdvancedWalkForwardService`
- endpoint `/api/backtest/walk-forward/advanced/evaluate`
- métricas de consistência fora da amostra
- degradação treino vs validação
- score de risco de overfitting
- robustez por fold
- testes automatizados

## Governança

O gate operacional permanece `BLOCKED`. A saída é evidência de pesquisa, não autorização automática de stake.

## Resultado esperado

O sistema passa a rejeitar hipóteses que performam bem no treino mas degradam fora da amostra.
