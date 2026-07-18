# RELATORIO TECNICO - SPRINT 012

## Objetivo
Implementar um motor incremental de estatisticas para sessoes live, reduzindo recomputacoes e preparando o RL.SYS Core para operar com baixa latencia em hardware limitado, especialmente Helio P22 com 2GB de RAM.

## Entregas
- `IncrementalStatisticsEngine`
- Janela circular fixa para historico live
- Contadores incrementais por numero de roleta
- Contadores incrementais por setor (`voisins`, `tiers`, `orphelins`, `zero`)
- Idempotencia por `eventId` ou chave deterministica por sequencia
- Replay deterministico de eventos
- Checksum de snapshot
- Classificacao leve de tendencia: `INSUFFICIENT_DATA`, `BALANCED`, `CONCENTRATING`, `REPEATING`
- Testes unitarios cobrindo atualizacao incremental, idempotencia, concentracao, replay e erro tipado

## Decisao Arquitetural
A Sprint introduz uma camada de dominio pura em `src/domain/statistics`, sem dependencia de filesystem, banco, HTTP, UI ou adaptadores externos. O motor usa uma janela circular pre-alocada e arrays numericos fixos para evitar crescimento de memoria durante sessoes longas.

A decisao evita recalcular estatisticas varrendo todo o historico a cada rodada. Em vez disso, cada nova rodada atualiza contadores locais e remove o item expirado da janela quando necessario.

## Complexidade
- Ingestao: O(1)
- Atualizacao da janela: O(1)
- Snapshot: O(37), constante para roleta europeia
- Espaco: O(w + c), onde `w` e o tamanho fixo da janela e `c` e o cache limitado de idempotencia

## Governanca
A Sprint nao autoriza apostas e nao altera `liveStakeFraction`. O resultado serve como insumo tecnico para camadas posteriores de runtime, decision orchestration e HUD operacional.

## Resultado Esperado
O RL.SYS passa a ter uma base incremental para estatisticas live com baixo custo computacional, adequada para execucao continua em ambiente mobile/Termux sem recomputacao pesada a cada rodada.
