# RELATORIO TECNICO - SPRINT 022

## Objetivo
Orquestrar experimentos científicos versionados conectando o registro de datasets, o runner offline determinístico e o motor de EV/Risco em um envelope único de pesquisa.

## Entregas
- `ResearchExperimentOrchestrator`
- Validação cruzada entre `DatasetRegistryReport`, `OfflineResearchRunnerReport` e `EVRiskAnalyticsReport`
- Status de experimento: `ALPHA_CANDIDATE`, `INCONCLUSIVE`, `BLOCKED`
- Stages auditáveis: `DATASET_REGISTRY`, `OFFLINE_RESEARCH`, `EV_RISK_ANALYTICS`
- Política mínima de dataset aceito, frames totais, frequência de sinal e exigência de EV positivo
- Conclusão textual determinística para revisão técnica
- Checksums de evidência e checksum final do experimento
- Testes unitários cobrindo alpha candidato, bloqueios, determinismo e input malformado

## Decisao Arquitetural
A Sprint cria um orquestrador de domínio puro. Ele não executa OCR, não lê arquivos, não persiste dados e não toma decisão live. Sua função é consolidar relatórios já produzidos por motores especializados para responder se uma hipótese de alpha passou por governança mínima.

A separação preserva Clean Architecture: infraestrutura pode armazenar ou carregar relatórios, mas a regra de interpretação científica permanece dentro do domínio.

## Complexidade
- Tempo: `O(b + w)`, onde `b` e `w` representam total de blockers e warnings agregados.
- Espaço: `O(b + w)`.
- O orquestrador não duplica frames ou outcomes, respeitando o limite de memória do Helio P22 / 2GB RAM.

## Governanca
A Sprint não autoriza aposta. Um status `ALPHA_CANDIDATE` significa apenas que a hipótese merece investigação adicional. O sistema continua research-only e bloqueia quando dataset, replay ou EV/Risco não sustentam a hipótese.
