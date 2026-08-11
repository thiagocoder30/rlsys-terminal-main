# RELATORIO TECNICO - SPRINT 023

## Objetivo
Comparar estratégias candidatas de pesquisa de forma determinística, auditável e ajustada por risco, evitando falsa liderança baseada em win rate bruto, amostra pequena ou drawdown oculto.

## Entregas
- `StrategyComparisonFramework`
- Ranking determinístico por score ajustado a EV, profit factor, confiança, amostra e risco
- Status `LEADER_FOUND`, `NO_CLEAR_LEADER` e `BLOCKED`
- Penalização por drawdown, risk of ruin e frequência excessiva de sinais
- Tie-break determinístico por EV, risco e identificador da estratégia
- Checksums para auditoria de comparação
- Testes unitários cobrindo liderança clara, empate técnico, bloqueios, idempotência e payloads malformados

## Decisão arquitetural
A Sprint cria uma camada de domínio pura em `src/domain/comparison`, sem dependência de banco, filesystem, UI, HTTP ou execução live. O framework consome métricas de pesquisa já calculadas e devolve apenas uma classificação comparativa auditável.

## Complexidade
- Tempo: `O(n log n)`, dominado pela ordenação das estratégias
- Espaço: `O(n)`, limitado por `maxStrategies`

## Governança
A Sprint não autoriza aposta real. Mesmo quando há `LEADER_FOUND`, o resultado é apenas insumo científico para experimentos offline, orquestração de research e futuras decisões `RESEARCH_ONLY`.
