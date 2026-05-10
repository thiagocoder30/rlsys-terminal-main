# RELATORIO TECNICO - SPRINT 008

## Objetivo
Implementar o Strategy Ensemble System para consolidar múltiplas estratégias em uma decisão agregada, ponderada por confiança, evidência, recência e risco. A Sprint reduz a chance de uma única estratégia dominar a decisão quando houver conflito entre hipóteses.

## Decisão arquitetural
O ensemble foi implementado como serviço de domínio puro em `src/domain/strategy/StrategyEnsembleEngine.ts`. Ele não depende de API, UI, armazenamento, OCR ou runtime live. O `DecisionOrchestrator` apenas consome um relatório opcional do ensemble, mantendo separação de responsabilidades e permitindo que novas estratégias sejam plugadas sem alterar o núcleo.

## Entregas
- `StrategyEnsembleEngine`
- `StrategyEnsembleVote`
- `StrategyEnsembleReport`
- Decisão agregada `CONSENSUS / CONFLICT / INSUFFICIENT_SUPPORT / BLOCKED`
- Score por alvo operacional
- Detecção de conflito entre estratégias
- Integração opcional com `DecisionOrchestrator`
- Testes unitários para consenso, conflito e erro tipado
- Teste de bloqueio no orquestrador por conflito estratégico

## Governança
A Sprint não autoriza apostas reais. Mesmo quando o ensemble produz `CONSENSUS`, o sistema continua em modo `RESEARCH_ONLY` e `liveStakeAllowed=false`. Quando o ensemble identifica conflito, o `DecisionOrchestrator` converte o cenário em bloqueio institucional.

## Complexidade
- Tempo: `O(n + t log t)`, onde `n` é o número de votos e `t` é o número de alvos distintos.
- Espaço: `O(t)`, limitado às hipóteses agregadas.

## Resultado esperado
O RL.SYS passa a avaliar convergência multi-estratégia antes de expor uma hipótese operacional. Isso aumenta robustez e reduz falsos positivos baseados em win rate isolado.
