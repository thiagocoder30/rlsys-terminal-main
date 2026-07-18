# RELATORIO TECNICO - SPRINT 014

## Objetivo
Adicionar uma camada de explicabilidade para transformar decisões do core em narrativas auditáveis, evidências estruturadas e resumos por módulo, sem alterar governança, stake ou estado operacional.

## Decisão arquitetural
A Sprint introduz um engine de domínio puro, `ExplainabilityEngine`, que consome o `DecisionOrchestratorReport` já calculado e produz uma saída determinística para UI, logs e relatórios. A camada não depende de HTTP, banco, filesystem, Gemini ou interface gráfica.

O design aplica o padrão Observer de forma complementar ao Event Bus já implementado: decisões podem ser publicadas e explicações podem ser geradas por um observer sem acoplamento direto ao orquestrador. A Sprint também preserva Clean Architecture: o domínio explica fatos já calculados, mas não executa apostas, não recalcula ranking e não muda o estado da sessão.

## Entregas
- `ExplainabilityEngine`
- `ExplainabilityReport`
- Evidence cards tipados por módulo
- Executive summary
- Primary reason
- Audit narrative determinística
- Module summaries para SESSION, RANKING, DECISION, REGIME, ENSEMBLE, TEMPORAL, CONFIDENCE e GOVERNANCE
- Checksum SHA-256 para auditoria
- Testes unitários de determinismo, blockers, limite de evidências e erro tipado

## Governança
A Sprint não autoriza aposta real. Mesmo quando o relatório explica uma hipótese `READY_FOR_RESEARCH_SIGNAL`, a narrativa reforça que a execução permanece `RESEARCH_ONLY` e que `liveStakeAllowed` continua falso.

## Complexidade
- Tempo: O(b + w + m), onde `b` é o número de blockers, `w` é o número de warnings e `m` é o número fixo de módulos explicáveis.
- Espaço: O(k), limitado por `maxEvidenceItems`, evitando crescimento desnecessário de memória no Galaxy A10s / Helio P22.

## Resultado esperado
O operador passa a receber uma explicação objetiva sobre por que o sistema bloqueou, observou ou gerou hipótese research-only. Isso prepara o RL.SYS para HUD, auditoria, replay e relatórios de sessão sem comprometer segurança operacional.
