# RELATÓRIO TÉCNICO — SPRINT 2.5

## Entrega
Implementada a camada **Monte Carlo v2 & Bootstrap Resampling**.

## Componentes adicionados
- `BootstrapResampler`
- `MonteCarloV2Engine`
- `MonteCarloV2Service`
- Endpoint `/api/backtest/monte-carlo/v2/evaluate`
- Testes automatizados para bootstrap, engine e service

## Capacidades
- Reamostragem bootstrap com blocos para preservar dependência local
- Simulação de múltiplos caminhos sintéticos de capital
- Confidence bands para capital, ROI e drawdown
- Tail-risk proxy
- Sequence dependency risk
- Robustness score
- Fragility index

## Governança
O gate operacional permanece bloqueado. A Sprint produz evidência de pesquisa e robustez, não autorização automática de aposta.
