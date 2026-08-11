# RELATORIO TECNICO - SPRINT 024

## Objetivo
Implementar o Walk-Forward Validation Lab para validar se sinais e estratégias preservam EV positivo fora da amostra, reduzindo o risco de overfitting antes de qualquer evolução para runtime operacional.

## Entregas
- `WalkForwardValidationLab`
- `WalkForwardOutcome`
- `WalkForwardValidationPolicy`
- `WalkForwardValidationReport`
- Métricas por janela de treino e validação
- Status `ROBUST_ALPHA_CANDIDATE`, `OVERFIT`, `INCONCLUSIVE` e `BLOCKED`
- Checksum determinístico do relatório
- Testes unitários para candidato robusto, overfit, inconclusão, determinismo, input inválido e batch excessivo

## Decisão Arquitetural
A Sprint cria uma camada de domínio pura em `src/domain/validation`, sem dependência de filesystem, banco, API, OCR ou UI. O módulo recebe outcomes já resolvidos pelo pipeline offline e divide a série em janelas de treino e validação para medir a sobrevivência do edge fora da amostra.

## Complexidade
- Tempo: `O(n + w * v)`, onde `n` é o total de outcomes, `w` é o número de janelas e `v` é o tamanho da janela de validação para varredura de drawdown.
- Espaço: `O(n + w)`, usando prefix sums e relatórios por janela.

## Governança
A Sprint não autoriza apostas e não altera o runtime live. Ela atua como camada de falsificação científica: candidatos que funcionam apenas na janela de treino são classificados como `OVERFIT` ou `INCONCLUSIVE`, impedindo que alpha falso avance para compilação de conhecimento ou execução mobile.
