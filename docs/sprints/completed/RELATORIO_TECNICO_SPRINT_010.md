# RELATORIO TECNICO - SPRINT 010

## Objetivo
Adicionar uma camada de calibracao adaptativa de confianca para normalizar a decisao final do core quantitativo considerando evidencia, regime de mesa, consenso do ensemble, frescor temporal, qualidade dos dados, risco e ruido operacional.

## Entregas
- AdaptiveConfidenceEngine
- AdaptiveConfidenceReport
- Integracao opcional com DecisionOrchestrator
- Bloqueio de sinal por baixa confianca adaptativa
- Alertas para ruido, risco, consenso fraco, frescor reduzido e amostra imatura
- Testes unitarios para ALLOW, OBSERVE, BLOCK_LOW_CONFIDENCE e erro tipado
- Teste de integracao do DecisionOrchestrator com bloqueio por confianca adaptativa

## Decisao Arquitetural
A calibracao de confianca foi implementada como engine de dominio pura em `src/domain/confidence`, sem dependencia de UI, HTTP, armazenamento, Gemini ou runtime externo. O DecisionOrchestrator apenas consome o relatorio como insumo opcional, mantendo baixo acoplamento e preservando Clean Architecture.

## Complexidade
- Tempo: O(1), pois combina um numero fixo de componentes.
- Espaco: O(1), com vetor fixo de componentes de confianca.

## Governanca
A Sprint nao autoriza apostas reais. Mesmo quando a confianca adaptativa permite uma hipotese, o sistema permanece em `RESEARCH_ONLY` e `liveStakeAllowed=false`. Quando a confianca fica abaixo da banda dinamica, o orquestrador bloqueia o sinal antes de qualquer exposicao operacional.
