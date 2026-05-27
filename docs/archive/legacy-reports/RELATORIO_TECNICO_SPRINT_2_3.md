# RELATORIO TECNICO - SPRINT 2.3

## Objetivo
Adicionar uma camada institucional de stress testing e drawdown surface para avaliar sobrevivência da estratégia em cenários adversos.

## Entregas
- `StressScenarioAnalyzer`
- `StressScenarioService`
- Endpoint `/api/backtest/stress/evaluate`
- Drawdown surface multi-stake/multi-shock
- Tail-risk proxy
- Recovery factor
- Longest underwater run
- Ruin probability proxy
- Testes automatizados

## Política de segurança
O gate operacional permanece `BLOCKED`. Esta sprint produz evidência de pesquisa e rejeição/triagem de robustez, não autorização automática para stake.

## Critérios institucionais
- Rejeitar falhas severas em stress scenarios
- Rejeitar drawdown catastrófico
- Rejeitar clusters de falha na superfície de drawdown
- Exigir revisão manual mesmo para candidatos resilientes
