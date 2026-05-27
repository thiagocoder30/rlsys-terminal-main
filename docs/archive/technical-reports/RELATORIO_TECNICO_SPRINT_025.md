# RELATORIO TECNICO - SPRINT 025

## Objetivo
Implementar o Monte Carlo Research Studio para estressar candidatos de alpha contra variância extrema, drawdown, risco de ruína e sensibilidade de capital antes de qualquer avanço para compilação de conhecimento ou execução mobile.

## Entregas
- `MonteCarloResearchStudio`
- `MonteCarloResearchOutcome`
- `MonteCarloResearchPolicy`
- `MonteCarloResearchReport`
- Bootstrap determinístico por seed
- Simulações de equity curve por reamostragem com reposição
- Métricas de sobrevivência, drawdown e retorno final
- Status `ROBUST_UNDER_VARIANCE`, `FRAGILE_UNDER_VARIANCE`, `INCONCLUSIVE` e `BLOCKED`
- Checksum determinístico do relatório
- Testes unitários para robustez, fragilidade, idempotência, batch excessivo e input inválido

## Decisão Arquitetural
A Sprint cria uma camada de domínio pura em `src/domain/research`, sem dependência de filesystem, banco, API, OCR, UI ou runtime mobile. O módulo recebe outcomes offline já resolvidos pelo pipeline científico e executa simulações Monte Carlo determinísticas para estimar a capacidade do candidato sobreviver à variância natural da roleta.

## Complexidade
- Tempo: `O(s * t)`, onde `s` é o número de simulações e `t` é o tamanho da sequência simulada.
- Espaço: `O(s)`, mantendo apenas o resumo de cada simulação e evitando armazenar curvas completas.

## Governança
A Sprint não autoriza apostas e não altera o runtime live. Ela atua como camada de stress científico: candidatos que parecem positivos em EV médio, mas colapsam sob reordenação de resultados, drawdown extremo ou risco de ruína elevado são classificados como frágeis ou inconclusivos.
