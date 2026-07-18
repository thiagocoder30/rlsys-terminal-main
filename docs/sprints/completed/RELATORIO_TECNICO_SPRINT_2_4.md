# Relatório Técnico — Sprint 2.4

## Capital Exposure Simulator & Advanced Risk-of-Ruin

Esta Sprint adiciona uma camada institucional para avaliar sobrevivência de capital, exposição, convexidade de perdas e risco de ruína sob diferentes políticas de stake.

## Entregas

- `CapitalExposureSimulator`
- `CapitalExposureService`
- endpoint `/api/backtest/capital-exposure/evaluate`
- simulação de equity curve por política de stake
- underwater curve e longest underwater run
- exposure saturation e capital efficiency
- Advanced Risk-of-Ruin com severidade e drivers
- circuit breakers de governança
- testes automatizados de domínio e aplicação

## Governança

O gate operacional permanece sempre `BLOCKED`. A Sprint produz evidência de pesquisa e risco, não autorização automática de apostas.

## Resultado

O projeto passa a medir se uma hipótese quantitativa sobrevive sob restrições reais de capital, drawdown e exposição.
