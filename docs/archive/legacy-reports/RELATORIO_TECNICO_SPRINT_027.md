# RELATORIO TECNICO - SPRINT 027

## Objetivo

Implementar o primeiro módulo formal da fase Physical Edge Research: o Dealer Signature Engine.

O objetivo da Sprint é detectar se um dealer apresenta assinatura estatística persistente associada a setores físicos da roleta, sem autorizar aposta e sem acoplar a análise ao runtime mobile.

## Entregas

- DealerSignatureEngine
- Detecção de assinatura por dealer
- Agrupamento por setores físicos da roleta europeia
- Comparação contra baseline global
- Status SIGNATURE_CANDIDATE / INCONCLUSIVE / BLOCKED
- Score de concentração setorial
- Score de desvio contra baseline
- Entropia setorial normalizada
- Checksum determinístico do relatório
- Testes unitários para assinatura persistente, histórico balanceado, amostra insuficiente, payload inválido e determinismo

## Decisão Arquitetural

O módulo foi implementado na camada de domínio/research, sem dependência de OCR, UI, API, filesystem ou runtime mobile.

Essa decisão preserva Clean Architecture e permite que a análise seja usada apenas no Research Cluster offline.

O Mobile Execution Engine não executa esse cálculo pesado. Futuramente, caso uma assinatura seja validada, ela será compilada para snapshots leves por meio da camada Knowledge Compiler.

## Governança

A Sprint não libera apostas.

O resultado SIGNATURE_CANDIDATE significa apenas que existe um candidato de assinatura física/operacional que precisa passar por validação posterior, como Walk-Forward, Monte Carlo, EV/Risk Analytics e Strategy Comparison.

O sistema continua com postura institucional:

- bloquear amostras insuficientes
- rejeitar payloads inválidos
- nunca assumir edge com base em evidência fraca
- preservar determinismo para replay e auditoria

## Complexidade

- Tempo: O(n), onde n é a quantidade de registros analisados
- Espaço: O(k), onde k é limitado ao número de dealers e setores físicos

## Impacto no Roadmap

Essa Sprint inicia a fase Physical Edge Research.

O foco deixa de ser estatística pura de números e passa a observar se existe assimetria física ou operacional persistente no ambiente.

Essa fase é fundamental porque, em uma roleta ideal, não existe EV+ estatístico persistente. O edge real, se existir, tende a surgir de imperfeições físicas, assinatura do dealer, persistência setorial ou distorções operacionais.
