# RELATORIO TECNICO - SPRINT 007

## Objetivo
Classificar o regime operacional da mesa antes da tomada de decisão, permitindo que o RL.SYS diferencie cenários estáveis, voláteis, em drift ou caóticos. A Sprint adiciona uma camada de governança que impede que o Decision Orchestrator produza hipótese de sinal quando o comportamento recente da mesa for incompatível com decisão robusta.

## Entregas
- `RegimeClassificationEngine`
- Tipos `TableRegime` e `RegimeSignalPolicy`
- Regimes `STABLE`, `VOLATILE`, `DRIFTING` e `CHAOTIC`
- Políticas `ALLOW_RESEARCH`, `OBSERVE_ONLY` e `BLOCK_SIGNALS`
- Métricas de entropia normalizada, volatilidade de entropia, drift, concentração, diversidade e skew setorial
- Integração opcional com `DecisionOrchestrator`
- Bloqueio de sinal quando `signalPolicy = BLOCK_SIGNALS`
- Testes unitários para regime estável, caótico, drifting, erro tipado e bloqueio no orquestrador

## Decisão Arquitetural
A classificação foi implementada como serviço de domínio puro em `src/domain/regime`, sem dependência de HTTP, OCR, UI, storage ou SDKs externos. O motor recebe apenas histórico numérico validado e retorna um relatório auditável via padrão `Result`. Essa separação preserva Clean Architecture: adaptadores podem fornecer dados, mas a regra de classificação permanece isolada no core.

## Complexidade
- Tempo: `O(n)`, com uma única varredura relevante sobre o histórico e janelas recentes limitadas.
- Espaço: `O(37 + w)`, onde `37` representa os números possíveis da roleta e `w` é o número máximo configurado de janelas.

## Governança
A Sprint não autoriza apostas. Mesmo quando o regime é `STABLE`, a política máxima é `ALLOW_RESEARCH`, preservando `RESEARCH_ONLY` e `liveStakeAllowed = false`. Quando o regime é `CHAOTIC` ou volátil com baixa confiança, o Decision Orchestrator converte a saída para `NO_GO`/`BLOCKED`.

## Resultado Esperado
O RL.SYS passa a entender o contexto operacional da mesa antes de considerar ranking de estratégia. Isso reduz falso positivo em ambientes instáveis e prepara o núcleo para futuras camadas de ensemble e adaptação temporal.
