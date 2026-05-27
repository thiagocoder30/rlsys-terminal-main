# RELATORIO TECNICO - SPRINT 021

## Objetivo
Criar um registro determinístico de datasets para que a pesquisa offline do RL.SYS possa comparar resultados com rastreabilidade de origem, qualidade, tags, provedor, mesa, dealer e checksum.

## Decisão Arquitetural
A Sprint adiciona uma camada de domínio pura (`DatasetRegistryEngine`) sem dependência de filesystem, banco de dados, API, UI ou storage externo. O motor recebe descritores de datasets e devolve registros auditáveis que podem ser persistidos por qualquer adaptador futuro.

## Entregas
- `DatasetRegistryEngine`
- `DatasetRegistryRecord`
- `DatasetRegistryReport`
- `DatasetRegistryPolicy`
- Checksum de conteúdo
- Checksum de metadados
- Normalização determinística de tags
- Classificação de qualidade `A/B/C/D`
- Status `ACCEPTED / REVIEW_REQUIRED / BLOCKED`
- Testes unitários de aceitação, revisão, corrupção, duplicidade e batch excessivo

## Governança
A Sprint não executa pesquisa, não altera decisão live e não autoriza aposta. Ela cria o catálogo confiável para que o Offline Research Runner e o EV & Risk Analytics Engine possam comparar experimentos usando datasets com origem e qualidade conhecidas.

## Complexidade
- Tempo: `O(d + v + t)`, onde `d` é o número de datasets, `v` é o total de valores amostrados e `t` é o total de tags.
- Espaço: `O(d + t)`, limitado pelo número de datasets e tags registrados.

## Segurança Operacional
- Bloqueia IDs duplicados.
- Bloqueia valores de roleta fora de `0..36`.
- Bloqueia lotes acima do limite configurado.
- Pode bloquear datasets sintéticos por política.
- Exige revisão quando confiabilidade ou completude ficam abaixo da política.
