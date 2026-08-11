# RELATORIO TECNICO - SPRINT 009

## Objetivo
Implementar inteligencia de decaimento temporal para que evidencias antigas percam influencia automaticamente antes de chegar ao fluxo de decisao live.

## Decisao Arquitetural
A Sprint adiciona um motor de dominio puro chamado `TemporalDecayEngine`. Ele opera em unidades de rodada/spin, sem dependencia de UI, banco de dados, APIs, OCR ou runtime externo. O motor recebe snapshots de sinais, aplica decaimento exponencial por meia-vida, calcula frescor, classifica o status temporal e devolve um `Result` tipado.

Essa camada segue Clean Architecture: o dominio nao conhece fornecedores, transporte ou persistencia. O `DecisionOrchestrator` passa a aceitar o relatorio temporal como insumo opcional e bloqueia sinais quando a politica temporal indicar expiracao.

## Entregas
- `TemporalDecayEngine`
- `TemporalSignalSnapshot`
- `TemporalDecayReport`
- Estados temporais: `FRESH`, `AGING`, `STALE`, `EXPIRED`
- Decisoes temporais: `ALLOW`, `OBSERVE`, `BLOCK_EXPIRED`
- Integracao opcional no `DecisionOrchestrator`
- Testes unitarios para sinais frescos, envelhecidos, expirados e payload malformado
- Teste de bloqueio no orquestrador por evidencia temporal expirada

## Governanca
A Sprint nao libera stake real e nao altera a politica `RESEARCH_ONLY`. O papel do modulo e impedir que uma estrategia seja recomendada com base em informacao velha, mesmo quando ranking, regime e ensemble estejam aparentemente favoraveis.

## Complexidade
- Tempo: `O(n)` para avaliacao dos sinais temporais e `O(n log n)` apenas para ordenar contribuicoes no relatorio.
- Espaco: `O(n)`, limitado ao numero de sinais ativos em memoria.

## Impacto Operacional
O RL.SYS passa a diferenciar evidencia recente de evidencia vencida. Isso reduz falsos positivos causados por padroes que ja perderam validade no fluxo live.
